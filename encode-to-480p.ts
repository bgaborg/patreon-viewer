#!/usr/bin/env node

import { readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeFileInPlace, getVideoResolution, is480p, isTempEncodeFile, isVideoFile } from './video-encode.js';

export function findVideoFiles(dir: string): string[] {
    const videoFiles: string[] = [];

    try {
        const entries = readdirSync(dir);

        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);

            if (stat.isDirectory()) {
                videoFiles.push(...findVideoFiles(fullPath));
            } else if (stat.isFile() && isVideoFile(entry) && !isTempEncodeFile(entry)) {
                videoFiles.push(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error);
    }

    return videoFiles;
}

async function main() {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const targetDir = resolve(scriptDir, 'data');

    console.log(`Scanning for video files in: ${targetDir}`);
    const videoFiles = findVideoFiles(targetDir);

    console.log(`Found ${videoFiles.length} video files`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of videoFiles) {
        const resolution = await getVideoResolution(filePath);

        if (!resolution) {
            console.log(`Skipping ${filePath} - could not read resolution`);
            failed++;
            continue;
        }

        console.log(`\nFile: ${filePath}`);
        console.log(`Resolution: ${resolution.width}x${resolution.height}`);

        if (is480p(resolution)) {
            console.log('Already 480p or smaller - skipping');
            skipped++;
            continue;
        }

        try {
            await encodeFileInPlace(filePath, resolution);
            console.log('Replaced original file with 480p version');
            processed++;
        } catch (error) {
            console.error(`Error encoding ${filePath}:`, error);
            failed++;
        }
    }

    console.log('\n=== Summary ===');
    console.log(`Total files: ${videoFiles.length}`);
    console.log(`Processed: ${processed}`);
    console.log(`Skipped (already 480p or smaller): ${skipped}`);
    console.log(`Failed: ${failed}`);
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
    main();
}
