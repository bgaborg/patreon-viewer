import path from 'node:path';
import archiver from 'archiver';
import express, { type Express, type Request, type Response } from 'express';
import { engine } from 'express-handlebars';
import fs from 'fs-extra';
import { findPostById, getCreators, readPostData } from './data.js';
import { createDownloadRouter } from './download-routes.js';
import { handlebarsHelpers } from './helpers.js';

const ALLOWED_MEDIA_TYPES = new Set(['post_info', 'attachments', 'embed', 'images', 'video']);

export function createApp(dataDir: string): Express {
    const app = express();

    app.engine(
        'handlebars',
        engine({
            defaultLayout: 'main',
            layoutsDir: path.join(__dirname, '..', 'views', 'layouts'),
            partialsDir: path.join(__dirname, '..', 'views', 'partials'),
            helpers: handlebarsHelpers,
        }),
    );
    app.set('view engine', 'handlebars');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use(createDownloadRouter(dataDir));

    app.get('/', async (req: Request, res: Response) => {
        try {
            const creatorFilter = (req.query.creator as string) || null;
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

    app.get('/post/:id', async (req: Request, res: Response) => {
        try {
            const post = await findPostById(dataDir, req.params.id);

            if (!post) {
                res.status(404).render('error', { error: 'Post not found' });
                return;
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

    app.get('/api/posts', async (req: Request, res: Response) => {
        try {
            const creatorFilter = (req.query.creator as string) || null;
            const posts = await readPostData(dataDir, creatorFilter);
            res.json(posts);
        } catch (error) {
            console.error('Error loading posts:', error);
            res.status(500).json({ error: 'Failed to load posts' });
        }
    });

    app.get('/api/creators', async (_req: Request, res: Response) => {
        try {
            const creators = await getCreators(dataDir);
            res.json(creators);
        } catch (error) {
            console.error('Error loading creators:', error);
            res.status(500).json({ error: 'Failed to load creators' });
        }
    });

    app.get('/post/:id/attachments.zip', async (req: Request, res: Response) => {
        try {
            const post = await findPostById(dataDir, req.params.id);
            if (!post || !post.attachments.length) {
                res.status(404).send('No attachments found');
                return;
            }

            const attachmentsDir = path.join(dataDir, post.creatorDir, 'posts', post.dirName, 'attachments');
            const dashIdx = post.creatorDir.indexOf(' - ');
            const creator = dashIdx !== -1 ? post.creatorDir.substring(dashIdx + 3) : post.creatorDir;
            const sanitize = (s: string) =>
                s
                    .replace(/[^a-zA-Z0-9 _-]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            const zipName = `${sanitize(creator)} - ${sanitize(post.title || 'untitled')}.zip`;
            const encodedZipName = encodeURIComponent(zipName);

            res.set('Content-Type', 'application/zip');
            res.set('Content-Disposition', `attachment; filename="${zipName}"; filename*=UTF-8''${encodedZipName}`);

            const archive = archiver('zip');
            archive.on('error', (err: Error) => {
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

    app.get('/media/:creatorDir/:postDir/:type/:filename', async (req: Request, res: Response) => {
        const { creatorDir, postDir, type, filename } = req.params;

        if (!ALLOWED_MEDIA_TYPES.has(type)) {
            res.status(400).send('Invalid media type');
            return;
        }

        const filePath = path.resolve(dataDir, creatorDir, 'posts', postDir, type, filename);

        if (!filePath.startsWith(path.resolve(dataDir))) {
            res.status(403).send('Forbidden');
            return;
        }

        if (await fs.pathExists(filePath)) {
            res.sendFile(filePath);
        } else {
            res.status(404).send('File not found');
        }
    });

    return app;
}
