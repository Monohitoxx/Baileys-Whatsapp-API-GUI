// 使用固定的默認值
const DEFAULT_SERVER_HOST = 'http://127.0.0.1:3001';

let API_BASE_URL = DEFAULT_SERVER_HOST;
let isInitialized = false;

export function setApiBaseUrl(url: string) {
    API_BASE_URL = url;
    if (typeof window !== 'undefined') {
        window.API_BASE_URL = url;
    }
}

export function getApiBaseUrl(): string {
    return API_BASE_URL;
}

export async function initializeConfig(): Promise<void> {
    if (isInitialized) return;
    
    try {
        const response = await fetch(`${DEFAULT_SERVER_HOST}/api/server-config`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const config = await response.json();
            setApiBaseUrl(config.host);
            isInitialized = true;
        }
    } catch (error) {
        console.error('初始化配置失敗:', error);
        // 如果獲取失敗，使用默認值
        setApiBaseUrl(DEFAULT_SERVER_HOST);
    }
}