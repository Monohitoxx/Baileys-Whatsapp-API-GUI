import { useState, useEffect } from 'react';
import { FaClock, FaTrash, FaEdit, FaWhatsapp, FaUsers } from 'react-icons/fa';
import { getApiBaseUrl } from '../config';

interface Task {
    id: string;
    title: string;
    taskType: 'sendMessage' | 'deleteMessage' | 'forwardMessage' | 'executeSSH';
    executionType: 'once' | 'repeat';
    times: string[];
    repeatCount: number;
    message: string;
    targetType: 'user' | 'group';
    targetId: string;
    targetName: string;
    enabled: boolean;
    sshCommand?: string;
    sshResponseTemplate?: string;
    outputFilters?: string[];  // 新增：輸出過濾規則
    executionDays: {
        type: 'everyday' | 'weekly' | 'monthly' | 'specific';
        days: number[];  // 對於 weekly：0-6 代表週日到週六；對於 monthly：1-31 代表日期
        specificDates?: string[];  // 新增：特定日期陣列，格式為 YYYY-MM-DD
    };
}

interface ScheduledTasksProps {
    isConnected: boolean;
    groups: Array<{id: string, name: string}>;
}

export function ScheduledTasks({ isConnected, groups }: ScheduledTasksProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const defaultSshTemplate = '執行時間：{timestamp}\n執行結果：\n{command_response_content}';

    const [newTask, setNewTask] = useState<Omit<Task, 'id'>>({
        title: '',
        taskType: 'sendMessage',
        executionType: 'once',
        times: [''],
        repeatCount: 1,
        message: '',
        targetType: 'user',
        targetId: '',
        targetName: '',
        enabled: true,
        sshResponseTemplate: defaultSshTemplate,
        outputFilters: [],  // 初始化空的過濾規則陣列
        executionDays: {
            type: 'everyday',
            days: [],
            specificDates: []
        }
    });

    // 添加星期幾的選項
    const weekDays = [
        { value: 0, label: '週日' },
        { value: 1, label: '週一' },
        { value: 2, label: '週二' },
        { value: 3, label: '週三' },
        { value: 4, label: '週四' },
        { value: 5, label: '週五' },
        { value: 6, label: '週六' }
    ];

    // 生成月份日期選項（1-31）
    const monthDays = Array.from({ length: 31 }, (_, i) => ({
        value: i + 1,
        label: `${i + 1}日`
    }));

    // 處理執行類型的切換
    const handleExecutionTypeChange = (type: 'everyday' | 'weekly' | 'monthly' | 'specific') => {
        setNewTask(prev => ({
            ...prev,
            executionDays: {
                type,
                days: [],
                specificDates: type === 'specific' ? [] : undefined
            }
        }));
    };

    // 處理日期的切換
    const handleDayToggle = (day: number) => {
        setNewTask(prev => {
            const currentDays = prev.executionDays.days;
            const newDays = currentDays.includes(day)
                ? currentDays.filter(d => d !== day)
                : [...currentDays, day].sort((a, b) => a - b);

            return {
                ...prev,
                executionDays: {
                    ...prev.executionDays,
                    days: newDays
                }
            };
        });
    };

    // 添加處理特定日期的函數
    const handleSpecificDateAdd = (date: string) => {
        setNewTask(prev => ({
            ...prev,
            executionDays: {
                ...prev.executionDays,
                specificDates: [...(prev.executionDays.specificDates || []), date].sort()
            }
        }));
    };

    const handleSpecificDateRemove = (date: string) => {
        setNewTask(prev => ({
            ...prev,
            executionDays: {
                ...prev.executionDays,
                specificDates: prev.executionDays.specificDates?.filter(d => d !== date) || []
            }
        }));
    };

    // 獲取任務列表
    const fetchTasks = async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/tasks`);
            if (!response.ok) throw new Error('獲取任務失敗');
            const data = await response.json();
            setTasks(data.tasks);
        } catch (error) {
            console.error('獲取任務失敗:', error);
        }
    };

    // 修改驗證函數
    const validateTask = (task: Omit<Task, 'id'>): string[] => {
        const errors: string[] = [];
        
        if (!task.title.trim()) errors.push('請輸入任務標題');
        if (!task.message.trim()) errors.push('請輸入訊息內容');
        if (!task.targetId.trim()) errors.push('請選擇目標' + (task.targetType === 'user' ? '用戶' : '群組'));
        
        // 檢查時間設定
        if (!task.times || task.times.length === 0 || !task.times[0]) {
            errors.push('請設定執行時間');
        } else {
            task.times.forEach((time, index) => {
                if (!time) errors.push(`第 ${index + 1} 個執行時間未設定`);
            });
        }

        // 檢查執行日期設定
        if (task.executionDays.type !== 'everyday' && task.executionDays.days.length === 0) {
            errors.push('請選擇執行日期');
        }

        // 如果是 SSH 命令類型，檢查命令
        if (task.taskType === 'executeSSH' && !task.sshCommand?.trim()) {
            errors.push('請輸入要執行的命令');
        }

        return errors;
    };

    // 修改保存任務函數
    const handleSaveTask = async () => {
        const errors = validateTask(newTask);
        if (errors.length > 0) {
            alert('請填寫必要資訊：\n' + errors.join('\n'));
            return;
        }

        try {
            const url = editingTask 
                ? `${getApiBaseUrl()}/tasks/${editingTask.id}`
                : `${getApiBaseUrl()}/tasks`;
            
            const response = await fetch(url, {
                method: editingTask ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });

            if (!response.ok) throw new Error('保存任務失敗');
            
            fetchTasks();
            setShowForm(false);
            setEditingTask(null);
            setNewTask({
                title: '',
                taskType: 'sendMessage',
                executionType: 'once',
                times: [''],
                repeatCount: 1,
                message: '',
                targetType: 'user',
                targetId: '',
                targetName: '',
                enabled: true,
                sshResponseTemplate: defaultSshTemplate,
                outputFilters: [],
                executionDays: {
                    type: 'everyday',
                    days: [],
                    specificDates: []
                }
            });
        } catch (error) {
            console.error('保存任務失敗:', error);
            alert('保存任務失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        }
    };

    // 刪除任務
    const handleDeleteTask = async (id: string) => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/tasks/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('刪除任務失敗');
            fetchTasks();
        } catch (error) {
            console.error('刪除任務失敗:', error);
        }
    };

    // 切換任務狀態
    const handleToggleTask = async (id: string, enabled: boolean) => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/tasks/${id}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            if (!response.ok) throw new Error('切換任務狀態失敗');
            fetchTasks();
        } catch (error) {
            console.error('切換任務狀態失敗:', error);
        }
    };

    // 修改測試發送函數
    const handleTestSend = async (task: Task) => {
        try {
            console.log('開始測試發送任務:', task);
            
            const response = await fetch(`${getApiBaseUrl()}/tasks/${task.id}/test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(task)
            });

            if (!response.ok) {
                throw new Error('測試發送失敗');
            }

            const result = await response.json();
            console.log('測試發送結果:', result);
        } catch (error) {
            console.error('測試發送錯誤:', error);
        }
    };

    // 格式化顯示執行日期
    const formatExecutionDays = (executionDays: Task['executionDays']) => {
        switch (executionDays.type) {
            case 'everyday':
                return '每天';
            case 'weekly':
                return executionDays.days
                    .map(day => weekDays[day].label)
                    .join('、');
            case 'monthly':
                return executionDays.days
                    .map(day => `${day}日`)
                    .join('、');
            case 'specific':
                return executionDays.specificDates?.map(date => {
                    const d = new Date(date);
                    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                }).join('、') || '未設定日期';
            default:
                return '未設定';
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchTasks();
        }
    }, [isConnected]);

    if (!isConnected) {
        return (
            <div className="text-gray-500 dark:text-gray-400">
                請先連接 WhatsApp
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold dark:text-gray-100">定時任務</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    新增任務
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
                        <h3 className="text-lg font-bold mb-4 dark:text-gray-100">
                            {editingTask ? '編輯任務' : '新增任務'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">任務標題</label>
                                <input
                                    type="text"
                                    value={newTask.title}
                                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    placeholder="請輸入任務標題"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">任務類型</label>
                                <select
                                    value={newTask.taskType}
                                    onChange={e => {
                                        const taskType = e.target.value as Task['taskType'];
                                        setNewTask({
                                            ...newTask,
                                            taskType,
                                            message: taskType === 'executeSSH' ? defaultSshTemplate : '',
                                            sshResponseTemplate: taskType === 'executeSSH' ? defaultSshTemplate : undefined
                                        });
                                    }}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                >
                                    <option value="sendMessage">發送訊息</option>
                                    <option value="deleteMessage">刪除訊息</option>
                                    <option value="forwardMessage">轉發訊息</option>
                                    <option value="executeSSH">執行命令</option>
                                </select>
                            </div>
                            {newTask.taskType === 'executeSSH' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">命令</label>
                                        <input
                                            type="text"
                                            value={newTask.sshCommand || ''}
                                            onChange={e => setNewTask({...newTask, sshCommand: e.target.value})}
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                            placeholder="例如: plink -batch user@host -pwfile pw.txt 'command'"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            輸入完整的命令，包括連接設置和要執行的指令
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">輸出過濾規則</label>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="輸入要過濾的文字或正則表達式"
                                                    className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                                                            e.preventDefault();
                                                            const newFilter = (e.target as HTMLInputElement).value.trim();
                                                            setNewTask(prev => ({
                                                                ...prev,
                                                                outputFilters: [...(prev.outputFilters || []), newFilter]
                                                            }));
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                                    onClick={(e) => {
                                                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                                                        if (input.value.trim()) {
                                                            setNewTask(prev => ({
                                                                ...prev,
                                                                outputFilters: [...(prev.outputFilters || []), input.value.trim()]
                                                            }));
                                                            input.value = '';
                                                        }
                                                    }}
                                                >
                                                    添加
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {newTask.outputFilters?.map((filter, index) => (
                                                    <div key={index} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                        <span className="text-sm text-gray-700 dark:text-gray-200">
                                                            {filter}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setNewTask(prev => ({
                                                                    ...prev,
                                                                    outputFilters: prev.outputFilters?.filter((_, i) => i !== index)
                                                                }));
                                                            }}
                                                            className="text-red-500 hover:text-red-600"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                每行輸出如果包含這些文字或匹配這些正則表達式，將被過濾掉。按 Enter 或點擊添加按鈕來新增規則。
                                                使用 /pattern/ 格式來指定正則表達式。
                                            </p>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">響應訊息模板</label>
                                        <textarea
                                            value={newTask.message}
                                            onChange={e => setNewTask({...newTask, message: e.target.value})}
                                            className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                            placeholder="使用 {command_response_content} 作為命令響應內容的佔位符，{timestamp} 作為當前時間"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            使用 {'{command_response_content}'} 來插入命令的執行結果<br/>
                                            使用 {'{timestamp}'} 來插入當前時間
                                        </p>
                                    </div>
                                </>
                            )}
                            {newTask.taskType !== 'executeSSH' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">訊息內容</label>
                                    <textarea
                                        value={newTask.message}
                                        onChange={e => setNewTask({...newTask, message: e.target.value})}
                                        className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                        placeholder="輸入要發送的訊息"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">執行方式</label>
                                <div className="flex items-center space-x-4 mt-2">
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            name="executionType"
                                            value="once"
                                            checked={newTask.executionType === 'once'}
                                            onChange={() => setNewTask({
                                                ...newTask,
                                                executionType: 'once',
                                                times: [''],
                                                repeatCount: 1
                                            })}
                                            className="form-radio h-4 w-4 text-blue-600"
                                        />
                                        <span className="ml-2 text-gray-700 dark:text-gray-200">單次執行</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            name="executionType"
                                            value="repeat"
                                            checked={newTask.executionType === 'repeat'}
                                            onChange={() => setNewTask({
                                                ...newTask,
                                                executionType: 'repeat',
                                                times: [''],
                                                repeatCount: 1
                                            })}
                                            className="form-radio h-4 w-4 text-blue-600"
                                        />
                                        <span className="ml-2 text-gray-700 dark:text-gray-200">重複執行</span>
                                    </label>
                                </div>
                            </div>
                            {newTask.executionType === 'repeat' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">重複次數</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={newTask.repeatCount}
                                        onChange={(e) => {
                                            const count = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                                            setNewTask({
                                                ...newTask,
                                                repeatCount: count,
                                                times: Array(count).fill('').map((_, i) => newTask.times?.[i] || '')
                                            });
                                        }}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                    {newTask.executionType === 'once' ? '執行時間' : '執行時間列表'}
                                </label>
                                {newTask.times?.map((time, index) => (
                                    <div key={index} className="mb-2">
                                        <div className="flex items-center space-x-2">
                                            <input
                                                type="time"
                                                value={time || ''}
                                                onChange={(e) => {
                                                    const newTimes = [...(newTask.times || [''])];
                                                    newTimes[index] = e.target.value;
                                                    setNewTask({...newTask, times: newTimes});
                                                }}
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                            />
                                            {newTask.executionType === 'repeat' && (
                                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                                    第 {index + 1} 次
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">目標類型</label>
                                <select
                                    value={newTask.targetType}
                                    onChange={e => setNewTask({...newTask, targetType: e.target.value as 'user' | 'group'})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                >
                                    <option value="user">用戶</option>
                                    <option value="group">群組</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                    {newTask.targetType === 'user' ? '用戶 ID' : '選擇群組'}
                                </label>
                                {newTask.targetType === 'group' ? (
                                    <select
                                        value={newTask.targetId}
                                        onChange={e => setNewTask({...newTask, targetId: e.target.value})}
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    >
                                        <option value="">選擇群組</option>
                                        {groups.map(group => (
                                            <option key={group.id} value={group.id}>
                                                {group.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={newTask.targetId}
                                        onChange={e => setNewTask({...newTask, targetId: e.target.value})}
                                        placeholder="輸入用戶 ID"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    />
                                )}
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-2 dark:text-gray-200">執行日期</label>
                                <div className="space-y-4">
                                    <div className="flex space-x-4">
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                checked={newTask.executionDays.type === 'everyday'}
                                                onChange={() => handleExecutionTypeChange('everyday')}
                                                className="form-radio h-4 w-4 text-blue-600"
                                            />
                                            <span className="ml-2 text-gray-700 dark:text-gray-200">每天</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                checked={newTask.executionDays.type === 'weekly'}
                                                onChange={() => handleExecutionTypeChange('weekly')}
                                                className="form-radio h-4 w-4 text-blue-600"
                                            />
                                            <span className="ml-2 text-gray-700 dark:text-gray-200">每週</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                checked={newTask.executionDays.type === 'monthly'}
                                                onChange={() => handleExecutionTypeChange('monthly')}
                                                className="form-radio h-4 w-4 text-blue-600"
                                            />
                                            <span className="ml-2 text-gray-700 dark:text-gray-200">每月</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="radio"
                                                checked={newTask.executionDays.type === 'specific'}
                                                onChange={() => handleExecutionTypeChange('specific')}
                                                className="form-radio h-4 w-4 text-blue-600"
                                            />
                                            <span className="ml-2 text-gray-700 dark:text-gray-200">特定日期</span>
                                        </label>
                                    </div>
                                    
                                    {newTask.executionDays.type === 'weekly' && (
                                        <div className="grid grid-cols-4 gap-2">
                                            {weekDays.map(day => (
                                                <label key={day.value} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={newTask.executionDays.days.includes(day.value)}
                                                        onChange={() => handleDayToggle(day.value)}
                                                        className="form-checkbox h-4 w-4 text-blue-600"
                                                    />
                                                    <span className="ml-2 text-gray-700 dark:text-gray-200">{day.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}

                                    {newTask.executionDays.type === 'monthly' && (
                                        <div className="grid grid-cols-7 gap-2 max-h-48 overflow-y-auto">
                                            {monthDays.map(day => (
                                                <label key={day.value} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={newTask.executionDays.days.includes(day.value)}
                                                        onChange={() => handleDayToggle(day.value)}
                                                        className="form-checkbox h-4 w-4 text-blue-600"
                                                    />
                                                    <span className="ml-2 text-gray-700 dark:text-gray-200">{day.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {newTask.executionDays.type === 'specific' && (
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    handleSpecificDateAdd(e.target.value);
                                                    e.target.value = ''; // 清空輸入
                                                }
                                            }}
                                            className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {newTask.executionDays.specificDates?.map(date => (
                                            <div key={date} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                                    {new Date(date).toLocaleDateString('zh-TW', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </span>
                                                <button
                                                    onClick={() => handleSpecificDateRemove(date)}
                                                    className="text-red-500 hover:text-red-600"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end space-x-2">
                                <button
                                    onClick={() => {
                                        setShowForm(false);
                                        setEditingTask(null);
                                        setNewTask({
                                            title: '',
                                            taskType: 'sendMessage',
                                            executionType: 'once',
                                            times: [''],
                                            repeatCount: 1,
                                            message: '',
                                            targetType: 'user',
                                            targetId: '',
                                            targetName: '',
                                            enabled: true,
                                            sshResponseTemplate: defaultSshTemplate,
                                            outputFilters: [],
                                            executionDays: {
                                                type: 'everyday',
                                                days: [],
                                                specificDates: []
                                            }
                                        });
                                    }}
                                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSaveTask}
                                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                >
                                    保存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {tasks.map(task => (
                    <div
                        key={task.id}
                        className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${
                            task.enabled 
                                ? 'bg-white dark:bg-gray-800' 
                                : 'bg-gray-50 dark:bg-gray-900'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <FaClock className="text-gray-500 dark:text-gray-400" />
                                <div>
                                    <h3 className="font-medium dark:text-gray-100">{task.title}</h3>
                                    <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 dark:text-gray-300">
                                            {task.taskType === 'sendMessage' ? '發送訊息' :
                                             task.taskType === 'deleteMessage' ? '刪除訊息' :
                                             task.taskType === 'forwardMessage' ? '轉發訊息' :
                                             task.taskType === 'executeSSH' ? '命令執行' : '未知類型'}
                                        </span>
                                        {task.taskType === 'executeSSH' && task.sshCommand && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                                命令: {task.sshCommand}
                                            </span>
                                        )}
                                        {task.executionType === 'once' ? (
                                            <span>{task.times?.[0] || ''}</span>
                                        ) : (
                                            <div className="flex flex-wrap gap-1">
                                                {(task.times || []).map((time, index) => (
                                                    <span key={index} className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-0.5 rounded">
                                                        {time}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                                            task.executionType === 'repeat' 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-gray-100 text-gray-700'
                                        }`}>
                                            {task.executionType === 'repeat' 
                                                ? `重複 ${task.repeatCount || 1} 次` 
                                                : '單次執行'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => handleTestSend(task)}
                                    className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                    測試
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingTask(task);
                                        setNewTask(task);
                                        setShowForm(true);
                                    }}
                                    className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => handleToggleTask(task.id, !task.enabled)}
                                    className={`px-2 py-1 rounded ${
                                        task.enabled
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-gray-500 hover:bg-gray-600'
                                    } text-white text-sm`}
                                >
                                    {task.enabled ? '啟用' : '禁用'}
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {task.targetType === 'user' ? (
                                    <FaWhatsapp className="mr-1" />
                                ) : (
                                    <FaUsers className="mr-1" />
                                )}
                                <span>{task.targetName}</span>
                            </div>
                            <p className="text-gray-700 dark:text-gray-300">{task.message}</p>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                執行日期：{formatExecutionDays(task.executionDays)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 