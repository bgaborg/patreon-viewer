import { describe, expect, it } from 'vitest';
import { is480p, isTempEncodeFile, isVideoFile } from './video-encode.js';

describe('is480p', () => {
    it('treats 480p and smaller as done', () => {
        expect(is480p({ width: 854, height: 480 })).toBe(true);
        expect(is480p({ width: 640, height: 360 })).toBe(true);
        expect(is480p({ width: 1280, height: 720 })).toBe(false);
    });
});

describe('isTempEncodeFile', () => {
    it('detects encoding temp files', () => {
        expect(isTempEncodeFile('/data/clip.encoding.mp4')).toBe(true);
        expect(isTempEncodeFile('/data/clip.mp4')).toBe(false);
    });
});

describe('isVideoFile', () => {
    it('accepts video extensions only', () => {
        expect(isVideoFile('a.mp4')).toBe(true);
        expect(isVideoFile('a.WEBM')).toBe(true);
        expect(isVideoFile('a.jpg')).toBe(false);
    });
});
