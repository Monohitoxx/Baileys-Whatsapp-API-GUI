import { IconType } from 'react-icons';
import { FaUsers, FaLaptop, FaCog, FaClock, FaPlus } from 'react-icons/fa';
import { Dispatch, SetStateAction } from 'react';
import { MenuItem } from '../types';

type MenuConfig = {
    id: MenuItem;
    icon: IconType;
    label: string;
}

const MENU_ITEMS: MenuConfig[] = [
    { id: '群組列表', icon: FaUsers, label: '群組列表' },
    { id: '設備列表', icon: FaLaptop, label: '設備列表' },
    { id: '定時任務', icon: FaClock, label: '定時任務' },
    { id: '自定義動作', icon: FaPlus, label: '自定義動作' },
    { id: '設定', icon: FaCog, label: '設定' }
];

interface SidebarProps {
    activeMenu: MenuItem;
    onMenuSelect: Dispatch<SetStateAction<MenuItem>>;
}

export function Sidebar({ activeMenu, onMenuSelect }: SidebarProps) {
    return (
        <div className="w-48 bg-white dark:bg-gray-900 p-4 border-r border-gray-200 dark:border-gray-700">
            <nav className="space-y-2">
                {MENU_ITEMS.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => onMenuSelect(id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 rounded transition-colors
                            ${activeMenu === id 
                                ? 'bg-green-500 text-white' 
                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                    >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                    </button>
                ))}
            </nav>
        </div>
    );
} 