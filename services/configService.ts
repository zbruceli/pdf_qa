/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface AppConfig {
    ragStoreName?: string;
}

const CONFIG_ENDPOINT = '/api/config';

async function fetchConfig(): Promise<AppConfig> {
    try {
        const response = await fetch(CONFIG_ENDPOINT, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to load config: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Unable to load persisted config', error);
        return {};
    }
}

async function persistConfig(config: AppConfig): Promise<AppConfig> {
    const response = await fetch(CONFIG_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
    });

    if (!response.ok) {
        throw new Error(`Failed to persist config: ${response.statusText}`);
    }

    return config;
}

export async function getStoredRagStoreName(): Promise<string | null> {
    const config = await fetchConfig();
    return config.ragStoreName ?? null;
}

export async function saveRagStoreName(ragStoreName: string): Promise<void> {
    const current = await fetchConfig();
    await persistConfig({ ...current, ragStoreName });
}
