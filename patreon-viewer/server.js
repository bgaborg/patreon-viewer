const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { engine } = require('express-handlebars');
const helpers = require('handlebars-helpers')();

const app = express();
const PORT = 3000;


// Configure Handlebars
app.engine('handlebars', engine({
    defaultLayout: 'main',
    helpers: {
        // Use handlebars-helpers library for common functions
        ...helpers,

        // Custom helpers with arrow functions
        formatDate: (dateString) => moment(dateString).format('MMMM DD, YYYY'),
        stripHtml: (html) => html.replace(/<[^>]*>/g, ''),
        truncate: (str, length) => {
            if (str.length > length) {
                return `${str.substring(0, length)}...`;
            }
            return str;
        },
        json: (context) => JSON.stringify(context, null, 2),
        endsWith: (str, suffix) => {
            if (!str || !suffix) return false;
            return str.toString().endsWith(suffix.toString());
        },
        eq: (a, b) => a === b,
        startsWith: (str, prefix) => {
            if (!str || !prefix) return false;
            return str.toString().startsWith(prefix.toString());
        },
        formatBoolean: (value, trueLabel, falseLabel) => {
            if (value === true) return trueLabel || 'Yes';
            if (value === false) return falseLabel || 'No';
            return value; // Return as-is if not boolean
        },
        yesNo: (value) => {
            if (value === true) return 'Yes';
            if (value === false) return 'No';
            return value;
        },
        displayBoolean: (value, fieldName) => {
            if (value === true) {
                switch(fieldName) {
                    case 'hasThumbnail': return 'Has Thumbnail';
                    case 'hasCoverImage': return 'Has Cover Image';
                    case 'isLive': return 'Live';
                    case 'isPublic': return 'Public';
                    case 'isPaid': return 'Paid Content';
                    case 'isPatronOnly': return 'Patron Only';
                    default: return 'Yes';
                }
            }
            if (value === false) {
                switch(fieldName) {
                    case 'hasThumbnail': return 'No Thumbnail';
                    case 'hasCoverImage': return 'No Cover Image';
                    case 'isLive': return 'Not Live';
                    case 'isPublic': return 'Private';
                    case 'isPaid': return 'Free Content';
                    case 'isPatronOnly': return 'Public Access';
                    default: return 'No';
                }
            }
            return value;
        }
    }
}));
app.set('view engine', 'handlebars');
app.use(express.static('public'));

// Path to the data directory containing creator folders
const DATA_DIR = path.join(__dirname, '../data');

// Function to get list of creators with display names
async function getCreators() {
    const creators = [];
    const entries = await fs.readdir(DATA_DIR);

    for (const dir of entries) {
        if (dir.startsWith('.')) continue;
        const postsDir = path.join(DATA_DIR, dir, 'posts');
        if (!await fs.pathExists(postsDir)) continue;

        // Try to read display name from campaign_info/info.txt
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
                        const postInfoPath = path.join(postPath, 'post_info');

                        // Read info.txt
                        const infoFile = path.join(postInfoPath, 'info.txt');
                        let postInfo = {};

                        if (await fs.pathExists(infoFile)) {
                            const infoContent = await fs.readFile(infoFile, 'utf8');
                            postInfo = parseInfoFile(infoContent);
                        }

                        // Read post-api.json if available
                        const apiFile = path.join(postInfoPath, 'post-api.json');
                        let apiData = {};

                        if (await fs.pathExists(apiFile)) {
                            const apiContent = await fs.readFile(apiFile, 'utf8');
                            apiData = JSON.parse(apiContent);
                        }

                        // Check for attachments
                        const attachmentsPath = path.join(postPath, 'attachments');
                        let attachments = [];
                        if (await fs.pathExists(attachmentsPath)) {
                            attachments = await fs.readdir(attachmentsPath);
                            attachments = attachments.filter(file => !file.startsWith('.'));
                        }

                        // Check for embedded content
                        const embedPath = path.join(postPath, 'embed');
                        let embedFiles = [];
                        if (await fs.pathExists(embedPath)) {
                            embedFiles = await fs.readdir(embedPath);
                            embedFiles = embedFiles.filter(file => !file.startsWith('.'));
                        }

                        // Check for images
                        const imagesPath = path.join(postPath, 'images');
                        let images = [];
                        if (await fs.pathExists(imagesPath)) {
                            images = await fs.readdir(imagesPath);
                            images = images.filter(file => !file.startsWith('.'));
                        }

                        // Check for thumbnails
                        const thumbnailPath = path.join(postInfoPath, 'thumbnail.jpg');
                        const coverImagePath = path.join(postInfoPath, 'cover-image.jpg');

                        const post = {
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
                            attachments: attachments,
                            embedFiles: embedFiles,
                            images: images,
                            hasThumbnail: await fs.pathExists(thumbnailPath),
                            hasCoverImage: await fs.pathExists(coverImagePath),
                            creatorDir: creatorDir,
                            dirName: postDir,
                            apiData: apiData.data?.attributes
                        };

                        posts.push(post);
                    } catch (error) {
                        console.error(`Error reading post ${postDir}:`, error.message);
                    }
                }
            }
        }

        // Sort posts by published date (newest first)
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

// Function to parse info.txt file
function parseInfoFile(content) {
    const lines = content.split('\n');
    const post = {};

    for (const line of lines) {
        if (line.includes(':')) {
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            post[key.trim()] = value;
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
        const posts = await readPostData();
        const post = posts.find(p => p.id === req.params.id);

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

// Serve media files
app.get('/media/:creatorDir/:postDir/:type/:filename', (req, res) => {
    const { creatorDir, postDir, type, filename } = req.params;
    const filePath = path.join(DATA_DIR, creatorDir, 'posts', postDir, type, filename);

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
