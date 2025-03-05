import { useEffect, useState } from 'react';
import { FaUsers, FaCalendar, FaSpinner } from 'react-icons/fa';

declare global {
    interface Window {
        API_BASE_URL: string;
    }
}

interface Group {
    id: string;
    name: string;
    participants: number;
    creation: string;
}

interface GroupListProps {
    groups: Group[];
    isConnected: boolean;
    selectedGroup: string | null;
    onSelectGroup: (id: string) => void;
}

export function GroupList({ groups, isConnected, selectedGroup, onSelectGroup }: GroupListProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localGroups, setLocalGroups] = useState<Group[]>([]);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (isConnected) {
            const fetchGroups = async () => {
                setLoading(true);
                setError(null);
                
                try {
                    // 確保 API_BASE_URL 已設置
                    if (!window.API_BASE_URL) {
                        // 如果沒有設置，嘗試從 localStorage 獲取
                        const savedHost = localStorage.getItem('serverHost');
                        if (savedHost) {
                            window.API_BASE_URL = savedHost;
                            console.log('從 localStorage 恢復 API_BASE_URL:', savedHost);
                        } else {
                            throw new Error('API 基礎 URL 未設定，請先在設定中配置服務器地址');
                        }
                    }

                    console.log('正在獲取群組列表，API URL:', `${window.API_BASE_URL}/groups`);
                    
                    const response = await fetch(`${window.API_BASE_URL}/groups`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    console.log('API 響應狀態:', response.status);
                    
                    if (!response.ok) {
                        const errorData = await response.text();
                        console.error('API 錯誤響應:', errorData);
                        throw new Error(`獲取群組失敗: ${response.status} ${response.statusText}\n${errorData}`);
                    }

                    const data = await response.json();
                    console.log('獲取到的群組數據:', data);
                    
                    if (!data.groups) {
                        throw new Error('返回的數據格式不正確');
                    }

                    setLocalGroups(data.groups);
                    setRetryCount(0); // 重置重試計數
                } catch (error) {
                    console.error('獲取群組時發生錯誤:', error);
                    let errorMessage = '獲取群組失敗';
                    
                    if (error instanceof Error) {
                        errorMessage = `${errorMessage}: ${error.message}`;
                    }
                    
                    setError(errorMessage);

                    // 如果是 API URL 未設定的錯誤，增加重試計數
                    if (!window.API_BASE_URL && retryCount < 3) {
                        console.log(`嘗試重新獲取群組列表 (${retryCount + 1}/3)...`);
                        setRetryCount(prev => prev + 1);
                        setTimeout(() => {
                            fetchGroups();
                        }, 1000); // 1秒後重試
                    }
                } finally {
                    setLoading(false);
                }
            };

            fetchGroups();
        } else {
            setLocalGroups([]);
            setError(null);
            setRetryCount(0);
        }
    }, [isConnected, retryCount]);

    if (!isConnected) {
        return (
            <div className="h-full">
                <h2 className="text-2xl font-bold mb-4">群組列表</h2>
                <div className="text-gray-500">請先登入 WhatsApp</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-full">
                <h2 className="text-2xl font-bold mb-4">群組列表</h2>
                <div className="flex items-center justify-center text-gray-500">
                    <FaSpinner className="animate-spin mr-2" />
                    載入中...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full">
                <h2 className="text-2xl font-bold mb-4">群組列表</h2>
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="h-full">
            <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">群組列表</h2>
            {localGroups.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">沒有找到群組</div>
            ) : (
                <div className="space-y-2">
                    {localGroups.map(group => (
                        <button
                            key={group.id}
                            onClick={() => onSelectGroup(group.id)}
                            className={`w-full text-left p-3 rounded transition-colors
                                ${selectedGroup === group.id 
                                    ? 'bg-green-500 text-white' 
                                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold">{group.name}</div>
                                    <div className="text-sm opacity-75 flex items-center gap-2 dark:text-gray-300">
                                        <span className="flex items-center">
                                            <FaUsers className="mr-1" />
                                            {group.participants || 0} 位成員
                                        </span>
                                        <span className="flex items-center">
                                            <FaCalendar className="mr-1" />
                                            {group.creation}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
} 