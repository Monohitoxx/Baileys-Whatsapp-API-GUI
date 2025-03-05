import { useState, useEffect } from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';

// 使用固定的默認值
const DEFAULT_SERVER_HOST = 'http://192.168.118.76:3001';

let API_BASE_URL = DEFAULT_SERVER_HOST;

export function setApiBaseUrl(url: string) {
    API_BASE_URL = url;
    if (typeof window !== 'undefined') {
        window.API_BASE_URL = url;
    }
}

export function getApiBaseUrl(): string {
    return API_BASE_URL;
}

export function Settings() {
    const [serverHost, setServerHost] = useState(getApiBaseUrl());
    const [testStatus, setTestStatus] = useState<'none' | 'testing' | 'success' | 'error'>('none');
    const [errorMessage, setErrorMessage] = useState('');
    const [emailAlertEnabled, setEmailAlertEnabled] = useState(false);
    const [emailAddress, setEmailAddress] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [smtpConfig, setSmtpConfig] = useState({
        host: '',
        port: '',
        username: '',
        password: '',
    });

    useEffect(() => {
        // 從服務器讀取配置
        const fetchConfig = async () => {
            try {
                // 使用默認地址獲取服務器配置
                const serverResponse = await fetch(`${DEFAULT_SERVER_HOST}/api/server-config`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });
                
                if (serverResponse.ok) {
                    const serverConfig = await serverResponse.json();
                    // 更新全局 API URL
                    setApiBaseUrl(serverConfig.host);
                    setServerHost(serverConfig.host);

                    // 使用獲取到的服務器地址讀取郵件配置
                    const emailResponse = await fetch(`${serverConfig.host}/api/email-config`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    if (emailResponse.ok) {
                        const config = await emailResponse.json();
                        setEmailAlertEnabled(config.enabled || false);
                        setEmailAddress(config.email || '');
                        setSmtpConfig({
                            host: config.smtp?.host || '',
                            port: config.smtp?.port || '',
                            username: config.smtp?.username || '',
                            password: config.smtp?.password || '',
                        });
                    }
                }
            } catch (error) {
                console.error('讀取配置失敗:', error);
                // 如果獲取失敗，使用默認值
                setServerHost(DEFAULT_SERVER_HOST);
            }
        };

        fetchConfig();
        
        // 讀取主題設定
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
        setIsDarkMode(shouldUseDark);
    }, []);

    const toggleTheme = () => {
        const newDarkMode = !isDarkMode;
        setIsDarkMode(newDarkMode);
        
        // 保存主題設定到 localStorage
        localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
        
        // 更新 DOM 類別
        document.documentElement.classList.toggle('dark', newDarkMode);
        if (newDarkMode) {
            document.body.classList.add('bg-gray-900');
            document.body.classList.remove('bg-white');
        } else {
            document.body.classList.remove('bg-gray-900');
            document.body.classList.add('bg-white');
        }
    };

    const testConnection = async () => {
        setTestStatus('testing');
        setErrorMessage('');
        try {
            const response = await fetch(`${serverHost}/qr`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('服務器響應錯誤');
            }
            await response.json();
            setTestStatus('success');
        } catch (error) {
            setTestStatus('error');
            setErrorMessage(error instanceof Error ? error.message : '連接失敗');
        }
    };

    const handleSaveHost = async () => {
        try {
            // 先保存服務器設定
            const currentApiUrl = getApiBaseUrl(); // 使用當前的 API URL
            console.log('使用當前 API URL:', currentApiUrl);
            
            const serverResponse = await fetch(`${currentApiUrl}/api/server-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    host: serverHost
                })
            });

            if (!serverResponse.ok) {
                const errorData = await serverResponse.text();
                throw new Error(`保存服務器設定失敗: ${errorData}`);
            }

            // 更新全局 API URL
            setApiBaseUrl(serverHost);
            console.log('更新後的 API URL:', serverHost);

            // 使用新的服務器地址保存電子郵件設定
            const emailResponse = await fetch(`${currentApiUrl}/api/email-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    enabled: emailAlertEnabled,
                    email: emailAddress,
                    smtp: smtpConfig
                })
            });

            if (!emailResponse.ok) {
                const errorData = await emailResponse.text();
                throw new Error(`保存電子郵件設定失敗: ${errorData}`);
            }

            alert('設定已更新，系統將在 3 秒後重新載入...');
            // 延遲重新載入，讓用戶看到成功消息
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error('保存設定失敗:', error);
            alert('保存設定失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        }
    };

    const handleTestEmail = async () => {
        try {
            const response = await fetch(`${serverHost}/api/email-config/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: emailAddress,
                    smtp: smtpConfig,
                }),
            });

            if (!response.ok) {
                throw new Error('測試郵件發送失敗');
            }

            alert('測試郵件發送成功！請檢查您的郵箱。');
        } catch (error) {
            alert('測試郵件發送失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        }
    };

    return (
        <div className="space-y-6 dark:text-gray-100 min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">系統設置</h2>
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title={isDarkMode ? '切換到淺色主題' : '切換到深色主題'}
                >
                    {isDarkMode ? <FaSun className="w-5 h-5" /> : <FaMoon className="w-5 h-5" />}
                </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium mb-2">WhatsApp API 版本資訊</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                    目前使用版本：@whiskeysockets/baileys v6.7.13
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    最新版本資訊可在 <a href="https://github.com/WhiskeySockets/Baileys/releases" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600 dark:text-blue-400">GitHub Releases</a> 頁面查看
                </p>
            </div>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                        服務器地址
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={serverHost}
                            onChange={(e) => setServerHost(e.target.value)}
                            className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="輸入服務器地址"
                        />
                        <button
                            onClick={testConnection}
                            className={`px-4 py-2 rounded ${
                                testStatus === 'testing' 
                                    ? 'bg-gray-500'
                                    : 'bg-blue-500 hover:bg-blue-600'
                            } text-white`}
                            disabled={testStatus === 'testing'}
                        >
                            {testStatus === 'testing' ? '測試中...' : '測試連接'}
                        </button>
                        <button
                            onClick={handleSaveHost}
                            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                            保存
                        </button>
                    </div>
                    <div className="mt-2">
                        {testStatus === 'success' && (
                            <p className="text-green-600 dark:text-green-400">連接成功！</p>
                        )}
                        {testStatus === 'error' && (
                            <p className="text-red-600 dark:text-red-400">連接失敗：{errorMessage}</p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            默認: http://localhost:3001
                        </p>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <h3 className="text-lg font-medium mb-4">電子郵件警報設定</h3>
                    <div className="space-y-4">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="emailAlert"
                                checked={emailAlertEnabled}
                                onChange={(e) => setEmailAlertEnabled(e.target.checked)}
                                className="h-4 w-4 text-blue-600 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                            />
                            <label htmlFor="emailAlert" className="ml-2 text-sm font-medium dark:text-gray-200">
                                啟用 WhatsApp 斷開連接電子郵件警報
                            </label>
                        </div>
                        
                        {emailAlertEnabled && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                        警報接收郵箱
                                    </label>
                                    <input
                                        type="email"
                                        value={emailAddress}
                                        onChange={(e) => setEmailAddress(e.target.value)}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="輸入電子郵件地址"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                        SMTP 服務器
                                    </label>
                                    <input
                                        type="text"
                                        value={smtpConfig.host}
                                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, host: e.target.value }))}
                                        className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="例如: smtp.gmail.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                        SMTP 端口
                                    </label>
                                    <input
                                        type="text"
                                        value={smtpConfig.port}
                                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, port: e.target.value }))}
                                        className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="例如: 587"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                        SMTP 用戶名
                                    </label>
                                    <input
                                        type="text"
                                        value={smtpConfig.username}
                                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="輸入 SMTP 用戶名"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                        SMTP 密碼
                                    </label>
                                    <input
                                        type="password"
                                        value={smtpConfig.password}
                                        onChange={(e) => setSmtpConfig(prev => ({ ...prev, password: e.target.value }))}
                                        className="w-full p-2 border rounded mb-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="輸入 SMTP 密碼"
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleTestEmail}
                                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                    >
                                        測試郵件
                                    </button>
                                    <button
                                        onClick={handleSaveHost}
                                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        保存設定
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 