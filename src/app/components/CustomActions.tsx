import { useState, useEffect } from 'react';
import { FaTrash, FaEdit, FaWhatsapp, FaUsers } from 'react-icons/fa';
import { getApiBaseUrl } from '../config';

interface CustomAction {
    id: string;
    title: string;
    enabled: boolean;
    triggerType: 'message';  // 未來可以擴展其他觸發類型
    triggerPattern: string;  // 觸發的訊息內容
    sourceType: 'user' | 'group';
    sourceId: string;
    sourceName: string;
    actionType: 'command' | 'reply';  // 執行命令或回覆訊息
    command?: string;  // 要執行的命令
    replyMessage?: string;  // 要回覆的訊息
    responseTemplate?: string;  // 回應模板
}

interface CustomActionsProps {
    isConnected: boolean;
    groups: Array<{id: string, name: string}>;
}

export function CustomActions({ isConnected, groups }: CustomActionsProps) {
    const [actions, setActions] = useState<CustomAction[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingAction, setEditingAction] = useState<CustomAction | null>(null);
    const defaultTemplate = '執行時間：{timestamp}\n執行結果：\n{command_response_content}';

    const [newAction, setNewAction] = useState<Omit<CustomAction, 'id'>>({
        title: '',
        enabled: true,
        triggerType: 'message',
        triggerPattern: '',
        sourceType: 'user',
        sourceId: '',
        sourceName: '',
        actionType: 'reply',
        replyMessage: '',
        responseTemplate: defaultTemplate
    });

    // 獲取動作列表
    const fetchActions = async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/custom-actions`);
            if (!response.ok) throw new Error('獲取動作失敗');
            const data = await response.json();
            setActions(data.actions);
        } catch (error) {
            console.error('獲取動作失敗:', error);
        }
    };

    // 添加驗證函數
    const validateAction = (action: Omit<CustomAction, 'id'>): string[] => {
        const errors: string[] = [];
        
        if (!action.title.trim()) errors.push('請輸入動作標題');
        if (!action.triggerPattern.trim()) errors.push('請輸入觸發訊息');
        if (!action.sourceId.trim()) errors.push('請選擇來源' + (action.sourceType === 'user' ? '用戶' : '群組'));
        
        if (action.actionType === 'command') {
            if (!action.command?.trim()) errors.push('請輸入要執行的命令');
            if (!action.responseTemplate?.trim()) errors.push('請輸入回應模板');
        } else {
            if (!action.replyMessage?.trim()) errors.push('請輸入回覆訊息');
        }

        return errors;
    };

    // 修改保存動作函數
    const handleSaveAction = async () => {
        const errors = validateAction(newAction);
        if (errors.length > 0) {
            alert('請填寫必要資訊：\n' + errors.join('\n'));
            return;
        }

        try {
            const url = editingAction 
                ? `${getApiBaseUrl()}/custom-actions/${editingAction.id}`
                : `${getApiBaseUrl()}/custom-actions`;
            
            const response = await fetch(url, {
                method: editingAction ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAction)
            });

            if (!response.ok) throw new Error('保存動作失敗');
            
            fetchActions();
            setShowForm(false);
            setEditingAction(null);
            setNewAction({
                title: '',
                enabled: true,
                triggerType: 'message',
                triggerPattern: '',
                sourceType: 'user',
                sourceId: '',
                sourceName: '',
                actionType: 'reply',
                replyMessage: '',
                responseTemplate: defaultTemplate
            });
        } catch (error) {
            console.error('保存動作失敗:', error);
            alert('保存動作失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        }
    };

    // 刪除動作
    const handleDeleteAction = async (id: string) => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/custom-actions/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('刪除動作失敗');
            fetchActions();
        } catch (error) {
            console.error('刪除動作失敗:', error);
        }
    };

    // 切換動作狀態
    const handleToggleAction = async (id: string, enabled: boolean) => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/custom-actions/${id}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            if (!response.ok) throw new Error('切換動作狀態失敗');
            fetchActions();
        } catch (error) {
            console.error('切換動作狀態失敗:', error);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchActions();
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
                <h2 className="text-2xl font-bold dark:text-gray-100">自定義動作</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                    新增動作
                </button>
            </div>

            {showForm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-96">
                        <h3 className="text-lg font-bold mb-4 dark:text-gray-100">
                            {editingAction ? '編輯動作' : '新增動作'}
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">動作標題</label>
                                <input
                                    type="text"
                                    value={newAction.title}
                                    onChange={e => setNewAction({...newAction, title: e.target.value})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    placeholder="請輸入動作標題"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">觸發訊息</label>
                                <input
                                    type="text"
                                    value={newAction.triggerPattern}
                                    onChange={e => setNewAction({...newAction, triggerPattern: e.target.value})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    placeholder="輸入觸發的訊息內容"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">來源類型</label>
                                <select
                                    value={newAction.sourceType}
                                    onChange={e => setNewAction({...newAction, sourceType: e.target.value as 'user' | 'group'})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                >
                                    <option value="user">用戶</option>
                                    <option value="group">群組</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">
                                    {newAction.sourceType === 'user' ? '用戶 ID' : '選擇群組'}
                                </label>
                                {newAction.sourceType === 'group' ? (
                                    <select
                                        value={newAction.sourceId}
                                        onChange={e => setNewAction({...newAction, sourceId: e.target.value})}
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
                                        value={newAction.sourceId}
                                        onChange={e => setNewAction({...newAction, sourceId: e.target.value})}
                                        placeholder="輸入用戶 ID"
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 dark:text-gray-200">動作類型</label>
                                <select
                                    value={newAction.actionType}
                                    onChange={e => setNewAction({...newAction, actionType: e.target.value as 'command' | 'reply'})}
                                    className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                >
                                    <option value="reply">回覆訊息</option>
                                    <option value="command">執行命令</option>
                                </select>
                            </div>
                            {newAction.actionType === 'command' ? (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">命令</label>
                                        <input
                                            type="text"
                                            value={newAction.command || ''}
                                            onChange={e => setNewAction({...newAction, command: e.target.value})}
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                            placeholder="輸入要執行的命令"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1 dark:text-gray-200">回應模板</label>
                                        <textarea
                                            value={newAction.responseTemplate || defaultTemplate}
                                            onChange={e => setNewAction({...newAction, responseTemplate: e.target.value})}
                                            className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                            placeholder="使用 {command_response_content} 作為命令響應內容的佔位符"
                                        />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                            使用 {'{command_response_content}'} 來插入命令的執行結果<br/>
                                            使用 {'{timestamp}'} 來插入當前時間
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium mb-1 dark:text-gray-200">回覆訊息</label>
                                    <textarea
                                        value={newAction.replyMessage || ''}
                                        onChange={e => setNewAction({...newAction, replyMessage: e.target.value})}
                                        className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                                        placeholder="輸入要回覆的訊息"
                                    />
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-4 flex justify-end space-x-2">
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingAction(null);
                                    setNewAction({
                                        title: '',
                                        enabled: true,
                                        triggerType: 'message',
                                        triggerPattern: '',
                                        sourceType: 'user',
                                        sourceId: '',
                                        sourceName: '',
                                        actionType: 'reply',
                                        replyMessage: '',
                                        responseTemplate: defaultTemplate
                                    });
                                }}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveAction}
                                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {actions.map(action => (
                    <div
                        key={action.id}
                        className={`p-4 rounded-lg border border-gray-200 dark:border-gray-700 ${
                            action.enabled 
                                ? 'bg-white dark:bg-gray-800' 
                                : 'bg-gray-50 dark:bg-gray-900'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium dark:text-gray-100">{action.title}</h3>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                    觸發訊息: {action.triggerPattern}
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => {
                                        setEditingAction(action);
                                        setNewAction(action);
                                        setShowForm(true);
                                    }}
                                    className="text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => handleToggleAction(action.id, !action.enabled)}
                                    className={`px-2 py-1 rounded ${
                                        action.enabled
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-gray-500 hover:bg-gray-600'
                                    } text-white text-sm`}
                                >
                                    {action.enabled ? '啟用' : '禁用'}
                                </button>
                                <button
                                    onClick={() => handleDeleteAction(action.id)}
                                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <div className="mt-2">
                            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-1">
                                {action.sourceType === 'user' ? (
                                    <FaWhatsapp className="mr-1" />
                                ) : (
                                    <FaUsers className="mr-1" />
                                )}
                                <span>{action.sourceName}</span>
                            </div>
                            <div className="text-gray-700 dark:text-gray-300">
                                {action.actionType === 'command' ? (
                                    <>
                                        <div>命令: {action.command}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            回應模板: {action.responseTemplate}
                                        </div>
                                    </>
                                ) : (
                                    <div>回覆: {action.replyMessage}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
} 