import { FaMobile, FaDesktop, FaQuestion } from 'react-icons/fa';

interface Device {
    id: string;
    name: string;
    platform: string;
}

interface DeviceListProps {
    devices: Device[];
    isConnected: boolean;
}

export function DeviceList({ devices, isConnected }: DeviceListProps) {
    const getDeviceIcon = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'mobile':
                return FaMobile;
            case 'desktop':
                return FaDesktop;
            default:
                return FaQuestion;
        }
    };

    return (
        <div className="h-full">
            <h2 className="text-2xl font-bold mb-4 dark:text-gray-100">設備列表</h2>
            {!isConnected ? (
                <div className="text-gray-500 dark:text-gray-400">請先登入 WhatsApp</div>
            ) : devices.length === 0 ? (
                <div className="text-gray-500 dark:text-gray-400">沒有找到設備</div>
            ) : (
                <ul className="space-y-2">
                    {devices.map(device => {
                        const Icon = getDeviceIcon(device.platform);
                        return (
                            <li key={device.id} className="border border-gray-200 dark:border-gray-700 p-3 rounded shadow hover:bg-gray-50 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                    <div>
                                        <div className="font-semibold dark:text-gray-100">{device.name}</div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            平台: {device.platform}
                                        </div>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
} 