import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { getApiBaseUrl } from '../config';

declare global {
    interface Window {
        API_BASE_URL: string;
    }
}

interface WhatsAppStatusProps {
    qr: string | null;
    isConnected: boolean;
    userInfo: { name: string; id: string; } | null;
    onLogout: () => void;
}

export function WhatsAppStatus({ qr, isConnected, userInfo, onLogout }: WhatsAppStatusProps) {
    const [key, setKey] = useState(0); // 添加 key 來強制重新渲染 QR code
    const [currentTime, setCurrentTime] = useState(new Date());
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 當 qr 改變時更新 key
    useEffect(() => {
        if (qr) {
            setKey(prev => prev + 1);
        }
    }, [qr]);

    // 更新當前時間
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        try {
            const response = await fetch(`${window.API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('登出失敗');
            }

            // 重新載入頁面
            window.location.reload();
        } catch (error) {
            console.error('登出失敗:', error);
            alert('登出失敗: ' + (error instanceof Error ? error.message : '未知錯誤'));
        }
    };

    return (
        <div className="w-80 p-4 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">WhatsApp 連接狀態</h2>
            
            <div className="space-y-2">
                <div className={`flex items-center space-x-2 ${isConnected ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                    <FaWhatsapp className="text-2xl" />
                    <span className="font-medium">
                        {isConnected ? (userInfo?.name || 'WhatsApp 已連接') : 'WhatsApp 未連接'}
                    </span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    <div>時區: {timezone}</div>
                    <div>當前時間: {currentTime.toLocaleString()}</div>
                </div>
            </div>
            
            {isConnected ? (
                <div className="space-y-4">
                    <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
                        <div className="text-green-700 dark:text-green-300 font-medium mb-2">
                            已連接
                        </div>
                        {userInfo && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                                <div className="font-medium">{userInfo.name}</div>
                                <div className="text-xs opacity-75">{userInfo.id}</div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                        登出
                    </button>
                </div>
            ) : qr ? (
                <div>
                    <div className="mb-4 text-gray-600 dark:text-gray-300">
                        請使用 WhatsApp 掃描 QR Code
                    </div>
                    <div className="bg-white p-4 rounded">
                        <QRCodeSVG 
                            key={key}
                            value={qr} 
                            size={256}
                            level="H"
                            includeMargin={true}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-gray-600 dark:text-gray-300">
                    正在生成 QR Code...
                </div>
            )}
        </div>
    );
} 