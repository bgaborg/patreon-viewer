import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractYouTubeId, findPostById, getCreators, readPostData, resolveImage } from './data.js';

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'patreon-test-'));

    // Create a creator with campaign_info
    const creatorDir = path.join(tmpDir, 'abc123 - Test Creator');
    await fs.mkdirp(path.join(creatorDir, 'campaign_info'));
    await fs.writeFile(
        path.join(creatorDir, 'campaign_info', 'info.txt'),
        'Name: Test Creator\nURL: https://patreon.com/test',
    );
    await fs.mkdirp(path.join(creatorDir, 'posts'));

    // Create a post
    const postDir = path.join(creatorDir, 'posts', '99001 - My Test Post');
    await fs.mkdirp(path.join(postDir, 'post_info'));
    await fs.writeFile(
        path.join(postDir, 'post_info', 'info.txt'),
        'ID: 99001\nTitle: My Test Post\nType: text_only\nPublished: 2024-06-01',
    );
    await fs.mkdirp(path.join(postDir, 'attachments'));
    await fs.writeFile(path.join(postDir, 'attachments', 'doc.pdf'), 'fake pdf');
    await fs.mkdirp(path.join(postDir, 'images'));
    await fs.writeFile(path.join(postDir, 'images', 'photo.jpg'), 'fake jpg');

    // Create a second post
    const postDir2 = path.join(creatorDir, 'posts', '99002 - Second Post');
    await fs.mkdirp(path.join(postDir2, 'post_info'));
    await fs.writeFile(
        path.join(postDir2, 'post_info', 'info.txt'),
        'ID: 99002\nTitle: Second Post\nType: video_embed\nPublished: 2024-07-01',
    );
});

afterEach(async () => {
    await fs.remove(tmpDir);
});

describe('resolveImage', () => {
    it('finds jpg file', async () => {
        const postInfoDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'post_info');
        await fs.writeFile(path.join(postInfoDir, 'thumbnail.jpg'), 'fake');

        const result = await resolveImage(postInfoDir, 'thumbnail');
        expect(result).toBe(path.join(postInfoDir, 'thumbnail.jpg'));
    });

    it('finds webp file when jpg missing', async () => {
        const postInfoDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'post_info');
        await fs.writeFile(path.join(postInfoDir, 'thumbnail.webp'), 'fake');

        const result = await resolveImage(postInfoDir, 'thumbnail');
        expect(result).toBe(path.join(postInfoDir, 'thumbnail.webp'));
    });

    it('returns null when no image exists', async () => {
        const postInfoDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'post_info');
        const result = await resolveImage(postInfoDir, 'nonexistent');
        expect(result).toBeNull();
    });
});

describe('getCreators', () => {
    it('reads display name from campaign_info', async () => {
        const creators = await getCreators(tmpDir);
        expect(creators).toHaveLength(1);
        expect(creators[0].displayName).toBe('Test Creator');
        expect(creators[0].dir).toBe('abc123 - Test Creator');
    });

    it('skips dot directories', async () => {
        await fs.mkdirp(path.join(tmpDir, '.hidden', 'posts'));
        const creators = await getCreators(tmpDir);
        expect(creators).toHaveLength(1);
    });
});

describe('findPostById', () => {
    it('finds post by ID', async () => {
        const post = await findPostById(tmpDir, '99001');
        expect(post).not.toBeNull();
        expect(post?.id).toBe('99001');
        expect(post?.title).toBe('My Test Post');
    });

    it('returns null for missing ID', async () => {
        const post = await findPostById(tmpDir, '00000');
        expect(post).toBeNull();
    });
});

describe('readPostData', () => {
    it('reads all posts sorted by date descending', async () => {
        const posts = await readPostData(tmpDir, null);
        expect(posts).toHaveLength(2);
        // Second Post (2024-07-01) should come first
        expect(posts[0].id).toBe('99002');
        expect(posts[1].id).toBe('99001');
    });

    it('filters by creator', async () => {
        // Create another creator
        const otherCreator = path.join(tmpDir, 'other - Other Creator');
        await fs.mkdirp(path.join(otherCreator, 'posts', '88001 - Other Post', 'post_info'));
        await fs.writeFile(
            path.join(otherCreator, 'posts', '88001 - Other Post', 'post_info', 'info.txt'),
            'ID: 88001\nTitle: Other Post\nPublished: 2024-08-01',
        );
        await fs.mkdirp(path.join(otherCreator, 'campaign_info'));

        const filtered = await readPostData(tmpDir, 'abc123 - Test Creator');
        expect(filtered).toHaveLength(2);
        expect(filtered.every((p) => p.creatorDir === 'abc123 - Test Creator')).toBe(true);
    });

    it('includes attachments and images', async () => {
        const posts = await readPostData(tmpDir, null);
        const post = posts.find((p) => p.id === '99001');
        expect(post?.attachments).toContain('doc.pdf');
        expect(post?.images).toContain('photo.jpg');
    });
});

describe('youtubeEmbeds', () => {
    it('parses YouTube embed from embedded-video.txt', async () => {
        const embedDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'embed');
        await fs.mkdirp(embedDir);
        await fs.writeFile(
            path.join(embedDir, 'embedded-video.txt'),
            [
                'Embed',
                '--------',
                'Type: videoEmbed',
                'Subject: My Cool Video',
                'URL: https://youtu.be/DTp3U1Xr2Ls',
            ].join('\n'),
        );

        const post = await findPostById(tmpDir, '99001');
        expect(post?.youtubeEmbeds).toHaveLength(1);
        expect(post?.youtubeEmbeds[0]).toEqual({
            url: 'https://youtu.be/DTp3U1Xr2Ls',
            videoId: 'DTp3U1Xr2Ls',
            title: 'My Cool Video',
        });
        expect(post?.embedFiles).not.toContain('embedded-video.txt');
    });

    it('parses youtube.com/watch?v= URL format', async () => {
        const embedDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'embed');
        await fs.mkdirp(embedDir);
        await fs.writeFile(
            path.join(embedDir, 'embedded-video.txt'),
            'Subject: Watch Format\nURL: https://www.youtube.com/watch?v=NWoFUIZds04&t=75s',
        );

        const post = await findPostById(tmpDir, '99001');
        expect(post?.youtubeEmbeds).toHaveLength(1);
        expect(post?.youtubeEmbeds[0].videoId).toBe('NWoFUIZds04');
    });

    it('keeps non-YouTube txt files in embedFiles', async () => {
        const embedDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'embed');
        await fs.mkdirp(embedDir);
        await fs.writeFile(
            path.join(embedDir, 'embedded-video.txt'),
            ['Embed', '--------', 'Type: videoEmbed', 'Subject: Vimeo Video', 'URL: https://vimeo.com/123456'].join(
                '\n',
            ),
        );

        const post = await findPostById(tmpDir, '99001');
        expect(post?.youtubeEmbeds).toHaveLength(0);
        expect(post?.embedFiles).toContain('embedded-video.txt');
    });

    it('keeps video files in embedFiles alongside YouTube embeds', async () => {
        const embedDir = path.join(tmpDir, 'abc123 - Test Creator', 'posts', '99001 - My Test Post', 'embed');
        await fs.mkdirp(embedDir);
        await fs.writeFile(path.join(embedDir, 'video.mp4'), 'fake mp4');
        await fs.writeFile(
            path.join(embedDir, 'embedded-video.txt'),
            'Subject: YT Vid\nURL: https://youtu.be/XYZ789abcde',
        );

        const post = await findPostById(tmpDir, '99001');
        expect(post?.youtubeEmbeds).toHaveLength(1);
        expect(post?.embedFiles).toContain('video.mp4');
        expect(post?.embedFiles).not.toContain('embedded-video.txt');
    });
});

describe('extractYouTubeId', () => {
    it.each([
        ['https://youtu.be/DTp3U1Xr2Ls', 'DTp3U1Xr2Ls'],
        ['https://www.youtube.com/watch?v=NWoFUIZds04', 'NWoFUIZds04'],
        ['https://www.youtube.com/watch?v=NWoFUIZds04&t=75s', 'NWoFUIZds04'],
        ['https://www.youtube.com/watch?v=rWvRw9JzWHs&list=PLW&index=1', 'rWvRw9JzWHs'],
        ['https://www.youtube.com/embed/ABC123xyz_-', 'ABC123xyz_-'],
        ['https://www.youtube-nocookie.com/embed/ABC123xyz_-', 'ABC123xyz_-'],
        ['https://www.youtube.com/v/DTp3U1Xr2Ls', 'DTp3U1Xr2Ls'],
        ['https://www.youtube.com/shorts/DTp3U1Xr2Ls', 'DTp3U1Xr2Ls'],
        ['https://www.youtube.com/live/DTp3U1Xr2Ls', 'DTp3U1Xr2Ls'],
        ['https://youtube.com/watch?v=DTp3U1Xr2Ls', 'DTp3U1Xr2Ls'],
    ])('extracts ID from %s', (url, expected) => {
        expect(extractYouTubeId(url)).toBe(expected);
    });

    it.each([
        'https://vimeo.com/123456',
        'https://example.com/video',
        'https://notyoutube.com/watch?v=abc',
    ])('returns null for non-YouTube URL: %s', (url) => {
        expect(extractYouTubeId(url)).toBeNull();
    });
});
