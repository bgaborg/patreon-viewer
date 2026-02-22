const express = require('express');
const path = require('node:path');
const fs = require('fs-extra');
const { engine } = require('express-handlebars');
const archiver = require('archiver');
const { handlebarsHelpers } = require('./helpers');
const { findPostById, readPostData, getCreators } = require('./data');

const ALLOWED_MEDIA_TYPES = new Set(['post_info', 'attachments', 'embed', 'images']);

function createApp(dataDir) {
    const app = express();

    app.engine(
        'handlebars',
        engine({
            defaultLayout: 'main',
            layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
            helpers: handlebarsHelpers,
        }),
    );
    app.set('view engine', 'handlebars');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.use(express.static(path.join(__dirname, '..', 'public')));

    app.get('/', async (req, res) => {
        try {
            const creatorFilter = req.query.creator || null;
            const posts = await readPostData(dataDir, creatorFilter);
            const creators = await getCreators(dataDir);
            res.render('home', {
                title: 'Patreon Posts',
                posts: posts,
                totalPosts: posts.length,
                creators: creators,
                selectedCreator: creatorFilter,
            });
        } catch (error) {
            console.error('Error loading posts:', error);
            res.status(500).render('error', { error: 'Failed to load posts' });
        }
    });

    app.get('/post/:id', async (req, res) => {
        try {
            const post = await findPostById(dataDir, req.params.id);

            if (!post) {
                return res.status(404).render('error', { error: 'Post not found' });
            }

            res.render('post', {
                title: post.title,
                post: post,
            });
        } catch (error) {
            console.error('Error loading post:', error);
            res.status(500).render('error', { error: 'Failed to load post' });
        }
    });

    app.get('/api/posts', async (req, res) => {
        try {
            const creatorFilter = req.query.creator || null;
            const posts = await readPostData(dataDir, creatorFilter);
            res.json(posts);
        } catch (error) {
            console.error('Error loading posts:', error);
            res.status(500).json({ error: 'Failed to load posts' });
        }
    });

    app.get('/api/creators', async (_req, res) => {
        try {
            const creators = await getCreators(dataDir);
            res.json(creators);
        } catch (error) {
            console.error('Error loading creators:', error);
            res.status(500).json({ error: 'Failed to load creators' });
        }
    });

    app.get('/post/:id/attachments.zip', async (req, res) => {
        try {
            const post = await findPostById(dataDir, req.params.id);
            if (!post || !post.attachments.length) {
                return res.status(404).send('No attachments found');
            }

            const attachmentsDir = path.join(dataDir, post.creatorDir, 'posts', post.dirName, 'attachments');
            const dashIdx = post.creatorDir.indexOf(' - ');
            const creator = dashIdx !== -1 ? post.creatorDir.substring(dashIdx + 3) : post.creatorDir;
            const sanitize = (s) =>
                s
                    .replace(/[^a-zA-Z0-9 _-]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            const zipName = `${sanitize(creator)} - ${sanitize(post.title)}.zip`;
            const encodedZipName = encodeURIComponent(zipName);

            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', `attachment; filename="${zipName}"; filename*=UTF-8''${encodedZipName}`);

            const archive = archiver('zip');
            archive.on('error', (err) => {
                console.error('Archiver error:', err);
                if (!res.headersSent) res.status(500).send('Failed to create zip');
            });
            archive.pipe(res);
            for (const file of post.attachments) {
                const filePath = path.join(attachmentsDir, file);
                if (await fs.pathExists(filePath)) {
                    archive.file(filePath, { name: file });
                }
            }
            await archive.finalize();
        } catch (error) {
            console.error('Error creating zip:', error);
            if (!res.headersSent) res.status(500).send('Failed to create zip');
        }
    });

    app.get('/media/:creatorDir/:postDir/:type/:filename', async (req, res) => {
        const { creatorDir, postDir, type, filename } = req.params;

        if (!ALLOWED_MEDIA_TYPES.has(type)) {
            return res.status(400).send('Invalid media type');
        }

        const filePath = path.resolve(dataDir, creatorDir, 'posts', postDir, type, filename);

        if (!filePath.startsWith(path.resolve(dataDir))) {
            return res.status(403).send('Forbidden');
        }

        if (await fs.pathExists(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send('File not found');
        }
    });

    return app;
}

module.exports = { createApp };
