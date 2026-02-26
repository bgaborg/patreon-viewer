import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';
import PatreonDownloader from 'patreon-dl';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv'];

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
    onProgress?: (progress: DownloadProgress) => void;
    onTargetBegin?: (info: { name: string }) => void;
    onTargetEnd?: (info: { skipped: boolean }) => void;
    onEnd?: (payload: EndPayload) => void;
}

export interface DownloadProgress {
    filename: string;
    percent: number;
    speed: number;
    sizeDownloaded: number;
}

export interface EndPayload {
    aborted?: boolean;
    error?: boolean;
    message?: string;
}

export interface EncodeCallbacks {
    onLog?: (type: string, message: string) => void;
    onEncodingStart?: (total: number) => void;
    onEncodingProgress?: (progress: { current: string | null; completed: number; total: number }) => void;
    onEncodingEnd?: () => void;
}

export interface VideoResolution {
    width: number;
    height: number;
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
    const lines: string[] = [];

    if (settings.embedDownloaders?.length) {
        for (const dl of settings.embedDownloaders) {
            lines.push(`[embed.downloader.${dl.provider}]`);
            for (const [key, value] of Object.entries(dl)) {
                if (key === 'provider') continue;
                lines.push(`${key} = ${value}`);
            }
            lines.push('');
        }
    }

    lines.push('[downloader]');
    if (settings.cookie) {
        lines.push(`cookie = ${settings.cookie}`);
    }
    if (settings.outDir) {
        lines.push(`out.dir = ${settings.outDir}`);
    }
    lines.push('');

    if (settings.include && Object.keys(settings.include).length > 0) {
        lines.push('[include]');
        for (const [key, value] of Object.entries(settings.include)) {
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

    downloader.on('targetBegin', (payload: { target: { attributes?: { title?: string; name?: string } } }) => {
        const target = payload.target;
        const name = target?.attributes?.title || target?.attributes?.name || 'Unknown';
        callbacks.onLog?.('info', `Processing: ${name}`);
        callbacks.onTargetBegin?.({ name });
    });

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

                batch.on('taskProgress', (tp: Record<string, unknown>) => {
                    const progress = tp.progress as Record<string, unknown>;
                    callbacks.onProgress?.({
                        filename: progress.destFilename as string,
                        percent: (progress.percent as number) || 0,
                        speed: (progress.speed as number) || 0,
                        sizeDownloaded: (progress.sizeDownloaded as number) || 0,
                    });
                });

                batch.on('taskComplete', (tp: Record<string, unknown>) => {
                    const task = tp.task as Record<string, unknown>;
                    const filename = (task.resolvedDestFilename as string) || 'file';
                    callbacks.onLog?.('success', `Downloaded: ${filename}`);
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

/**
 * Find video files recursively in a directory.
 */
function findVideoFiles(dir: string): string[] {
    const videoFiles: string[] = [];
    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                videoFiles.push(...findVideoFiles(fullPath));
            } else if (stat.isFile() && VIDEO_EXTENSIONS.some((ext) => entry.toLowerCase().endsWith(ext))) {
                videoFiles.push(fullPath);
            }
        }
    } catch {
        // Skip unreadable directories
    }
    return videoFiles;
}

/**
 * Get video resolution via ffprobe.
 */
function getVideoResolution(filePath: string): Promise<VideoResolution | null> {
    return new Promise((resolve) => {
        const proc = spawn('ffprobe', [
            '-v',
            'error',
            '-select_streams',
            'v:0',
            '-show_entries',
            'stream=width,height',
            '-of',
            'csv=s=x:p=0',
            filePath,
        ]);
        let output = '';
        proc.stdout.on('data', (d: Buffer) => {
            output += d;
        });
        proc.on('close', (code: number | null) => {
            if (code !== 0) return resolve(null);
            const [w, h] = output.trim().split('x').map(Number);
            if (w && h) resolve({ width: w, height: h });
            else resolve(null);
        });
        proc.on('error', () => resolve(null));
    });
}

/**
 * Check if resolution is already 480p.
 */
function is480p(resolution: VideoResolution): boolean {
    return Math.min(resolution.width, resolution.height) === 480;
}

/**
 * Encode a single video to 480p. Returns a promise.
 */
function encodeFile(inputPath: string, outputPath: string, resolution: VideoResolution): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const isPortrait = resolution.height > resolution.width;
        const scaleFilter = isPortrait ? 'scale=480:-2' : 'scale=-2:480';
        const videoCodec = platform() === 'darwin' ? ['h264_videotoolbox', '-q:v', '65'] : ['libx264', '-crf', '23'];

        const proc = spawn('ffmpeg', [
            '-i',
            inputPath,
            '-vf',
            scaleFilter,
            '-c:v',
            ...videoCodec,
            '-c:a',
            'copy',
            '-y',
            outputPath,
        ]);

        proc.on('close', (code: number | null) => {
            if (code === 0) resolve(true);
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

/**
 * Find and encode all videos in dataDir that are not already 480p.
 */
export async function encodeVideos(dataDir: string, callbacks: EncodeCallbacks): Promise<void> {
    callbacks.onLog?.('info', 'Scanning for videos to encode...');

    const videoFiles = findVideoFiles(dataDir);
    const toEncode: Array<{ filePath: string; resolution: VideoResolution }> = [];

    for (const filePath of videoFiles) {
        // Skip temp encoding files
        if (filePath.includes('.encoding.')) continue;

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
        const filename = filePath.split('/').pop() || '';
        callbacks.onLog?.('info', `Encoding: ${filename}`);
        callbacks.onEncodingProgress?.({ current: filename, completed, total: toEncode.length });

        const outputPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.mp4');
        const tempPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.encoding.mp4');
        const isFormatConversion = filePath !== outputPath;

        try {
            await encodeFile(filePath, tempPath, resolution);
            if (isFormatConversion) {
                try {
                    unlinkSync(outputPath);
                } catch {
                    /* ignore */
                }
            }
            renameSync(tempPath, outputPath);
            if (isFormatConversion) {
                try {
                    unlinkSync(filePath);
                } catch {
                    /* ignore */
                }
            }
            completed++;
            callbacks.onLog?.('success', `Encoded: ${filename}`);
            callbacks.onEncodingProgress?.({ current: null, completed, total: toEncode.length });
        } catch (err) {
            callbacks.onLog?.('error', `Failed to encode ${filename}: ${(err as Error).message}`);
            try {
                unlinkSync(tempPath);
            } catch {
                /* ignore */
            }
        }
    }

    callbacks.onLog?.('success', `Encoding complete: ${completed}/${toEncode.length} videos processed`);
    callbacks.onEncodingEnd?.();
}
