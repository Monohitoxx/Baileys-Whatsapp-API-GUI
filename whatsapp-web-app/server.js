require('dotenv').config();
const express = require('express');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, Browsers } = require('@whiskeysockets/baileys');
const cors = require('cors');
const pino = require('pino');
const fs = require('fs');
const fsp = require('fs').promises;  // 使用 promises 版本的 fs
const qrcode = require('qrcode-terminal');
const NodeCache = require('node-cache');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { spawn } = require('child_process');
const util = require('util');
const nodemailer = require('nodemailer');

const app = express();

// 定義配置文件路徑
const CONFIG_FILE = path.join(__dirname, 'config.json');

// 初始化配置對象
let config = {
    server: {
        host: 'http://localhost:3001'
    },
    email: {
        enabled: false,
        address: '',
        smtp: {
            host: '',
            port: '',
            username: '',
            password: ''
        }
    }
};

// 加載配置文件
async function loadConfig() {
    try {
        const data = await fsp.readFile(CONFIG_FILE, 'utf8');
        const loadedConfig = JSON.parse(data);
        
        // 深層合併配置
        config = {
            ...config,
            ...loadedConfig,
            server: {
                ...config.server,
                ...loadedConfig.server
            },
            email: {
                ...config.email,
                ...loadedConfig.email,
                smtp: {
                    ...config.email.smtp,
                    ...loadedConfig.email?.smtp
                }
            }
        };

        console.log('成功載入配置文件');
        
        // 更新 emailConfig
        emailConfig = {
            enabled: config.email.enabled || false,
            email: config.email.address || '',
            smtp: {
                host: config.email.smtp?.host || '',
                port: config.email.smtp?.port || '',
                username: config.email.smtp?.username || '',
                password: config.email.smtp?.password || ''
            }
        };
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('配置文件不存在，使用默認配置');
            // 確保使用默認值
            config = {
                server: {
                    host: 'http://localhost:3001'
                },
                email: {
                    enabled: false,
                    address: '',
                    smtp: {
                        host: '',
                        port: '',
                        username: '',
                        password: ''
                    }
                }
            };
            await saveConfig();
        } else {
            console.error('讀取配置文件失敗:', error);
        }
    }
}

// 保存配置文件
async function saveConfig() {
    try {
        await fsp.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
        console.log('成功保存配置文件');
    } catch (error) {
        console.error('保存配置文件失敗:', error);
    }
}

// 配置 CORS
const corsOptions = {
    origin: function (origin, callback) {
        // 允許所有來源
        callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

let sock = null;
let qr = null;
let isConnected = false;
let lastStatus = '';
let userInfo = null;  // 添加用戶信息變量
let emailConfig = {
    enabled: false,
    email: '',
    smtp: {
        host: '',
        port: '',
        username: '',
        password: ''
    }
};

// 確保認證目錄存在
const AUTH_FOLDER = './auth_info_baileys';
if (!fs.existsSync(AUTH_FOLDER)) {
    fs.mkdirSync(AUTH_FOLDER);
}

// 創建群組緩存
const groupCache = new NodeCache({ 
    stdTTL: 5 * 60,  // 5 分鐘過期
    useClones: false,
    checkperiod: 60  // 每分鐘檢查過期
});

// 添加定時任務存儲
let tasks = [];

// 添加任務調度器存儲
const scheduledTasks = new Map();

// 定義任務文件路徑
const TASKS_FILE = path.join(__dirname, 'tasks.json');

// 添加自定義動作存儲
let customActions = [];

// 定義自定義動作文件路徑
const CUSTOM_ACTIONS_FILE = path.join(__dirname, 'custom-actions.json');

// 讀取電子郵件設定
const EMAIL_CONFIG_FILE = path.join(__dirname, 'email-config.json');

// 保存電子郵件設定
async function saveEmailConfig() {
    try {
        await fsp.writeFile(EMAIL_CONFIG_FILE, JSON.stringify(emailConfig, null, 2));
        console.log('成功保存電子郵件設定');
    } catch (error) {
        console.error('保存電子郵件設定失敗:', error);
    }
}

// 讀取電子郵件設定
async function loadEmailConfig() {
    try {
        const data = await fsp.readFile(EMAIL_CONFIG_FILE, 'utf8');
        emailConfig = JSON.parse(data);
        console.log('成功載入電子郵件設定');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('電子郵件設定文件不存在，使用默認設定');
            await saveEmailConfig();
        } else {
            console.error('讀取電子郵件設定失敗:', error);
        }
    }
}

// 修改發送電子郵件警報函數
async function sendEmailAlert(subject, text) {
    if (!emailConfig.enabled || !emailConfig.email) {
        console.log('電子郵件警報未啟用或郵箱地址未設定');
        return;
    }

    const transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host || process.env.SMTP_HOST,
        port: emailConfig.smtp.port || process.env.SMTP_PORT,
        secure: emailConfig.smtp.port === '465',
        auth: {
            user: emailConfig.smtp.username || process.env.EMAIL_USER,
            pass: emailConfig.smtp.password || process.env.EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: emailConfig.smtp.username || process.env.EMAIL_USER,
        to: emailConfig.email,
        subject: subject,
        text: text
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('警報郵件發送成功');
    } catch (error) {
        console.error('發送警報郵件失敗:', error);
    }
}

// 讀取任務
async function loadTasks() {
    try {
        const data = await fsp.readFile(TASKS_FILE, 'utf8');  // 使用 fsp 而不是 fs
        tasks = JSON.parse(data);
        console.log('成功載入任務:', tasks.length);
        // 重新初始化所有任務的調度
        initTasks();
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('任務文件不存在，使用空數組');
            tasks = [];
            // 創建空的任務文件
            await saveTasks();
        } else {
            console.error('讀取任務文件失敗:', error);
        }
    }
}

// 保存任務
async function saveTasks() {
    try {
        await fsp.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));  // 使用 fsp
        console.log('成功保存任務');
    } catch (error) {
        console.error('保存任務失敗:', error);
    }
}

// 讀取自定義動作
async function loadCustomActions() {
    try {
        const data = await fsp.readFile(CUSTOM_ACTIONS_FILE, 'utf8');
        customActions = JSON.parse(data);
        console.log('成功載入自定義動作:', customActions.length);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('自定義動作文件不存在，使用空數組');
            customActions = [];
            // 創建空的自定義動作文件
            await saveCustomActions();
        } else {
            console.error('讀取自定義動作文件失敗:', error);
        }
    }
}

// 保存自定義動作
async function saveCustomActions() {
    try {
        await fsp.writeFile(CUSTOM_ACTIONS_FILE, JSON.stringify(customActions, null, 2));
        console.log('成功保存自定義動作');
    } catch (error) {
        console.error('保存自定義動作失敗:', error);
    }
}

// 修改 WhatsApp ID 格式處理函數
function formatWhatsAppId(id, type) {
    // 如果 ID 已經包含後綴，直接返回
    if (id.includes('@')) {
        return id;
    }
    
    // 如果是群組，使用 @g.us 後綴
    if (type === 'group') {
        return `${id}@g.us`;
    }
    
    // 如果是用戶，使用 @s.whatsapp.net 後綴
    return `${id}@s.whatsapp.net`;
}

// 修改 SSH 命令執行函數
async function executeSSHCommand(command, outputFilters = []) {
    return new Promise((resolve, reject) => {
        // 檢查命令是否存在
        if (!command || typeof command !== 'string' || command.trim() === '') {
            reject(new Error('命令不能為空或未定義'));
            return;
        }
        
        // 解析命令和參數
        const [cmd, ...args] = command.trim().split(' ');
        const sshProcess = spawn(cmd, args);
        
        let stdoutData = '';
        
        // 設置超時
        const timeout = setTimeout(() => {
            sshProcess.kill();
            reject(new Error('命令執行超時'));
        }, 30000);
        
        // 檢查一行是否應該被過濾
        const shouldFilterLine = (line) => {
            // 如果沒有設置過濾規則，直接返回 false
            if (!outputFilters || outputFilters.length === 0) {
                return false;
            }

            // 檢查自定義過濾規則
            return outputFilters.some(filter => {
                try {
                    if (filter.startsWith('/') && filter.endsWith('/')) {
                        const regex = new RegExp(filter.slice(1, -1));
                        const matches = regex.test(line);
                        if (matches) {
                            console.log(`過濾掉的行 (正則匹配 ${filter}):`, line);
                        }
                        return matches;
                    }
                    const matches = line.includes(filter);
                    if (matches) {
                        console.log(`過濾掉的行 (包含 "${filter}"):`, line);
                    }
                    return matches;
                } catch (error) {
                    console.error('過濾規則處理錯誤:', error);
                    return false;
                }
            });
        };

        // 處理標準輸出
        sshProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            const filteredLines = lines
                .filter(line => line.trim() !== '' && !shouldFilterLine(line));
            
            if (filteredLines.length > 0) {
                stdoutData += filteredLines.join('\n') + '\n';
            }
        });

        // 處理命令結束
        sshProcess.on('close', (code) => {
            clearTimeout(timeout);
            
            // 等待一小段時間以確保所有輸出都被處理
            setTimeout(() => {
                let result = stdoutData.trim();
                
                // 如果沒有實際輸出但命令成功執行
                if (!result && code === 0) {
                    result = '命令執行成功，但沒有輸出結果';
                }
                // 如果命令執行失敗且沒有有效輸出
                else if (!result && code !== 0) {
                    result = `命令執行失敗 (退出碼: ${code})`;
                }
                
                resolve(result);
            }, 1000);
        });

        // 處理錯誤
        sshProcess.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`執行失敗: ${error.message}`));
        });
    });
}

// 修改時間戳格式化函數，確保返回值正確
function formatTimestamp() {
    try {
        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const day = days[now.getDay()];
        const month = months[now.getMonth()];
        const date = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const year = now.getFullYear();
        
        return `${day} ${month} ${date} ${hours}:${minutes}:${seconds} HKT ${year}`;
    } catch (error) {
        console.error('格式化時間戳失敗:', error);
        return new Date().toLocaleString('en-US', { timeZone: 'Asia/Hong_Kong' });
    }
}

// 修改調度任務函數
function scheduleTask(task) {
    try {
        if (scheduledTasks.has(task.id)) {
            scheduledTasks.get(task.id).forEach(scheduler => scheduler.stop());
            scheduledTasks.delete(task.id);
        }

        if (!task.enabled) {
            console.log(`任務 ${task.id} 已禁用，不進行調度`);
            return;
        }

        // 檢查時間是否有效
        if (!task.times || task.times.length === 0 || !task.times[0]) {
            console.error(`任務 ${task.id} 的執行時間無效`);
            return;
        }

        // 為每個時間點創建一個調度器
        task.times.forEach((time, index) => {
            if (!time) {
                console.error(`任務 ${task.id} 的第 ${index + 1} 個時間點無效`);
                return;
            }

            const [hours, minutes] = time.split(':');
            if (!hours || !minutes) {
                console.error(`任務 ${task.id} 的時間格式無效: ${time}`);
                return;
            }

            // 根據執行日期設定生成 cron 表達式
            let cronExpression;
            if (task.executionDays?.type === 'everyday') {
                cronExpression = `${minutes} ${hours} * * *`;
            } else if (task.executionDays?.type === 'weekly' && task.executionDays.days?.length > 0) {
                // 將選擇的星期幾轉換為 cron 格式（0-6 表示週日到週六）
                const daysString = task.executionDays.days.join(',');
                cronExpression = `${minutes} ${hours} * * ${daysString}`;
            } else if (task.executionDays?.type === 'monthly' && task.executionDays.days?.length > 0) {
                // 將選擇的日期轉換為 cron 格式（1-31）
                const daysString = task.executionDays.days.join(',');
                cronExpression = `${minutes} ${hours} ${daysString} * *`;
            } else {
                console.error(`任務 ${task.id} 的執行日期設定無效`);
                return;
            }

            console.log(`創建任務調度: ${task.title} (${task.id}), 時間: ${time}, 類型: ${task.executionDays.type}, Cron: ${cronExpression}`);
            
            try {
                const scheduler = cron.schedule(cronExpression, async () => {
                    if (!sock || !isConnected || !task.enabled) {
                        console.log(`跳過任務 ${task.title} (${task.id}): 連接狀態不符合要求`);
                        return;
                    }

                    try {
                        const jid = formatWhatsAppId(task.targetId, task.targetType);
                        console.log(`執行任務 "${task.title}" (${task.id}), 時間: ${time}, 發送到: ${jid}`);

                        if (task.taskType === 'executeSSH') {
                            try {
                                if (!task.sshCommand || task.sshCommand.trim() === '') {
                                    console.error(`任務 ${task.id} 的命令為空`);
                                    await sock.sendMessage(jid, { 
                                        text: '錯誤：命令為空，無法執行' 
                                    });
                                    return;
                                }

                                console.log('執行命令:', task.sshCommand);
                                console.log('使用過濾規則:', task.outputFilters || []);
                                const result = await executeSSHCommand(task.sshCommand, task.outputFilters);
                                console.log('命令執行結果:', result);

                                // 獲取當前時間戳
                                const timestamp = formatTimestamp();
                                console.log('生成的時間戳:', timestamp);

                                // 處理訊息模板
                                let messageText = task.message || '執行結果：\n{command_response_content}';
                                console.log('原始訊息模板:', messageText);

                                // 替換時間戳和命令結果
                                messageText = messageText
                                    .replace(/\{timestamp\}/g, timestamp)
                                    .replace('{command_response_content}', result || '無響應');

                                console.log('處理後的訊息:', messageText);

                                // 發送訊息
                                await sock.sendMessage(jid, { text: messageText });
                                console.log('訊息發送成功');
                            } catch (error) {
                                console.error('執行命令或發送訊息時出錯:', error);
                                await sock.sendMessage(jid, { 
                                    text: `執行錯誤: ${error.message}` 
                                });
                            }
                        } else {
                            await sock.sendMessage(jid, { text: task.message });
                        }

                        if (task.executionType === 'once') {
                            task.enabled = false;
                            await saveTasks();
                            const taskSchedulers = scheduledTasks.get(task.id);
                            if (taskSchedulers) {
                                taskSchedulers.forEach(s => s.stop());
                                scheduledTasks.delete(task.id);
                            }
                            console.log(`單次任務 "${task.title}" 已完成並禁用`);
                        }
                    } catch (error) {
                        console.error(`任務執行失敗: ${error.message}`);
                        try {
                            await sock.sendMessage(jid, { 
                                text: `任務執行失敗: ${error.message}` 
                            });
                        } catch (sendError) {
                            console.error('無法發送錯誤通知:', sendError);
                        }
                    }
                });

                if (!scheduledTasks.has(task.id)) {
                    scheduledTasks.set(task.id, new Set());
                }
                scheduledTasks.get(task.id).add(scheduler);
            } catch (cronError) {
                console.error(`創建調度器失敗: ${cronError.message}`);
            }
        });
    } catch (error) {
        console.error(`調度任務失敗: ${error.message}`);
    }
}

// 修改初始化任務函數
function initTasks() {
    // 停止所有現有的調度器
    for (const schedulers of scheduledTasks.values()) {
        schedulers.forEach(scheduler => scheduler.stop());
    }
    scheduledTasks.clear();

    console.log('初始化任務調度...');
    tasks.forEach(task => {
        if (task.enabled) {
            scheduleTask(task);
        }
    });
    console.log(`已初始化 ${tasks.length} 個任務`);
}

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
        
        const logger = pino({ 
            level: 'silent'  // 減少日誌輸出
        });

        sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger,
            browser: Browsers.macOS('Desktop'),
            connectTimeoutMs: 60000,
            qrTimeout: 60000,
            syncFullHistory: false,
            cachedGroupMetadata: async (jid) => {
                return groupCache.get(jid);
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr: currentQr } = update;
            
            if(currentQr) {
                console.log('收到新的 QR code，等待掃描...');
                qr = currentQr;
                isConnected = false;
            }

            if(connection === 'open') {
                console.log('WhatsApp 連接成功！');
                isConnected = true;
                qr = null;

                try {
                    const { pushName, name } = sock.user;
                    userInfo = {
                        name: pushName || name || '未知用戶',
                        id: sock.user.id
                    };
                    console.log('用戶信息:', userInfo);
                    
                    setTimeout(() => {
                        try {
                            initTasks();
                            console.log('任務初始化完成');
                        } catch (error) {
                            console.error('任務初始化失敗:', error);
                        }
                    }, 2000);
                } catch (error) {
                    console.error('獲取用戶信息失敗:', error);
                }
            }

            if(connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log('連接關閉，狀態碼:', statusCode);
                
                isConnected = false;
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if(shouldReconnect) {
                    console.log('嘗試重新連接...');
                    if(sock) {
                        sock.ev.removeAllListeners();
                        sock = null;
                    }
                    setTimeout(connectToWhatsApp, 3000);
                } else {
                    console.log('需要重新掃描 QR code');
                    if(sock) {
                        sock.ev.removeAllListeners();
                        sock = null;
                    }
                    qr = null;
                }

                if (emailConfig.enabled) {
                    await sendEmailAlert(
                        'WhatsApp 連接斷開警報',
                        `WhatsApp 連接已斷開\n時間: ${new Date().toLocaleString()}\n原因: ${lastDisconnect?.error?.message || '未知'}`
                    );
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // 在連接成功後設置消息處理器
        sock.ev.on('messages.upsert', async ({ messages }) => {
            for (const message of messages) {
                await handleIncomingMessage(message);
            }
        });

    } catch (error) {
        console.error('連接過程中發生錯誤:', error);
        
        if(sock) {
            sock.ev.removeAllListeners();
            sock = null;
        }
        setTimeout(connectToWhatsApp, 3000);
    }
}

// 獲取 QR Code 的端點
app.get('/qr', (req, res) => {
    // 只在狀態改變時輸出日誌
    const currentStatus = `${!!qr}-${isConnected}`;
    
    if (lastStatus !== currentStatus) {
        console.log('連接狀態更新:', { 
            hasQR: !!qr, 
            isConnected, 
            qrLength: qr ? qr.length : 0 
        });
        lastStatus = currentStatus;
    }
    
    res.header('Cache-Control', 'no-store');
    
    if (qr) {
        res.json({ 
            qr,
            isConnected: false,
            timestamp: Date.now()
        });
    } else if (isConnected) {
        res.json({ 
            isConnected: true,
            userInfo,  // 添加用戶信息
            timestamp: Date.now()
        });
    } else {
        res.json({ 
            message: '等待 QR Code 生成...',
            isConnected: false,
            timestamp: Date.now()
        });
    }
});

// 修改群組列表端點以使用緩存
app.get('/groups', async (req, res) => {
    if (!sock || !isConnected) {
        return res.status(400).json({ 
            error: 'WhatsApp 未連接',
            groups: [] 
        });
    }

    try {
        console.log('正在獲取群組...');
        let groups;
        
        // 嘗試從緩存獲取
        const cachedGroups = groupCache.mget(groupCache.keys());
        if (Object.keys(cachedGroups).length > 0) {
            console.log('使用緩存的群組數據');
            groups = cachedGroups;
        } else {
            console.log('從 WhatsApp 獲取群組數據');
            groups = await sock.groupFetchAllParticipating();
            // 更新緩存
            for (const [jid, metadata] of Object.entries(groups)) {
                groupCache.set(jid, metadata);
            }
        }

        const groupList = Object.entries(groups).map(([id, group]) => ({
            id,
            name: group.subject || '未命名群組',
            participants: group.participants?.length || 0,
            creation: group.creation ? new Date(group.creation * 1000).toLocaleString() : '未知'
        }));

        res.json({ 
            groups: groupList,
            success: true,
            total: groupList.length,
            timestamp: Date.now(),
            fromCache: Object.keys(cachedGroups).length > 0
        });
    } catch (error) {
        console.error('獲取群組時發生錯誤:', error);
        res.status(500).json({ 
            error: '獲取群組失敗: ' + error.message,
            groups: []
        });
    }
});

// 修改設備列表端點
app.get('/devices', async (req, res) => {
    if (!sock || !isConnected) {
        return res.status(400).json({ 
            error: 'WhatsApp 未連接',
            devices: [] 
        });
    }

    try {
        console.log('正在獲取設備列表...');
        
        // 獲取當前連接信息
        const deviceList = [{
            id: 'current',
            name: 'Current Device',
            platform: 'Desktop',
            status: isConnected ? 'connected' : 'disconnected'
        }];
        
        // 如果需要更多設備信息，可以從 sock.authState.creds 獲取
        if (sock.authState?.creds) {
            console.log('設備憑證信息:', {
                platform: sock.authState.creds.platform,
                deviceId: sock.authState.creds.deviceId
            });
            
            // 更新設備信息
            deviceList[0].id = sock.authState.creds.deviceId || 'current';
            deviceList[0].platform = sock.authState.creds.platform || 'Desktop';
        }
        
        console.log('返回設備列表:', deviceList);
        
        res.json({ 
            devices: deviceList,
            success: true,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('獲取設備時發生錯誤:', error);
        res.status(500).json({ 
            error: '獲取設備失敗: ' + (error.message || '未知錯誤'),
            devices: [],
            errorDetail: error.stack
        });
    }
});

// 添加登出處理函數
async function handleLogout() {
    try {
        // 停止所有任務調度器
        for (const schedulers of scheduledTasks.values()) {
            schedulers.forEach(scheduler => scheduler.stop());
        }
        scheduledTasks.clear();

        // 移除所有事件監聽器
        if (sock) {
            sock.ev.removeAllListeners();
            sock = null;
        }

        // 清理認證文件
        const authFiles = await fsp.readdir(AUTH_FOLDER);
        for (const file of authFiles) {
            await fsp.unlink(path.join(AUTH_FOLDER, file));
        }

        // 重置狀態
        isConnected = false;
        qr = null;
        userInfo = null;

        console.log('登出成功，所有認證文件已清理');
        
        // 重新啟動連接
        setTimeout(connectToWhatsApp, 1000);
        
        return true;
    } catch (error) {
        console.error('登出過程中發生錯誤:', error);
        throw error;
    }
}

// 修改登出端點
app.post('/logout', async (req, res) => {
    try {
        await handleLogout();
        res.json({ success: true, message: '登出成功' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: '登出失敗: ' + error.message 
        });
    }
});

// 獲取任務列表
app.get('/tasks', (req, res) => {
    res.json({ tasks });
});

// 創建新任務
app.post('/tasks', async (req, res) => {
    const task = {
        id: uuidv4(),
        ...req.body,
        enabled: true,
        outputFilters: req.body.outputFilters || []  // 添加過濾規則字段
    };
    
    tasks.push(task);
    await saveTasks();
    scheduleTask(task);
    
    res.json({ success: true, task });
});

// 更新任務
app.put('/tasks/:id', async (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.params.id);
    if (taskIndex === -1) {
        return res.status(404).json({ error: '任務不存在' });
    }
    
    tasks[taskIndex] = { 
        ...tasks[taskIndex], 
        ...req.body,
        outputFilters: req.body.outputFilters || tasks[taskIndex].outputFilters || []
    };
    await saveTasks();
    scheduleTask(tasks[taskIndex]);
    
    res.json({ success: true, task: tasks[taskIndex] });
});

// 刪除任務
app.delete('/tasks/:id', async (req, res) => {
    const schedulers = scheduledTasks.get(req.params.id);
    if (schedulers) {
        schedulers.forEach(scheduler => scheduler.stop());
        scheduledTasks.delete(req.params.id);
    }
    
    tasks = tasks.filter(t => t.id !== req.params.id);
    await saveTasks();  // 保存到文件
    
    res.json({ success: true });
});

// 切換任務狀態
app.put('/tasks/:id/toggle', async (req, res) => {
    const task = tasks.find(t => t.id === req.params.id);
    if (!task) {
        return res.status(404).json({ error: '任務不存在' });
    }
    
    task.enabled = req.body.enabled;
    await saveTasks();  // 保存到文件
    
    if (task.enabled) {
        scheduleTask(task);
    } else {
        const schedulers = scheduledTasks.get(task.id);
        if (schedulers) {
            schedulers.forEach(scheduler => scheduler.stop());
            scheduledTasks.delete(task.id);
        }
    }
    
    res.json({ success: true, task });
});

// 修改測試發送端點
app.post('/tasks/:id/test', async (req, res) => {
    console.log('收到測試請求:', req.params.id);
    
    try {
        const task = req.body;  // 使用請求中的完整任務數據
        
        if (!sock || !isConnected) {
            return res.status(400).json({ 
                success: false, 
                error: 'WhatsApp 未連接' 
            });
        }

        const jid = formatWhatsAppId(task.targetId, task.targetType);
        console.log(`測試任務 "${task.title}" (${task.id}), 發送到: ${jid}`);

        if (task.taskType === 'executeSSH') {
            if (!task.sshCommand) {
                throw new Error('命令為空');
            }

            console.log('執行命令:', task.sshCommand);
            const result = await executeSSHCommand(task.sshCommand);
            console.log('命令執行結果:', result);

            // 獲取當前時間戳並替換模板
            const timestamp = formatTimestamp();
            const messageText = (task.message || '執行結果：\n{command_response_content}')
                .replace(/\{timestamp\}/g, timestamp)
                .replace('{command_response_content}', result || '無響應');

            console.log('準備發送的訊息:', messageText);
            await sock.sendMessage(jid, { text: messageText });
        } else {
            // 處理其他類型的任務
            await sock.sendMessage(jid, { text: task.message });
        }

        res.json({ 
            success: true, 
            message: '測試發送成功'
        });
    } catch (error) {
        console.error('測試發送失敗:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// 處理收到的訊息
async function handleIncomingMessage(message) {
    try {
        if (!message.message?.conversation) return;

        const messageText = message.message.conversation;
        const senderId = message.key.remoteJid;
        console.log(`收到訊息: ${messageText}, 來自: ${senderId}`);

        // 檢查是否有匹配的自定義動作
        const matchedActions = customActions.filter(action => {
            if (!action.enabled) return false;
            
            // 檢查來源是否匹配
            const sourceMatches = action.sourceType === 'group' 
                ? senderId.endsWith('@g.us') && senderId === action.sourceId
                : !senderId.endsWith('@g.us') && senderId.split('@')[0] === action.sourceId;
            
            // 檢查訊息內容是否匹配
            const messageMatches = messageText.toLowerCase() === action.triggerPattern.toLowerCase();
            
            return sourceMatches && messageMatches;
        });

        // 執行匹配的動作
        for (const action of matchedActions) {
            await handleCustomAction(action, senderId);
        }
    } catch (error) {
        console.error('處理訊息失敗:', error);
    }
}

// 修改處理自定義動作的部分
async function handleCustomAction(action, jid) {
    try {
        // 記錄執行的自定義動作
        console.log(`執行自定義動作: ${action.title}`);
        console.log(`執行指令: ${action.command}`);

        // 如果動作類型為 "reply"（或未指定，預設為回覆），直接回覆訊息
        if (!action.actionType || action.actionType === 'reply') {
            let messageText = action.replyMessage || action.responseTemplate || '';
            // 如果模板中包含 {timestamp}，替換為當前時間戳
            messageText = messageText.replace(/\{timestamp\}/g, formatTimestamp());

            if (!messageText || messageText.trim() === '') {
                messageText = '（沒有設定回覆訊息）';
            }

            await sock.sendMessage(jid, { text: messageText });
            console.log('已發送回覆訊息');
            return;
        }

        // 如果動作類型為 "executeSSH" 或 "command"，則需要執行命令
        if (action.actionType === 'executeSSH' || action.actionType === 'command') {
            // 檢查命令是否存在
            if (!action.command || typeof action.command !== 'string' || action.command.trim() === '') {
                console.error('自定義動作命令為空或未定義:', action);
                await sock.sendMessage(jid, { 
                    text: `錯誤：自定義動作 "${action.title}" 的命令未設定或為空` 
                });
                return;
            }

            // 執行命令
            const result = await executeSSHCommand(action.command, action.outputFilters);
            
            // 處理訊息模板（若未提供，使用默認模板）
            let messageText = action.responseTemplate || '{command_response_content}';
            messageText = messageText
                .replace(/\{timestamp\}/g, formatTimestamp())
                .replace('{command_response_content}', result);

            // 發送訊息
            await sock.sendMessage(jid, { text: messageText });
            console.log('自定義動作執行完成，已發送回應');
            return;
        }

        // 其他未知 actionType 的處理
        console.warn(`未知的自定義動作類型: ${action.actionType}`);
        await sock.sendMessage(jid, { 
            text: `錯誤：未知的自定義動作類型 (${action.actionType})` 
        });

    } catch (error) {
        console.error('執行自定義動作失敗:', error);
        await sock.sendMessage(jid, { 
            text: `執行失敗: ${error.message}` 
        });
    }
}

// 添加自定義動作的 API 端點
app.get('/custom-actions', (req, res) => {
    res.json({ actions: customActions });
});

app.post('/custom-actions', async (req, res) => {
    const action = {
        id: uuidv4(),
        ...req.body,
        enabled: true
    };
    
    customActions.push(action);
    await saveCustomActions();
    
    res.json({ success: true, action });
});

app.put('/custom-actions/:id', async (req, res) => {
    const actionIndex = customActions.findIndex(a => a.id === req.params.id);
    if (actionIndex === -1) {
        return res.status(404).json({ error: '動作不存在' });
    }
    
    customActions[actionIndex] = { ...customActions[actionIndex], ...req.body };
    await saveCustomActions();
    
    res.json({ success: true, action: customActions[actionIndex] });
});

app.delete('/custom-actions/:id', async (req, res) => {
    customActions = customActions.filter(a => a.id !== req.params.id);
    await saveCustomActions();
    
    res.json({ success: true });
});

app.put('/custom-actions/:id/toggle', async (req, res) => {
    const action = customActions.find(a => a.id === req.params.id);
    if (!action) {
        return res.status(404).json({ error: '動作不存在' });
    }
    
    action.enabled = req.body.enabled;
    await saveCustomActions();
    
    res.json({ success: true, action });
});

// 修改電子郵件設定路由
app.post('/api/email-config', async (req, res) => {
    try {
        const { enabled, email, smtp } = req.body;
        emailConfig = { enabled, email, smtp };
        
        // 更新配置文件
        config.email = {
            enabled,
            address: email,
            smtp
        };
        await saveConfig();
        
        res.json({ success: true, message: '電子郵件設定已更新' });
    } catch (error) {
        console.error('更新電子郵件設定失敗:', error);
        res.status(500).json({ success: false, message: '更新設定失敗' });
    }
});

app.get('/api/email-config', async (req, res) => {
    try {
        res.json({
            enabled: config.email.enabled,
            email: config.email.address,
            smtp: config.email.smtp
        });
    } catch (error) {
        console.error('獲取電子郵件設定失敗:', error);
        res.status(500).json({ success: false, message: '獲取設定失敗' });
    }
});

// 添加測試電子郵件端點
app.post('/api/email-config/test', async (req, res) => {
    try {
        const { email, smtp } = req.body;
        const testConfig = {
            enabled: true,
            email,
            smtp
        };

        // 暫時保存當前配置
        const currentConfig = { ...emailConfig };
        
        // 使用測試配置
        emailConfig = testConfig;

        // 發送測試郵件
        await sendEmailAlert(
            'WhatsApp 監控系統 - 測試郵件',
            '這是一封測試郵件，用於驗證您的電子郵件設定是否正確。\n\n如果您收到這封郵件，說明您的設定已經成功。'
        );

        // 恢復原始配置
        emailConfig = currentConfig;

        res.json({ success: true, message: '測試郵件已發送' });
    } catch (error) {
        console.error('發送測試郵件失敗:', error);
        res.status(500).json({ success: false, message: '發送測試郵件失敗: ' + error.message });
    }
});

// 添加服務器配置路由
app.post('/api/server-config', async (req, res) => {
    try {
        const { host } = req.body;
        config.server.host = host;
        await saveConfig();
        res.json({ success: true, message: '服務器設定已更新' });
    } catch (error) {
        console.error('更新服務器設定失敗:', error);
        res.status(500).json({ success: false, message: '更新設定失敗' });
    }
});

app.get('/api/server-config', async (req, res) => {
    try {
        res.json(config.server);
    } catch (error) {
        console.error('獲取服務器設定失敗:', error);
        res.status(500).json({ success: false, message: '獲取設定失敗' });
    }
});

// 在服務器啟動時載入配置
app.listen(3001, async () => {
    console.log('服務器已啟動在端口 3001');
    await loadConfig();
    await loadTasks();
    await loadCustomActions();
    connectToWhatsApp().catch(error => {
        console.error('啟動服務器失敗:', error);
    });
});