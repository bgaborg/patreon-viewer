import { describe, expect, it } from 'vitest';
import { handlebarsHelpers, parseInfoFile } from './helpers.js';

const { formatDate, stripHtml, truncate, postTypeBadge, encodeMediaPath, endsWith, eq, isVideo } = handlebarsHelpers;

describe('formatDate', () => {
    it('formats a valid date string', () => {
        expect(formatDate('2024-01-15T12:00:00Z')).toBe('January 15, 2024');
    });

    it('returns empty string for null', () => {
        expect(formatDate(null)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(formatDate('')).toBe('');
    });
});

describe('stripHtml', () => {
    it('removes HTML tags', () => {
        expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    });

    it('returns empty string for null', () => {
        expect(stripHtml(null)).toBe('');
    });
});

describe('truncate', () => {
    it('truncates a long string', () => {
        expect(truncate('Hello World', 5)).toBe('Hello...');
    });

    it('returns short string unchanged', () => {
        expect(truncate('Hi', 10)).toBe('Hi');
    });

    it('returns empty string for null', () => {
        expect(truncate(null, 10)).toBe('');
    });
});

describe('postTypeBadge', () => {
    it('returns video badge for video_embed', () => {
        const result = postTypeBadge('video_embed');
        expect(result).toContain('fa-video');
        expect(result).toContain('Video');
    });

    it('returns audio badge for audio_embed', () => {
        const result = postTypeBadge('audio_embed');
        expect(result).toContain('fa-music');
        expect(result).toContain('Audio');
    });

    it('returns generic badge for unknown type', () => {
        const result = postTypeBadge('unknown_type');
        expect(result).toContain('fa-file');
        expect(result).toContain('unknown_type');
    });

    it('sanitizes XSS in unknown type', () => {
        const result = postTypeBadge('<script>alert("xss")</script>');
        expect(result).not.toContain('<script>');
        // Only the fa-file icon tag should contain angle brackets
        expect(result).toMatch(/^<i class="fas fa-file me-1"><\/i>/);
    });
});

describe('encodeMediaPath', () => {
    it('encodes segments with special chars', () => {
        // Handlebars passes an options hash as the last argument
        const options = { hash: {} };
        const result = encodeMediaPath('creator dir', 'post dir', 'images', 'file name.jpg', options);
        expect(result).toBe('/media/creator%20dir/post%20dir/images/file%20name.jpg');
    });
});

describe('endsWith', () => {
    it('returns true for a match', () => {
        expect(endsWith('file.pdf', '.pdf')).toBe(true);
    });

    it('returns false for no match', () => {
        expect(endsWith('file.pdf', '.txt')).toBe(false);
    });

    it('returns false for null input', () => {
        expect(endsWith(null, '.pdf')).toBe(false);
    });
});

describe('eq', () => {
    it('returns true for equal values', () => {
        expect(eq('a', 'a')).toBe(true);
    });

    it('returns false for different values', () => {
        expect(eq('a', 'b')).toBe(false);
    });

    it('works as block helper', () => {
        const options = {
            fn: () => 'yes',
            inverse: () => 'no',
        };
        expect(eq.call({}, 'a', 'a', options)).toBe('yes');
        expect(eq.call({}, 'a', 'b', options)).toBe('no');
    });
});

describe('isVideo', () => {
    it('returns true for .mp4', () => {
        expect(isVideo('video.mp4')).toBe(true);
    });

    it('returns true for .webm', () => {
        expect(isVideo('video.webm')).toBe(true);
    });

    it('returns true for .mkv', () => {
        expect(isVideo('video.mkv')).toBe(true);
    });

    it('returns false for non-video', () => {
        expect(isVideo('image.jpg')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isVideo(null)).toBe(false);
    });
});

describe('parseInfoFile', () => {
    it('parses simple key-value pairs', () => {
        const content = 'Title: My Post\nID: 12345\nType: text_only';
        const result = parseInfoFile(content);
        expect(result.Title).toBe('My Post');
        expect(result.ID).toBe('12345');
        expect(result.Type).toBe('text_only');
    });

    it('handles multiline values', () => {
        const content = 'Content: First line\n  Second line\n  Third line\nTitle: Test';
        const result = parseInfoFile(content);
        expect(result.Content).toContain('First line');
        expect(result.Content).toContain('Second line');
        expect(result.Content).toContain('Third line');
        expect(result.Title).toBe('Test');
    });

    it('handles empty values', () => {
        const content = 'Title: \nID: 123';
        const result = parseInfoFile(content);
        expect(result.Title).toBe('');
        expect(result.ID).toBe('123');
    });

    it('handles keys with spaces', () => {
        const content = 'Last Edited: 2024-01-01';
        const result = parseInfoFile(content);
        expect(result['Last Edited']).toBe('2024-01-01');
    });
});
