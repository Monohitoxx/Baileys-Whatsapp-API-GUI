import { useState } from 'react';
import Image from 'next/image';

interface LoginPageProps {
    onLogin: (username: string, password: string) => Promise<boolean>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const success = await onLogin(username, password);
            if (!success) {
                setError('用戶名或密碼錯誤');
            }
        } catch (error) {
            setError('登入時發生錯誤');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#2B3C68] flex items-center justify-center">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <div className="flex justify-center mb-6">
                    <Image
                        src="/kong-logo.png"
                        alt="Kong Logo"
                        width={200}
                        height={50}
                        priority
                    />
                </div>
                <h1 className="text-2xl font-semibold text-center text-gray-700 mb-6">
                    WhatsApp Task Manager
                </h1>
                {error && (
                    <div className="mb-4 p-2 bg-red-100 text-red-600 rounded text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-2 px-4 rounded text-white font-medium
                            ${isLoading 
                                ? 'bg-gray-400' 
                                : 'bg-[#7E8FBF] hover:bg-[#6B7CAC]'}`}
                    >
                        {isLoading ? '登入中...' : '登入'}
                    </button>
                </form>
            </div>
        </div>
    );
} 