import { spawn } from 'node:child_process';
import { renameSync, unlinkSync } from 'node:fs';
import { platform } from 'node:os';

export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv'] as const;

export interface VideoResolution {
    width: number;
    height: number;
}

export function isTempEncodeFile(filePath: string): boolean {
    return filePath.includes('.encoding.');
}

export function isVideoFile(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function is480p(resolution: VideoResolution): boolean {
    return Math.min(resolution.width, resolution.height) <= 480;
}

export function getVideoResolution(filePath: string): Promise<VideoResolution | null> {
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
            if (code !== 0) {
                resolve(null);
                return;
            }
            const [w, h] = output.trim().split('x').map(Number);
            if (w && h) resolve({ width: w, height: h });
            else resolve(null);
        });
        proc.on('error', () => resolve(null));
    });
}

export function encodeTo480p(
    inputPath: string,
    outputPath: string,
    resolution: VideoResolution,
    signal?: AbortSignal,
): Promise<void> {
    return new Promise((resolve, reject) => {
        signal?.throwIfAborted();

        const isPortrait = resolution.height > resolution.width;
        const scaleFilter = isPortrait ? 'scale=480:-2' : 'scale=-2:480';
        const videoCodec = platform() === 'darwin' ? ['h264_videotoolbox', '-q:v', '65'] : ['libx264', '-crf', '23'];

        const proc = spawn(
            'ffmpeg',
            [
                '-i',
                inputPath,
                '-vf',
                scaleFilter,
                '-c:v',
                ...videoCodec,
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-y',
                outputPath,
            ],
            { signal },
        );

        proc.on('close', (code: number | null) => {
            if (signal?.aborted) {
                reject(signal.reason ?? new Error('Aborted'));
                return;
            }
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });
        proc.on('error', reject);
    });
}

export async function encodeFileInPlace(
    filePath: string,
    resolution: VideoResolution,
    signal?: AbortSignal,
): Promise<string> {
    const outputPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.mp4');
    const tempPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.encoding.mp4');
    try {
        await encodeTo480p(filePath, tempPath, resolution, signal);
        if (filePath !== outputPath) {
            try {
                unlinkSync(outputPath);
            } catch {
                /* ignore */
            }
        }
        renameSync(tempPath, outputPath);
        if (filePath !== outputPath) {
            try {
                unlinkSync(filePath);
            } catch {
                /* ignore */
            }
        }
        return outputPath;
    } catch (err) {
        try {
            unlinkSync(tempPath);
        } catch {
            /* ignore */
        }
        throw err;
    }
}
