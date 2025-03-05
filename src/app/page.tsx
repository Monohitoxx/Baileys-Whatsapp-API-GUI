'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { WhatsAppStatus } from './components/WhatsAppStatus';
import { GroupList } from './components/GroupList';
import { DeviceList } from './components/DeviceList';
import { Settings } from './components/Settings';
import { ScheduledTasks } from './components/ScheduledTasks';
import { CustomActions } from './components/CustomActions';
import { MenuItem } from './types';
import { getApiBaseUrl, initializeConfig } from './config';
import { LoginPage } from './components/LoginPage';

interface Device {
    id: string;
    name: string;
    platform: string;
}

export default function Home() {
    const [qr, setQr] = useState<string | null>(null);
    const [userInfo, setUserInfo] = useState<{ name: string; id: string } | null>(null);
    const [groups, setGroups] = useState<Array<{id: string, name: string}>>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [activeMenu, setActiveMenu] = useState<MenuItem>('群組列表');
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    const fetchGroups = useCallback(async () => {
        if (!isConnected) return;
        try {
            const response = await fetch(`${getApiBaseUrl()}/groups`);
            if (!response.ok) {
                throw new Error('獲取群組失敗');
            }
            const data = await response.json();
            setGroups(Array.isArray(data.groups) ? data.groups : []);
        } catch (error) {
            console.error('獲取群組失敗:', error);
        }
    }, [isConnected]);

    const fetchDevices = useCallback(async () => {
        if (!isConnected) return;
        try {
            const response = await fetch(`${getApiBaseUrl()}/devices`);
            if (!response.ok) {
                throw new Error('獲取設備失敗');
            }
            const data = await response.json();
            setDevices(Array.isArray(data.devices) ? data.devices : []);
        } catch (error) {
            console.error('獲取設備失敗:', error);
        }
    }, [isConnected]);

    const handleLogout = async () => {
        try {
            await fetch(`${getApiBaseUrl()}/logout`, { method: 'POST' });
            setIsConnected(false);
            setGroups([]);
            setDevices([]);
            setSelectedGroup(null);
            setQr(null);
            setUserInfo(null);
            localStorage.removeItem('isLoggedIn');
            setIsLoggedIn(false);
        } catch (error) {
            console.error('登出失敗:', error);
        }
    };

    const checkStatus = useCallback(async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/qr`);
            const data = await response.json();
            
            if (data.isConnected) {
                setIsConnected(true);
                setQr(null);
                if (data.userInfo) {
                    setUserInfo(data.userInfo);
                }
                if (!isConnected) {
                    fetchGroups();
                    fetchDevices();
                }
            } else if (data.qr) {
                setQr(data.qr);
                setIsConnected(false);
                setUserInfo(null);
            } else {
                setQr(null);
                setIsConnected(false);
                setUserInfo(null);
            }
        } catch (error) {
            console.error('檢查狀態失敗:', error);
        } finally {
            setLoading(false);
        }
    }, [isConnected, fetchGroups, fetchDevices]);

    useEffect(() => {
        // 初始化配置
        const init = async () => {
            await initializeConfig();
            checkStatus();
        };
        init();
        const interval = setInterval(checkStatus, 3000);
        return () => clearInterval(interval);
    }, [checkStatus]);

    // 當連接狀態改變時更新數據
    useEffect(() => {
        if (isConnected) {
            fetchGroups();
            fetchDevices();
        }
    }, [isConnected, fetchGroups, fetchDevices]);

    useEffect(() => {
        // 檢查是否已登入
        const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
        setIsLoggedIn(loggedIn);
    }, []);

    const handleLogin = async (username: string, password: string) => {
        try {
            // 在實際應用中，這裡應該調用 API 進行驗證
            const users = [
                {
                    username: "admin",
                    password: "admin123"
                }
            ];

            const user = users.find(u => 
                u.username === username && u.password === password
            );

            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                setIsLoggedIn(true);
                return true;
            }
            return false;
        } catch (error) {
            console.error('登入失敗:', error);
            return false;
        }
    };

    const renderContent = () => {
        switch (activeMenu) {
            case '群組列表':
                return (
                    <GroupList
                        groups={groups}
                        isConnected={isConnected}
                        selectedGroup={selectedGroup}
                        onSelectGroup={setSelectedGroup}
                    />
                );
            case '設備列表':
                return (
                    <DeviceList
                        devices={devices}
                        isConnected={isConnected}
                    />
                );
            case '定時任務':
                return (
                    <ScheduledTasks
                        isConnected={isConnected}
                        groups={groups}
                    />
                );
            case '自定義動作':
                return <CustomActions isConnected={isConnected} groups={groups} />;
            case '設定':
                return <Settings />;
            default:
                return null;
        }
    };

    if (!isLoggedIn) {
        return <LoginPage onLogin={handleLogin} />;
    }

    if (loading) {
        return <div className="flex min-h-screen items-center justify-center">
            <p className="text-xl">載入中...</p>
        </div>;
    }

    return (
        <main className="flex min-h-screen bg-white dark:bg-gray-900">
            <Sidebar
                activeMenu={activeMenu}
                onMenuSelect={setActiveMenu}
            />
            <div className="flex-1 p-6 bg-white dark:bg-gray-900">
                {renderContent()}
            </div>
            <WhatsAppStatus
                qr={qr}
                isConnected={isConnected}
                userInfo={userInfo}
                onLogout={handleLogout}
            />
        </main>
    );
}
