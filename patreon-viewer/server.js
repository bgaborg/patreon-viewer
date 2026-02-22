const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { engine } = require('express-handlebars');
const archiver = require('archiver');

const app = express();
const PORT = 3000;

// Path to the data directory containing creator folders
const DATA_DIR = path.resolve(__dirname, '../data');

// Configure Handlebars
app.engine('handlebars', engine({
    defaultLayout: 'main',
    helpers: {
        formatDate: (dateString) => dateString ? moment(dateString).format('MMMM DD, YYYY') : '',
        stripHtml: (html) => (html || '').replace(/<[^>]*>/g, ''),
        truncate: (str, length) => {
            if (!str) return '';
            if (str.length > length) {
                return `${str.substring(0, length)}...`;
            }
            return str;
        },
        postTypeBadge: (type) => {
            const types = {
                video_embed: { icon: 'fa-video', label: 'Video' },
                video_external_file: { icon: 'fa-video', label: 'Video' },
                audio_embed: { icon: 'fa-music', label: 'Audio' },
                image_file: { icon: 'fa-image', label: 'Image' },
                text_only: { icon: 'fa-align-left', label: 'Text' },
            };
            const safeType = (type || '').replace(/[<>&"']/g, '');
            const t = types[type] || { icon: 'fa-file', label: safeType };
            return `<i class="fas ${t.icon} me-1"></i>${t.label}`;
        },
        encodeMediaPath: (...segments) => {
            const parts = segments.slice(0, -1);
            return '/media/' + parts.map(s => encodeURIComponent(s)).join('/');
        },
        endsWith: (str, suffix) => {
            if (!str || !suffix) return false;
            return str.toString().endsWith(suffix.toString());
        },
        eq: function(a, b, options) {
            if (options && options.fn) {
                return a === b ? options.fn(this) : options.inverse(this);
            }
            return a === b;
        },
        isVideo: (filename) => {
            if (!filename) return false;
            const lower = filename.toLowerCase();
            return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv');
        }
    }
}));
app.set('view engine', 'handlebars');
app.use(express.static(path.join(__dirname, 'public')));

// Function to get list of creators with display names
async function getCreators() {
    const creators = [];
    const entries = await fs.readdir(DATA_DIR);

    for (const dir of entries) {
        if (dir.startsWith('.')) continue;
        const postsDir = path.join(DATA_DIR, dir, 'posts');
        if (!await fs.pathExists(postsDir)) continue;

        let displayName = dir;
        const infoFile = path.join(DATA_DIR, dir, 'campaign_info', 'info.txt');
        if (await fs.pathExists(infoFile)) {
            const content = await fs.readFile(infoFile, 'utf8');
            const parsed = parseInfoFile(content);
            if (parsed.Name) displayName = parsed.Name;
        }

        creators.push({ dir, displayName });
    }

    return creators;
}

// Resolve image file with jpg/webp fallback, returns null if neither exists
async function resolveImage(dir, baseName) {
    const jpg = path.join(dir, `${baseName}.jpg`);
    if (await fs.pathExists(jpg)) return jpg;
    const webp = path.join(dir, `${baseName}.webp`);
    if (await fs.pathExists(webp)) return webp;
    return null;
}

// Find a single post by ID without scanning everything
async function findPostById(postId) {
    const creatorDirs = await fs.readdir(DATA_DIR);
    for (const creatorDir of creatorDirs) {
        if (creatorDir.startsWith('.')) continue;
        const postsDir = path.join(DATA_DIR, creatorDir, 'posts');
        if (!await fs.pathExists(postsDir)) continue;
        const postDirs = await fs.readdir(postsDir);
        for (const postDir of postDirs) {
            if (!postDir.startsWith(postId + ' ')) continue;
            const postPath = path.join(postsDir, postDir);
            const stats = await fs.stat(postPath);
            if (!stats.isDirectory()) continue;
            return readSinglePost(creatorDir, postDir, postPath);
        }
    }
    return null;
}

// Read a single post directory into a post object
async function readSinglePost(creatorDir, postDir, postPath) {
    const postInfoPath = path.join(postPath, 'post_info');

    const infoFile = path.join(postInfoPath, 'info.txt');
    let postInfo = {};
    if (await fs.pathExists(infoFile)) {
        const infoContent = await fs.readFile(infoFile, 'utf8');
        postInfo = parseInfoFile(infoContent);
    }

    const apiFile = path.join(postInfoPath, 'post-api.json');
    let apiData = {};
    if (await fs.pathExists(apiFile)) {
        try {
            const apiContent = await fs.readFile(apiFile, 'utf8');
            apiData = JSON.parse(apiContent);
        } catch (e) {
            console.error(`Invalid JSON in ${apiFile}:`, e.message);
        }
    }

    const attachmentsPath = path.join(postPath, 'attachments');
    let attachments = [];
    if (await fs.pathExists(attachmentsPath)) {
        attachments = (await fs.readdir(attachmentsPath)).filter(f => !f.startsWith('.'));
    }

    const embedPath = path.join(postPath, 'embed');
    let embedFiles = [];
    if (await fs.pathExists(embedPath)) {
        embedFiles = (await fs.readdir(embedPath)).filter(f => !f.startsWith('.'));
    }

    const imagesPath = path.join(postPath, 'images');
    let images = [];
    if (await fs.pathExists(imagesPath)) {
        images = (await fs.readdir(imagesPath)).filter(f => !f.startsWith('.'));
    }

    const thumbnailPath = await resolveImage(postInfoPath, 'thumbnail');
    const coverImagePath = await resolveImage(postInfoPath, 'cover-image');

    return {
        id: postInfo.ID || apiData.data?.id,
        title: postInfo.Title || apiData.data?.attributes?.title,
        content: postInfo.Content || apiData.data?.attributes?.content,
        teaser: postInfo.Teaser,
        type: postInfo.Type || apiData.data?.attributes?.post_type,
        published: postInfo.Published || apiData.data?.attributes?.published_at,
        lastEdited: postInfo['Last Edited'] || apiData.data?.attributes?.edited_at,
        url: postInfo.URL || apiData.data?.attributes?.url,
        likeCount: apiData.data?.attributes?.like_count,
        commentCount: apiData.data?.attributes?.comment_count,
        attachments,
        embedFiles,
        images,
        hasThumbnail: !!thumbnailPath,
        thumbnailFile: thumbnailPath ? path.basename(thumbnailPath) : null,
        hasCoverImage: !!coverImagePath,
        coverImageFile: coverImagePath ? path.basename(coverImagePath) : null,
        creatorDir,
        dirName: postDir,
        apiData: apiData.data?.attributes
    };
}

// Function to read post data from all creator directories
async function readPostData(creatorFilter) {
    try {
        const posts = [];
        const creatorDirs = await fs.readdir(DATA_DIR);

        for (const creatorDir of creatorDirs) {
            if (creatorDir.startsWith('.')) continue;
            if (creatorFilter && creatorDir !== creatorFilter) continue;

            const postsDir = path.join(DATA_DIR, creatorDir, 'posts');
            if (!await fs.pathExists(postsDir)) continue;

            const postDirs = await fs.readdir(postsDir);

            for (const postDir of postDirs) {
                if (postDir.startsWith('.')) continue;

                const postPath = path.join(postsDir, postDir);
                const stats = await fs.stat(postPath);

                if (stats.isDirectory()) {
                    try {
                        const post = await readSinglePost(creatorDir, postDir, postPath);
                        if (post) posts.push(post);
                    } catch (error) {
                        console.error(`Error reading post ${postDir}:`, error.message);
                    }
                }
            }
        }

        posts.sort((a, b) => {
            const dateA = new Date(a.published || 0);
            const dateB = new Date(b.published || 0);
            return dateB - dateA;
        });

        return posts;
    } catch (error) {
        console.error('Error reading data directory:', error);
        return [];
    }
}

function parseInfoFile(content) {
    const lines = content.split('\n');
    const post = {};
    let currentKey = null;

    for (const line of lines) {
        const match = line.match(/^([A-Za-z][\w\s]*?):\s?(.*)/);
        if (match) {
            currentKey = match[1].trim();
            post[currentKey] = match[2];
        } else if (currentKey && line.startsWith('  ')) {
            post[currentKey] += '\n' + line;
        }
    }

    return post;
}

// Routes
app.get('/', async (req, res) => {
    try {
        const creatorFilter = req.query.creator || null;
        const posts = await readPostData(creatorFilter);
        const creators = await getCreators();
        res.render('home', {
            title: 'Patreon Posts',
            posts: posts,
            totalPosts: posts.length,
            creators: creators,
            selectedCreator: creatorFilter
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        res.status(500).render('error', { error: 'Failed to load posts' });
    }
});

app.get('/post/:id', async (req, res) => {
    try {
        const post = await findPostById(req.params.id);

        if (!post) {
            return res.status(404).render('error', { error: 'Post not found' });
        }

        res.render('post', {
            title: post.title,
            post: post
        });
    } catch (error) {
        console.error('Error loading post:', error);
        res.status(500).render('error', { error: 'Failed to load post' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const creatorFilter = req.query.creator || null;
        const posts = await readPostData(creatorFilter);
        res.json(posts);
    } catch (error) {
        console.error('Error loading posts:', error);
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

app.get('/api/creators', async (req, res) => {
    try {
        const creators = await getCreators();
        res.json(creators);
    } catch (error) {
        console.error('Error loading creators:', error);
        res.status(500).json({ error: 'Failed to load creators' });
    }
});

// Download all attachments as zip
app.get('/post/:id/attachments.zip', async (req, res) => {
    try {
        const post = await findPostById(req.params.id);
        if (!post || !post.attachments.length) {
            return res.status(404).send('No attachments found');
        }

        const attachmentsDir = path.join(DATA_DIR, post.creatorDir, 'posts', post.dirName, 'attachments');
        // Extract display name: "hash - Display Name" -> "Display Name"
        const dashIdx = post.creatorDir.indexOf(' - ');
        const creator = dashIdx !== -1 ? post.creatorDir.substring(dashIdx + 3) : post.creatorDir;
        const sanitize = (s) => s.replace(/[^a-zA-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim();
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

// Serve media files with path traversal protection
const ALLOWED_MEDIA_TYPES = new Set(['post_info', 'attachments', 'embed', 'images']);

app.get('/media/:creatorDir/:postDir/:type/:filename', async (req, res) => {
    const { creatorDir, postDir, type, filename } = req.params;

    if (!ALLOWED_MEDIA_TYPES.has(type)) {
        return res.status(400).send('Invalid media type');
    }

    const filePath = path.resolve(DATA_DIR, creatorDir, 'posts', postDir, type, filename);

    if (!filePath.startsWith(DATA_DIR)) {
        return res.status(403).send('Forbidden');
    }

    if (await fs.pathExists(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
