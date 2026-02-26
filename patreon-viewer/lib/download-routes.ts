import path from 'node:path';
import express, { type Request, type Response, type Router } from 'express';
import fs from 'fs-extra';
import { addLog, broadcast, getSnapshot, reset, state } from './download-state.js';

export const PATREON_URL_PATTERN = /^https?:\/\/(www\.)?patreon\.com\/(posts\/|collection\/|[^/]+\/?$)/;

interface OrchestratorModule {
    runDownload: (url: string, dataDir: string, callbacks: Record<string, unknown>) => Promise<void>;
    encodeVideos: (downloadedFiles: string[], callbacks: Record<string, unknown>) => Promise<void>;
    parseEmbedConf: (content: string) => Record<string, unknown>;
    writeEmbedConf: (dataDir: string, settings: Record<string, unknown>) => void;
}

export function createDownloadRouter(dataDir: string, orchestratorPath?: string): Router {
    const router = express.Router();
    const resolvedOrchestratorPath =
        orchestratorPath || path.resolve(__dirname, '..', '..', 'download-orchestrator.ts');

    router.get('/download', async (_req: Request, res: Response) => {
        res.render('download', { title: 'Add Content' });
    });

    router.get('/download/progress', (req: Request, res: Response) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });

        // Send current state snapshot on connect
        const snapshot = getSnapshot();
        res.write(`event: state\ndata: ${JSON.stringify(snapshot)}\n\n`);

        state.sseClients.add(res);

        req.on('close', () => {
            state.sseClients.delete(res);
        });
    });

    router.post('/download/start', express.json(), async (req: Request, res: Response) => {
        const { url } = req.body || {};

        if (!url || !PATREON_URL_PATTERN.test(url)) {
            res.status(400).json({
                error: 'Invalid URL. Provide a Patreon post, collection, or creator URL.',
            });
            return;
        }

        if (state.status !== 'idle' && state.status !== 'complete' && state.status !== 'error') {
            res.status(409).json({ error: 'A download is already in progress.' });
            return;
        }

        reset();
        state.status = 'downloading';
        state.url = url;
        state.abortController = new AbortController();

        broadcast('status', { status: 'downloading', url });
        res.json({ ok: true });

        // Background: import orchestrator (ESM) and run
        (async () => {
            try {
                const orchestrator = (await import(resolvedOrchestratorPath)) as OrchestratorModule;
                const downloadedFiles: string[] = [];

                await orchestrator.runDownload(url, dataDir, {
                    abortController: state.abortController,
                    onLog: (type: string, message: string) => addLog(type, message),
                    onTargetBegin: () => {
                        state.targets.total++;
                        broadcast('targets', state.targets);
                    },
                    onTargetEnd: ({ skipped }: { skipped: boolean }) => {
                        if (skipped) state.targets.skipped++;
                        else state.targets.completed++;
                        broadcast('targets', state.targets);
                    },
                    onFileDownloaded: (filePath: string) => {
                        downloadedFiles.push(filePath);
                    },
                    onEnd: (payload: { aborted?: boolean; error?: boolean; message?: string }) => {
                        if (payload.aborted) {
                            state.status = 'aborted';
                            broadcast('status', { status: 'aborted' });
                            return;
                        }
                        if (payload.error) {
                            state.status = 'error';
                            state.error = payload.message || null;
                            broadcast('status', { status: 'error', error: payload.message });
                            return;
                        }
                    },
                });

                if (state.status === 'aborted') return;

                // Start encoding phase — only encode newly downloaded files
                state.status = 'encoding';
                broadcast('status', { status: 'encoding' });

                await orchestrator.encodeVideos(downloadedFiles, {
                    onLog: (type: string, message: string) => addLog(type, message),
                    onEncodingStart: (total: number) => {
                        state.encoding.total = total;
                        broadcast('encoding', state.encoding);
                    },
                    onEncodingProgress: (progress: { current: string | null; completed: number; total: number }) => {
                        state.encoding.current = progress.current;
                        state.encoding.completed = progress.completed;
                        state.encoding.total = progress.total;
                        broadcast('encoding', state.encoding);
                    },
                    onEncodingEnd: () => {
                        state.encoding.current = null;
                        broadcast('encoding', state.encoding);
                    },
                });

                state.status = 'complete';
                broadcast('status', { status: 'complete' });
                addLog('success', 'All done!');
            } catch (err) {
                state.status = 'error';
                state.error = (err as Error).message;
                addLog('error', `Fatal error: ${(err as Error).message}`);
                broadcast('status', { status: 'error', error: (err as Error).message });
            }
        })();
    });

    router.post('/download/abort', (_req: Request, res: Response) => {
        if (!state.abortController || state.status === 'idle') {
            res.status(400).json({ error: 'No active download to abort.' });
            return;
        }

        state.abortController.abort();
        state.status = 'aborting';
        broadcast('status', { status: 'aborting' });
        addLog('warn', 'Abort requested...');
        res.json({ ok: true });
    });

    router.get('/download/settings', async (_req: Request, res: Response) => {
        try {
            const confPath = path.join(dataDir, 'embed.conf');
            let content = '';
            if (await fs.pathExists(confPath)) {
                content = await fs.readFile(confPath, 'utf8');
            }
            const orchestrator = (await import(resolvedOrchestratorPath)) as OrchestratorModule;
            const settings = orchestrator.parseEmbedConf(content);
            res.json(settings);
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    router.post('/download/settings', express.json(), async (req: Request, res: Response) => {
        try {
            const settings = req.body;
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
                res.status(400).json({ error: 'Invalid settings object.' });
                return;
            }

            const orchestrator = (await import(resolvedOrchestratorPath)) as OrchestratorModule;
            orchestrator.writeEmbedConf(dataDir, settings);
            res.json({ ok: true });
        } catch (err) {
            res.status(500).json({ error: (err as Error).message });
        }
    });

    return router;
}
