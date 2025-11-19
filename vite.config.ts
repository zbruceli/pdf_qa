import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const CONFIG_FILE_PATH = path.resolve(__dirname, '.config.local');

function configPersistencePlugin(): Plugin {
    const ensureConfigFile = () => {
        if (!fs.existsSync(CONFIG_FILE_PATH)) {
            fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
        }
    };

    const registerMiddleware = (server: { middlewares: { use: (middleware: any) => void } }) => {
        server.middlewares.use((req: any, res: any, next: any) => {
            if (!req.url?.startsWith('/api/config')) {
                return next();
            }

            ensureConfigFile();

            if (req.method === 'GET') {
                try {
                    const data = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8') || '{}';
                    res.setHeader('Content-Type', 'application/json');
                    res.end(data);
                } catch (error) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: 'Failed to read config.' }));
                }
                return;
            }

            if (req.method === 'POST') {
                let body = '';
                req.on('data', (chunk) => {
                    body += chunk;
                });
                req.on('end', () => {
                    try {
                        const payload = body ? JSON.parse(body) : {};
                        fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify(payload));
                    } catch (error) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: 'Invalid JSON payload.' }));
                    }
                });
                return;
            }

            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed.' }));
        });
    };

    return {
        name: 'config-persistence-plugin',
        configureServer(server) {
            registerMiddleware(server);
        },
        configurePreviewServer(server) {
            registerMiddleware(server);
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
        server: {
            port: 3000,
            host: '0.0.0.0',
        },
        plugins: [react(), configPersistencePlugin()],
        define: {
            'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
            'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, '.'),
            }
        }
    };
});
