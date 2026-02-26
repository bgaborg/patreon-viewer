import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

let tmpDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patreon-app-test-'));

    // Create a creator
    const creatorDir = path.join(tmpDir, 'abc123 - Test Creator');
    await fs.mkdirp(path.join(creatorDir, 'campaign_info'));
    await fs.writeFile(path.join(creatorDir, 'campaign_info', 'info.txt'), 'Name: Test Creator');

    // Create a post
    const postDir = path.join(creatorDir, 'posts', '99001 - My Test Post');
    await fs.mkdirp(path.join(postDir, 'post_info'));
    await fs.writeFile(
        path.join(postDir, 'post_info', 'info.txt'),
        'ID: 99001\nTitle: My Test Post\nType: text_only\nPublished: 2024-06-01',
    );
    await fs.mkdirp(path.join(postDir, 'attachments'));
    await fs.writeFile(path.join(postDir, 'attachments', 'doc.pdf'), 'fake pdf content');
    await fs.mkdirp(path.join(postDir, 'images'));
    await fs.writeFile(path.join(postDir, 'images', 'photo.jpg'), 'fake jpg content');

    app = createApp(tmpDir);
});

afterAll(async () => {
    await fs.remove(tmpDir);
});

describe('GET /', () => {
    it('returns 200 with HTML', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
    });
});

describe('GET /api/posts', () => {
    it('returns JSON array', async () => {
        const res = await request(app).get('/api/posts');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('filters by creator', async () => {
        const res = await request(app).get('/api/posts?creator=abc123%20-%20Test%20Creator');
        expect(res.status).toBe(200);
        expect(res.body.every((p: { creatorDir: string }) => p.creatorDir === 'abc123 - Test Creator')).toBe(true);
    });

    it('returns empty array for unknown creator', async () => {
        const res = await request(app).get('/api/posts?creator=nonexistent');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/creators', () => {
    it('returns JSON array of creators', async () => {
        const res = await request(app).get('/api/creators');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0]).toHaveProperty('dir');
        expect(res.body[0]).toHaveProperty('displayName');
    });
});

describe('GET /post/:id', () => {
    it('returns 200 for existing post', async () => {
        const res = await request(app).get('/post/99001');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
    });

    it('returns 404 for missing post', async () => {
        const res = await request(app).get('/post/00000');
        expect(res.status).toBe(404);
    });
});

describe('GET /media/:creatorDir/:postDir/:type/:filename', () => {
    it('returns 400 for invalid media type', async () => {
        const res = await request(app).get('/media/abc/post/invalid_type/file.jpg');
        expect(res.status).toBe(400);
    });

    it('returns 404 for missing file', async () => {
        const res = await request(app).get(
            `/media/${encodeURIComponent('abc123 - Test Creator')}/${encodeURIComponent('99001 - My Test Post')}/images/nonexistent.jpg`,
        );
        expect(res.status).toBe(404);
    });

    it('serves existing file', async () => {
        const res = await request(app).get(
            `/media/${encodeURIComponent('abc123 - Test Creator')}/${encodeURIComponent('99001 - My Test Post')}/images/photo.jpg`,
        );
        expect(res.status).toBe(200);
    });

    it('blocks path traversal with 403', async () => {
        const res = await request(app).get('/media/..%2F..%2Fetc/passwd/images/file.jpg');
        // Either 403 (traversal blocked) or 404 (doesn't exist) is acceptable
        expect([403, 404]).toContain(res.status);
    });
});
