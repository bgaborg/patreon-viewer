import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { reset, state } from './download-state.js';

let tmpDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-routes-test-'));

    // Create minimal creator structure so app doesn't error
    const creatorDir = path.join(tmpDir, 'test123 - Test Creator');
    await fs.mkdirp(path.join(creatorDir, 'posts'));
    await fs.mkdirp(path.join(creatorDir, 'campaign_info'));
    await fs.writeFile(path.join(creatorDir, 'campaign_info', 'info.txt'), 'Name: Test Creator');

    app = createApp(tmpDir);
});

afterAll(async () => {
    await fs.remove(tmpDir);
});

afterEach(() => {
    reset();
    state.sseClients.clear();
});

describe('GET /download', () => {
    it('returns 200 with HTML', async () => {
        const res = await request(app).get('/download');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.text).toContain('Add Content');
    });
});

describe('GET /download/progress', () => {
    it('returns SSE headers', async () => {
        const res = await request(app)
            .get('/download/progress')
            .buffer(true)
            .parse((res, cb) => {
                let data = '';
                res.on('data', (chunk: Buffer) => {
                    data += chunk.toString();
                    // Close after first message
                    res.destroy();
                });
                res.on('end', () => cb(null, data));
                res.on('error', () => cb(null, data));
                res.on('close', () => cb(null, data));
            });

        expect(res.headers['content-type']).toBe('text/event-stream');
        expect(res.headers['cache-control']).toBe('no-cache');
        expect(res.body).toContain('event: state');
    });
});

describe('POST /download/start', () => {
    it('rejects missing URL with 400', async () => {
        const res = await request(app).post('/download/start').send({}).set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid URL/);
    });

    it('rejects invalid URL with 400', async () => {
        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://example.com/something' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('rejects non-Patreon URL with 400', async () => {
        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://youtube.com/watch?v=123' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });

    it('returns 409 if download already in progress', async () => {
        state.status = 'downloading';

        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://www.patreon.com/posts/12345' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already in progress/);
    });

    it('accepts valid post URL and returns ok', async () => {
        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://www.patreon.com/posts/my-post-12345' })
            .set('Content-Type', 'application/json');
        // It will return 200 ok even though the background import will fail
        // (because the orchestrator import path is default and may not resolve in test)
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('accepts valid collection URL', async () => {
        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://www.patreon.com/collection/12345' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('accepts creator page URL', async () => {
        const res = await request(app)
            .post('/download/start')
            .send({ url: 'https://www.patreon.com/someCreator' })
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});

describe('POST /download/abort', () => {
    it('returns 400 if no active download', async () => {
        const res = await request(app).post('/download/abort');
        expect(res.status).toBe(400);
    });

    it('returns ok if download is active', async () => {
        state.status = 'downloading';
        state.abortController = new AbortController();

        const res = await request(app).post('/download/abort');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(state.status).toBe('aborting');
    });
});

describe('GET /download/settings', () => {
    it('returns settings object', async () => {
        // Write a test embed.conf
        await fs.writeFile(
            path.join(tmpDir, 'embed.conf'),
            '[downloader]\ncookie = test_cookie\n\n[include]\nposts.with.media.type = attachment\n',
        );

        const res = await request(app).get('/download/settings');
        expect(res.status).toBe(200);
        expect(res.body.cookie).toBe('test_cookie');
        expect(res.body.include['posts.with.media.type']).toBe('attachment');
    });

    it('returns empty defaults when no embed.conf', async () => {
        await fs.remove(path.join(tmpDir, 'embed.conf'));

        const res = await request(app).get('/download/settings');
        expect(res.status).toBe(200);
        expect(res.body.cookie).toBe('');
        expect(res.body.embedDownloaders).toEqual([]);
    });
});

describe('POST /download/settings', () => {
    it('saves settings and reads them back', async () => {
        const settings = {
            cookie: 'new_cookie_value',
            embedDownloaders: [],
            include: { 'posts.with.media.type': 'video, attachment' },
        };

        const saveRes = await request(app)
            .post('/download/settings')
            .send(settings)
            .set('Content-Type', 'application/json');
        expect(saveRes.status).toBe(200);
        expect(saveRes.body.ok).toBe(true);

        // Read back
        const getRes = await request(app).get('/download/settings');
        expect(getRes.body.cookie).toBe('new_cookie_value');
        expect(getRes.body.include['posts.with.media.type']).toBe('video, attachment');
    });

    it('rejects non-object JSON body with 400', async () => {
        const res = await request(app)
            .post('/download/settings')
            .send([1, 2, 3])
            .set('Content-Type', 'application/json');
        expect(res.status).toBe(400);
    });
});
