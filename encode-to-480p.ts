#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface VideoResolution {
    width: number;
    height: number;
}

export function getVideoResolution(filePath: string): VideoResolution | null {
    try {
        const output = execSync(
            `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`,
            { encoding: 'utf-8' },
        ).trim();

        const [width, height] = output.split('x').map(Number);
        return { width, height };
    } catch (error) {
        console.error(`Error getting resolution for ${filePath}:`, error);
        return null;
    }
}

export function is480p(resolution: VideoResolution): boolean {
    const smallerDimension = Math.min(resolution.width, resolution.height);
    return smallerDimension === 480;
}

export function encodeToP480(inputPath: string, outputPath: string, resolution: VideoResolution): boolean {
    try {
        console.log(`Encoding: ${inputPath}`);

        const isPortrait = resolution.height > resolution.width;
        const scaleFilter = isPortrait ? 'scale=480:-2' : 'scale=-2:480';

        const videoCodec = platform() === 'darwin' ? 'h264_videotoolbox -q:v 65' : 'libx264 -crf 23';

        execSync(`ffmpeg -i "${inputPath}" -vf "${scaleFilter}" -c:v ${videoCodec} -c:a copy -y "${outputPath}"`, {
            stdio: 'inherit',
        });

        console.log(`Successfully encoded: ${outputPath}`);
        return true;
    } catch (error) {
        console.error(`Error encoding ${inputPath}:`, error);
        return false;
    }
}

export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mkv'];

export function findVideoFiles(dir: string): string[] {
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
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }

    return videoFiles;
}

function main() {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const targetDir = resolve(scriptDir, 'data');

    console.log(`Scanning for video files in: ${targetDir}`);
    const videoFiles = findVideoFiles(targetDir);

    console.log(`Found ${videoFiles.length} video files`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of videoFiles) {
        const resolution = getVideoResolution(filePath);

        if (!resolution) {
            console.log(`Skipping ${filePath} - could not read resolution`);
            failed++;
            continue;
        }

        console.log(`\nFile: ${filePath}`);
        console.log(`Resolution: ${resolution.width}x${resolution.height}`);

        if (is480p(resolution)) {
            console.log(`Already 480p - skipping`);
            skipped++;
        } else {
            const outputPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.mp4');
            const tempPath = filePath.replace(/\.(mp4|webm|mkv)$/i, '.encoding.mp4');
            const isFormatConversion = filePath !== outputPath;

            if (encodeToP480(filePath, tempPath, resolution)) {
                try {
                    if (isFormatConversion)
                        try {
                            unlinkSync(outputPath);
                        } catch {}
                    renameSync(tempPath, outputPath);
                    if (isFormatConversion) unlinkSync(filePath);
                    console.log(`Replaced original file with 480p version`);
                    processed++;
                } catch (error) {
                    console.error(`Error replacing file ${filePath}:`, error);
                    try {
                        unlinkSync(tempPath);
                    } catch {}
                    failed++;
                }
            } else {
                try {
                    unlinkSync(tempPath);
                } catch {}
                failed++;
            }
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Total files: ${videoFiles.length}`);
    console.log(`Processed: ${processed}`);
    console.log(`Skipped (already 480p): ${skipped}`);
    console.log(`Failed: ${failed}`);
}

// Only run main() when executed directly, not when imported
const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    main();
}
