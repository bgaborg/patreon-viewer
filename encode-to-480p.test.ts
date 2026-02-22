import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findVideoFiles, is480p, VIDEO_EXTENSIONS } from './encode-to-480p';

describe('is480p', () => {
    it('returns true for landscape 480p (854x480)', () => {
        expect(is480p({ width: 854, height: 480 })).toBe(true);
    });

    it('returns true for portrait 480p (480x854)', () => {
        expect(is480p({ width: 480, height: 854 })).toBe(true);
    });

    it('returns false for 1080p', () => {
        expect(is480p({ width: 1920, height: 1080 })).toBe(false);
    });

    it('returns false for 720p', () => {
        expect(is480p({ width: 1280, height: 720 })).toBe(false);
    });
});

describe('VIDEO_EXTENSIONS', () => {
    it('includes mp4, webm, mkv', () => {
        expect(VIDEO_EXTENSIONS).toContain('.mp4');
        expect(VIDEO_EXTENSIONS).toContain('.webm');
        expect(VIDEO_EXTENSIONS).toContain('.mkv');
    });
});

describe('findVideoFiles', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'encoder-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('finds mp4 files recursively', () => {
        const subDir = join(tmpDir, 'sub');
        mkdirSync(subDir);
        writeFileSync(join(tmpDir, 'video.mp4'), 'fake');
        writeFileSync(join(subDir, 'nested.mp4'), 'fake');

        const files = findVideoFiles(tmpDir);
        expect(files).toHaveLength(2);
        expect(files.some((f) => f.endsWith('video.mp4'))).toBe(true);
        expect(files.some((f) => f.endsWith('nested.mp4'))).toBe(true);
    });

    it('finds webm and mkv files', () => {
        writeFileSync(join(tmpDir, 'video.webm'), 'fake');
        writeFileSync(join(tmpDir, 'video.mkv'), 'fake');

        const files = findVideoFiles(tmpDir);
        expect(files).toHaveLength(2);
    });

    it('excludes non-video files', () => {
        writeFileSync(join(tmpDir, 'image.jpg'), 'fake');
        writeFileSync(join(tmpDir, 'doc.pdf'), 'fake');
        writeFileSync(join(tmpDir, 'video.mp4'), 'fake');

        const files = findVideoFiles(tmpDir);
        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/video\.mp4$/);
    });

    it('returns empty array for empty directory', () => {
        const files = findVideoFiles(tmpDir);
        expect(files).toHaveLength(0);
    });
});
