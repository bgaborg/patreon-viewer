import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import PatreonDownloader from 'patreon-dl';
import {
    encodeFileInPlace,
    getVideoResolution,
    is480p,
    isTempEncodeFile,
    isVideoFile,
    type VideoResolution,
} from './video-encode.js';

export interface EmbedDownloader {
    provider: string;
    exec?: string;
    [key: string]: string | undefined;
}

export interface EmbedConfSettings {
    cookie: string;
    embedDownloaders: EmbedDownloader[];
    include: Record<string, string>;
    outDir: string | null;
}

export interface DownloadCallbacks {
    abortController?: AbortController;
    onLog?: (type: string, message: string) => void;
    onTargetBegin?: (info: { name: string }) => void;
    onTargetEnd?: (info: { skipped: boolean }) => void;
    onFileDownloaded?: (filePath: string) => void;
    onEnd?: (payload: EndPayload) => void;
}

export interface EndPayload {
    aborted?: boolean;
    error?: boolean;
    message?: string;
}

export interface EncodeCallbacks {
    abortController?: AbortController;
    onLog?: (type: string, message: string) => void;
    onEncodingStart?: (total: number) => void;
    onEncodingProgress?: (progress: { current: string | null; completed: number; total: number }) => void;
    onEncodingEnd?: () => void;
}

/**
 * Parse embed.conf (INI-style) into a structured object.
 */
export function parseEmbedConf(content: string): EmbedConfSettings {
    const result: EmbedConfSettings = {
        cookie: '',
        embedDownloaders: [],
        include: {},
        outDir: null,
    };

    let currentSection: string | null = null;

    for (const rawLine of content.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;

        const sectionMatch = line.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
        }

        const kvMatch = line.match(/^([^=]+?)\s*=\s*(.*)$/);
        if (!kvMatch) continue;

        const key = kvMatch[1].trim();
        const value = kvMatch[2].trim();

        if (currentSection === 'downloader') {
            if (key === 'cookie') result.cookie = value;
            if (key === 'out.dir') result.outDir = value;
        } else if (currentSection?.startsWith('embed.downloader.')) {
            const provider = currentSection.replace('embed.downloader.', '');
            let entry = result.embedDownloaders.find((e) => e.provider === provider);
            if (!entry) {
                entry = { provider };
                result.embedDownloaders.push(entry);
            }
            entry[key] = value;
        } else if (currentSection === 'include') {
            result.include[key] = value;
        }
    }

    return result;
}

/**
 * Serialize structured settings back to INI-format embed.conf.
 */
export function writeEmbedConf(dataDir: string, settings: Partial<EmbedConfSettings>): void {
    let existing: EmbedConfSettings | null = null;
    try {
        existing = parseEmbedConf(readFileSync(join(dataDir, 'embed.conf'), 'utf8'));
    } catch {
        /* no existing conf */
    }

    const merged: EmbedConfSettings = {
        cookie: settings.cookie ?? existing?.cookie ?? '',
        embedDownloaders: settings.embedDownloaders ?? existing?.embedDownloaders ?? [],
        include: settings.include ?? existing?.include ?? {},
        outDir: settings.outDir ?? existing?.outDir ?? null,
    };

    const lines: string[] = [];

    if (merged.embedDownloaders.length) {
        for (const dl of merged.embedDownloaders) {
            lines.push(`[embed.downloader.${dl.provider}]`);
            for (const [key, value] of Object.entries(dl)) {
                if (key === 'provider') continue;
                lines.push(`${key} = ${value}`);
            }
            lines.push('');
        }
    }

    lines.push('[downloader]');
    if (merged.cookie) {
        lines.push(`cookie = ${merged.cookie}`);
    }
    if (merged.outDir) {
        lines.push(`out.dir = ${merged.outDir}`);
    }
    lines.push('');

    if (Object.keys(merged.include).length > 0) {
        lines.push('[include]');
        for (const [key, value] of Object.entries(merged.include)) {
            lines.push(`${key} = ${value}`);
        }
        lines.push('');
    }

    writeFileSync(join(dataDir, 'embed.conf'), lines.join('\n'), 'utf8');
}

/**
 * Convert structured settings to patreon-dl API options.
 */
export function settingsToPatreonDlOptions(settings: EmbedConfSettings, dataDir: string): Record<string, unknown> {
    const options: Record<string, unknown> = {
        outDir: dataDir,
        useStatusCache: true,
        fileExistsAction: {
            info: 'overwrite',
            infoAPI: 'overwrite',
            content: 'skip',
        },
    };

    if (settings.cookie) {
        options.cookie = settings.cookie;
    }

    const include: Record<string, unknown> = {};

    if (settings.include?.['posts.with.media.type']) {
        const val = settings.include['posts.with.media.type'];
        if (val === 'any' || val === 'none') {
            include.postsWithMediaType = val;
        } else {
            include.postsWithMediaType = val.split(',').map((s) => s.trim());
        }
    }

    if (settings.include?.['locked.content'] !== undefined) {
        include.lockedContent = settings.include['locked.content'] !== 'false';
    }

    if (settings.include?.['preview.media'] !== undefined) {
        include.previewMedia = settings.include['preview.media'] !== 'false';
    }

    if (settings.include?.comments !== undefined) {
        include.comments = settings.include.comments === 'true';
    }

    if (Object.keys(include).length > 0) {
        options.include = include;
    }

    if (settings.embedDownloaders?.length) {
        options.embedDownloaders = settings.embedDownloaders.map((dl) => ({
            provider: dl.provider,
            exec: dl.exec,
        }));
    }

    return options;
}

/**
 * Run a patreon-dl download for the given URL.
 */
export async function runDownload(url: string, dataDir: string, callbacks: DownloadCallbacks): Promise<void> {
    let confContent = '';
    try {
        confContent = readFileSync(join(dataDir, 'embed.conf'), 'utf8');
    } catch {
        // No config file — use defaults
    }

    const settings = parseEmbedConf(confContent);
    const options = settingsToPatreonDlOptions(settings, dataDir);

    callbacks.onLog?.('info', `Starting download: ${url}`);

    const abortController = callbacks.abortController || new AbortController();
    const downloader = await PatreonDownloader.getInstance(url, options);

    downloader.on('fetchBegin', (payload: { targetType: string }) => {
        callbacks.onLog?.('info', `Fetching ${payload.targetType} data...`);
    });

    downloader.on(
        'targetBegin',
        (payload: { target: { type: string; id?: string; name?: string; title?: string | null } }) => {
            const target = payload.target;
            let label: string;
            if (target.type === 'campaign') {
                label = target.name || `Campaign #${target.id}`;
            } else if (target.type === 'collection') {
                label = target.title || `Collection #${target.id}`;
            } else {
                label = target.title || `Post #${target.id}`;
            }
            callbacks.onLog?.('info', `Processing ${target.type}: ${label}`);
            callbacks.onTargetBegin?.({ name: label });
        },
    );

    downloader.on('targetEnd', (payload: { isSkipped: boolean; skipMessage?: string }) => {
        if (payload.isSkipped) {
            callbacks.onLog?.('skip', `Skipped: ${payload.skipMessage || 'unknown reason'}`);
            callbacks.onTargetEnd?.({ skipped: true });
        } else {
            callbacks.onLog?.('success', 'Target completed');
            callbacks.onTargetEnd?.({ skipped: false });
        }
    });

    downloader.on(
        'phaseBegin',
        (payload: {
            phase: string;
            batch?: { on: (event: string, cb: (tp: Record<string, unknown>) => void) => void };
        }) => {
            if (payload.phase === 'batchDownload' && payload.batch) {
                const batch = payload.batch;

                batch.on('taskStart', (tp: Record<string, unknown>) => {
                    const task = tp.task as Record<string, unknown>;
                    const filename = (task.resolvedDestFilename as string) || (task.src as string) || 'file';
                    callbacks.onLog?.('info', `Downloading: ${filename}`);
                });

                batch.on('taskComplete', (tp: Record<string, unknown>) => {
                    const task = tp.task as Record<string, unknown>;
                    const filename = (task.resolvedDestFilename as string) || 'file';
                    const filePath = task.resolvedDestFilePath as string | null;
                    callbacks.onLog?.('success', `Downloaded: ${filename}`);
                    if (filePath) {
                        callbacks.onFileDownloaded?.(filePath);
                    }
                });

                batch.on('taskSkip', (tp: Record<string, unknown>) => {
                    const task = tp.task as Record<string, unknown>;
                    const reason = tp.reason as Record<string, unknown>;
                    const filename = (task.resolvedDestFilename as string) || 'file';
                    callbacks.onLog?.('skip', `Skipped: ${filename} — ${reason.message}`);
                });

                batch.on('taskError', (tp: Record<string, unknown>) => {
                    const error = tp.error as Record<string, unknown>;
                    const cause = error.cause as Record<string, unknown> | undefined;
                    const msg = (cause?.message as string) || 'Unknown error';
                    callbacks.onLog?.('error', `Download error: ${msg}${tp.willRetry ? ' (will retry)' : ''}`);
                });
            }
        },
    );

    downloader.on('end', (payload: EndPayload) => {
        if (payload.aborted) {
            callbacks.onLog?.('warn', 'Download aborted');
        } else if (payload.error) {
            callbacks.onLog?.('error', `Download ended with error: ${payload.message}`);
        } else {
            callbacks.onLog?.('success', 'Download completed');
        }
        callbacks.onEnd?.(payload);
    });

    await downloader.start({ signal: abortController.signal });
}

export async function encodeVideos(downloadedFiles: string[], callbacks: EncodeCallbacks): Promise<void> {
    const signal = callbacks.abortController?.signal;
    const videoFiles = downloadedFiles.filter((f) => isVideoFile(f) && !isTempEncodeFile(f));

    if (videoFiles.length === 0) {
        callbacks.onLog?.('info', 'No downloaded videos to encode');
        callbacks.onEncodingEnd?.();
        return;
    }

    callbacks.onLog?.('info', `Checking ${videoFiles.length} downloaded video(s)...`);
    const toEncode: Array<{ filePath: string; resolution: VideoResolution }> = [];

    for (const filePath of videoFiles) {
        signal?.throwIfAborted();
        const resolution = await getVideoResolution(filePath);
        if (!resolution) continue;
        if (is480p(resolution)) continue;
        toEncode.push({ filePath, resolution });
    }

    if (toEncode.length === 0) {
        callbacks.onLog?.('info', 'No videos need encoding');
        callbacks.onEncodingEnd?.();
        return;
    }

    callbacks.onLog?.('info', `Found ${toEncode.length} video(s) to encode`);
    callbacks.onEncodingStart?.(toEncode.length);

    let completed = 0;

    for (const { filePath, resolution } of toEncode) {
        signal?.throwIfAborted();
        const filename = filePath.split('/').pop() || '';
        callbacks.onLog?.('info', `Encoding: ${filename}`);
        callbacks.onEncodingProgress?.({ current: filename, completed, total: toEncode.length });

        try {
            await encodeFileInPlace(filePath, resolution, signal);
            completed++;
            callbacks.onLog?.('success', `Encoded: ${filename}`);
            callbacks.onEncodingProgress?.({ current: null, completed, total: toEncode.length });
        } catch (err) {
            if (signal?.aborted) throw err;
            callbacks.onLog?.('error', `Failed to encode ${filename}: ${(err as Error).message}`);
        }
    }

    callbacks.onLog?.('success', `Encoding complete: ${completed}/${toEncode.length} videos processed`);
    callbacks.onEncodingEnd?.();
}
