'use client';

import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // 從 localStorage 讀取主題設定
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

        // 應用主題
        document.documentElement.classList.toggle('dark', shouldUseDark);
        if (shouldUseDark) {
            document.body.classList.add('bg-gray-900');
            document.body.classList.remove('bg-white');
        } else {
            document.body.classList.remove('bg-gray-900');
            document.body.classList.add('bg-white');
        }

        // 如果沒有保存過主題設定，保存當前設定
        if (!savedTheme) {
            localStorage.setItem('theme', shouldUseDark ? 'dark' : 'light');
        }

        // 監聽系統主題變更
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem('theme')) {
                const newDarkMode = e.matches;
                document.documentElement.classList.toggle('dark', newDarkMode);
                if (newDarkMode) {
                    document.body.classList.add('bg-gray-900');
                    document.body.classList.remove('bg-white');
                } else {
                    document.body.classList.remove('bg-gray-900');
                    document.body.classList.add('bg-white');
                }
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return children;
}
