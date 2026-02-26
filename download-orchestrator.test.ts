import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseEmbedConf, writeEmbedConf } from './download-orchestrator.js';

describe('parseEmbedConf', () => {
    it('parses embed downloaders', () => {
        const content = [
            '[embed.downloader.youtube]',
            'exec = yt-dlp -o "{dest.dir}/%(title)s.%(ext)s" "{embed.url}"',
            '',
            '[embed.downloader.vimeo]',
            'exec = patreon-dl-vimeo -o "{dest.dir}/%(title)s.%(ext)s"',
        ].join('\n');

        const result = parseEmbedConf(content);
        expect(result.embedDownloaders).toHaveLength(2);
        expect(result.embedDownloaders[0].provider).toBe('youtube');
        expect(result.embedDownloaders[0].exec).toContain('yt-dlp');
        expect(result.embedDownloaders[1].provider).toBe('vimeo');
    });

    it('parses cookie from downloader section', () => {
        const content = ['[downloader]', 'cookie = session_id=abc123; auth_token=xyz'].join('\n');

        const result = parseEmbedConf(content);
        expect(result.cookie).toBe('session_id=abc123; auth_token=xyz');
    });

    it('parses include section', () => {
        const content = ['[include]', 'posts.with.media.type = attachment', 'locked.content = true'].join('\n');

        const result = parseEmbedConf(content);
        expect(result.include['posts.with.media.type']).toBe('attachment');
        expect(result.include['locked.content']).toBe('true');
    });

    it('parses full config with all sections', () => {
        const content = [
            '[embed.downloader.youtube]',
            'exec = yt-dlp "{embed.url}"',
            '',
            '[downloader]',
            'cookie = myCookie=value',
            '',
            '[include]',
            'posts.with.media.type = attachment',
        ].join('\n');

        const result = parseEmbedConf(content);
        expect(result.cookie).toBe('myCookie=value');
        expect(result.embedDownloaders).toHaveLength(1);
        expect(result.include['posts.with.media.type']).toBe('attachment');
    });

    it('returns empty defaults for empty content', () => {
        const result = parseEmbedConf('');
        expect(result.cookie).toBe('');
        expect(result.embedDownloaders).toEqual([]);
        expect(result.include).toEqual({});
    });

    it('ignores comments and blank lines', () => {
        const content = ['# This is a comment', '; Another comment', '', '[downloader]', 'cookie = value'].join('\n');

        const result = parseEmbedConf(content);
        expect(result.cookie).toBe('value');
    });

    it('parses out.dir from downloader section', () => {
        const content = ['[downloader]', 'out.dir = /some/path'].join('\n');

        const result = parseEmbedConf(content);
        expect(result.outDir).toBe('/some/path');
    });
});

describe('writeEmbedConf', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'embed-conf-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('writes a basic config with cookie and include', () => {
        writeEmbedConf(tmpDir, {
            cookie: 'session=abc',
            include: { 'posts.with.media.type': 'attachment' },
        });

        const content = readFileSync(join(tmpDir, 'embed.conf'), 'utf8');
        expect(content).toContain('[downloader]');
        expect(content).toContain('cookie = session=abc');
        expect(content).toContain('[include]');
        expect(content).toContain('posts.with.media.type = attachment');
    });

    it('writes embed downloaders', () => {
        writeEmbedConf(tmpDir, {
            cookie: '',
            embedDownloaders: [{ provider: 'youtube', exec: 'yt-dlp "{embed.url}"' }],
            include: {},
        });

        const content = readFileSync(join(tmpDir, 'embed.conf'), 'utf8');
        expect(content).toContain('[embed.downloader.youtube]');
        expect(content).toContain('exec = yt-dlp "{embed.url}"');
    });

    it('roundtrips through parse and write', () => {
        const original = {
            cookie: 'my_cookie=value',
            embedDownloaders: [
                { provider: 'youtube', exec: 'yt-dlp "{embed.url}"' },
                { provider: 'vimeo', exec: 'patreon-dl-vimeo "{embed.url}"' },
            ],
            include: {
                'posts.with.media.type': 'attachment',
                'locked.content': 'true',
            },
            outDir: null,
        };

        writeEmbedConf(tmpDir, original);
        const content = readFileSync(join(tmpDir, 'embed.conf'), 'utf8');
        const parsed = parseEmbedConf(content);

        expect(parsed.cookie).toBe(original.cookie);
        expect(parsed.embedDownloaders).toHaveLength(2);
        expect(parsed.embedDownloaders[0].provider).toBe('youtube');
        expect(parsed.embedDownloaders[1].provider).toBe('vimeo');
        expect(parsed.include['posts.with.media.type']).toBe('attachment');
        expect(parsed.include['locked.content']).toBe('true');
    });
});
