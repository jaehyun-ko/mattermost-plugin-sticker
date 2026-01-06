import { Sticker, StickerList } from '../types';

const PLUGIN_ID = 'com.example.sticker';

export const getPluginServerRoute = (): string => {
    return `/plugins/${PLUGIN_ID}`;
};

// Get CSRF token from cookie (same method as mattermost-redux Client4)
const getCSRFFromCookie = (): string => {
    if (typeof document !== 'undefined' && typeof document.cookie !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const trimmed = cookie.trim();
            if (trimmed.startsWith('MMCSRF=')) {
                return trimmed.replace('MMCSRF=', '');
            }
        }
    }
    return '';
};

// Try to get Client4 from mattermost-redux if available
const getClient4 = (): any => {
    try {
        // Try different ways Mattermost exposes mattermost-redux
        const webapp = (window as any)['com.mattermost.webapp'];
        if (webapp?.mmReduxClient?.Client4) {
            return webapp.mmReduxClient.Client4;
        }
        if ((window as any).mmReduxClient?.Client4) {
            return (window as any).mmReduxClient.Client4;
        }
        if ((window as any).Client4) {
            return (window as any).Client4;
        }
    } catch (e) {
        // Ignore - will use fallback
    }
    return null;
};

// Build fetch options (mimics Client4.getOptions)
const getOptions = (options: RequestInit): RequestInit => {
    const client4 = getClient4();

    // If Client4 is available, use its getOptions method
    if (client4?.getOptions) {
        return client4.getOptions(options);
    }

    // Fallback: build options manually
    const headers: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
    };

    // Add CSRF token for non-GET requests
    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET') {
        const csrfToken = getCSRFFromCookie();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
    }

    // Merge with existing headers
    const existingHeaders = options.headers as Record<string, string> || {};

    return {
        ...options,
        credentials: 'include',
        headers: {
            ...headers,
            ...existingHeaders,
        },
    };
};

const doGet = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, getOptions({
        method: 'GET',
    }));

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Request failed: ${response.status}`);
    }

    return response.json();
};

export const doPost = async <T>(url: string, body?: any): Promise<T> => {
    const options: RequestInit = {
        method: 'POST',
    };

    if (body instanceof FormData) {
        // For FormData, don't set Content-Type (browser will set with boundary)
        options.body = body;
    } else if (body) {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, getOptions(options));

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Request failed: ${response.status}`);
    }

    return response.json();
};

export const doDelete = async (url: string): Promise<void> => {
    const response = await fetch(url, getOptions({
        method: 'DELETE',
    }));

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Request failed: ${response.status}`);
    }
};

export const getStickers = async (): Promise<StickerList> => {
    return doGet(`${getPluginServerRoute()}/api/v1/stickers`);
};

export const searchStickers = async (query: string): Promise<StickerList> => {
    return doGet(`${getPluginServerRoute()}/api/v1/stickers/search?q=${encodeURIComponent(query)}`);
};

export const uploadSticker = async (
    name: string,
    file: File,
    channelId?: string
): Promise<Sticker> => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', file);
    if (channelId) {
        formData.append('channel_id', channelId);
    }

    return doPost(`${getPluginServerRoute()}/api/v1/stickers`, formData);
};

export const deleteSticker = async (id: string): Promise<void> => {
    return doDelete(`${getPluginServerRoute()}/api/v1/stickers/${id}`);
};

export interface BulkUploadResult {
    success: string[];
    failed: Record<string, string>;
}

export const bulkUploadStickers = async (
    files: FileList,
    channelId?: string
): Promise<BulkUploadResult> => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
    }
    if (channelId) {
        formData.append('channel_id', channelId);
    }

    return doPost(`${getPluginServerRoute()}/api/v1/stickers/bulk`, formData);
};

export const uploadStickerFromURL = async (
    name: string,
    url: string,
    channelId?: string
): Promise<Sticker> => {
    return doPost(`${getPluginServerRoute()}/api/v1/stickers/from-url`, {
        name,
        url,
        channel_id: channelId,
    });
};

export const getStickerImageUrl = (stickerId: string): string => {
    return `${getPluginServerRoute()}/api/v1/stickers/${stickerId}/image`;
};

export const getFileUrl = (fileId: string): string => {
    return `/api/v4/files/${fileId}`;
};
