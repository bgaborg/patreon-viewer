#!/usr/bin/env node

import { execSync } from 'child_process';
import { readdirSync, statSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';

interface VideoResolution {
  width: number;
  height: number;
}

/**
 * Get video resolution using ffprobe
 */
function getVideoResolution(filePath: string): VideoResolution | null {
  try {
    const output = execSync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim();

    const [width, height] = output.split('x').map(Number);
    return { width, height };
  } catch (error) {
    console.error(`Error getting resolution for ${filePath}:`, error);
    return null;
  }
}

/**
 * Check if video is already 480p
 * For 480p, the smaller dimension should be 480 pixels
 */
function is480p(resolution: VideoResolution): boolean {
  const smallerDimension = Math.min(resolution.width, resolution.height);
  return smallerDimension === 480;
}

/**
 * Encode video to 480p using ffmpeg
 */
function encodeToP480(inputPath: string, outputPath: string): boolean {
  try {
    console.log(`Encoding: ${inputPath}`);

    // Use ffmpeg to scale video to 480p
    // -vf scale=-2:480 for landscape (scales width automatically to maintain aspect ratio)
    // -vf scale=480:-2 for portrait (scales height automatically to maintain aspect ratio)
    // The -2 ensures the dimension is divisible by 2 (required for h264)

    const resolution = getVideoResolution(inputPath);
    if (!resolution) {
      console.error(`Failed to get resolution for ${inputPath}`);
      return false;
    }

    // Determine if video is portrait or landscape
    const isPortrait = resolution.height > resolution.width;
    const scaleFilter = isPortrait ? 'scale=480:-2' : 'scale=-2:480';

    // Encode with h264 codec, reasonable quality
    execSync(
      `ffmpeg -i "${inputPath}" -vf "${scaleFilter}" -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -y "${outputPath}"`,
      { stdio: 'inherit' }
    );

    console.log(`Successfully encoded: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`Error encoding ${inputPath}:`, error);
    return false;
  }
}

/**
 * Recursively find all MP4 files in a directory
 */
function findMP4Files(dir: string): string[] {
  const mp4Files: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively search subdirectories
        mp4Files.push(...findMP4Files(fullPath));
      } else if (stat.isFile() && entry.toLowerCase().endsWith('.mp4')) {
        mp4Files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  return mp4Files;
}

/**
 * Main function to process all MP4 files
 */
function main() {
  const targetDir = './data';

  console.log(`Scanning for MP4 files in: ${targetDir}`);
  const mp4Files = findMP4Files(targetDir);

  console.log(`Found ${mp4Files.length} MP4 files`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of mp4Files) {
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
      // Create temporary output path
      const tempPath = filePath.replace(/\.mp4$/i, '_temp.mp4');

      if (encodeToP480(filePath, tempPath)) {
        try {
          // Replace original file with encoded version
          unlinkSync(filePath);
          renameSync(tempPath, filePath);
          console.log(`Replaced original file with 480p version`);
          processed++;
        } catch (error) {
          console.error(`Error replacing file ${filePath}:`, error);
          // Clean up temp file if replacement failed
          try {
            unlinkSync(tempPath);
          } catch {}
          failed++;
        }
      } else {
        // Clean up temp file if encoding failed
        try {
          unlinkSync(tempPath);
        } catch {}
        failed++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total files: ${mp4Files.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped (already 480p): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

// Run the script
main();
