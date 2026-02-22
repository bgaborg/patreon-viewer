const fs = require('fs-extra');
const path = require('node:path');
const { parseInfoFile } = require('./helpers');

async function resolveImage(dir, baseName) {
    const jpg = path.join(dir, `${baseName}.jpg`);
    if (await fs.pathExists(jpg)) return jpg;
    const webp = path.join(dir, `${baseName}.webp`);
    if (await fs.pathExists(webp)) return webp;
    return null;
}

async function readSinglePost(_dataDir, creatorDir, postDir, postPath) {
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
        attachments = (await fs.readdir(attachmentsPath)).filter((f) => !f.startsWith('.'));
    }

    const embedPath = path.join(postPath, 'embed');
    let embedFiles = [];
    if (await fs.pathExists(embedPath)) {
        embedFiles = (await fs.readdir(embedPath)).filter((f) => !f.startsWith('.'));
    }

    const imagesPath = path.join(postPath, 'images');
    let images = [];
    if (await fs.pathExists(imagesPath)) {
        images = (await fs.readdir(imagesPath)).filter((f) => !f.startsWith('.'));
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
        apiData: apiData.data?.attributes,
    };
}

async function findPostById(dataDir, postId) {
    const creatorDirs = await fs.readdir(dataDir);
    for (const creatorDir of creatorDirs) {
        if (creatorDir.startsWith('.')) continue;
        const postsDir = path.join(dataDir, creatorDir, 'posts');
        if (!(await fs.pathExists(postsDir))) continue;
        const postDirs = await fs.readdir(postsDir);
        for (const postDir of postDirs) {
            if (!postDir.startsWith(`${postId} `)) continue;
            const postPath = path.join(postsDir, postDir);
            const stats = await fs.stat(postPath);
            if (!stats.isDirectory()) continue;
            return readSinglePost(dataDir, creatorDir, postDir, postPath);
        }
    }
    return null;
}

async function readPostData(dataDir, creatorFilter) {
    try {
        const posts = [];
        const creatorDirs = await fs.readdir(dataDir);

        for (const creatorDir of creatorDirs) {
            if (creatorDir.startsWith('.')) continue;
            if (creatorFilter && creatorDir !== creatorFilter) continue;

            const postsDir = path.join(dataDir, creatorDir, 'posts');
            if (!(await fs.pathExists(postsDir))) continue;

            const postDirs = await fs.readdir(postsDir);

            for (const postDir of postDirs) {
                if (postDir.startsWith('.')) continue;

                const postPath = path.join(postsDir, postDir);
                const stats = await fs.stat(postPath);

                if (stats.isDirectory()) {
                    try {
                        const post = await readSinglePost(dataDir, creatorDir, postDir, postPath);
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

async function getCreators(dataDir) {
    const creators = [];
    const entries = await fs.readdir(dataDir);

    for (const dir of entries) {
        if (dir.startsWith('.')) continue;
        const postsDir = path.join(dataDir, dir, 'posts');
        if (!(await fs.pathExists(postsDir))) continue;

        let displayName = dir;
        const infoFile = path.join(dataDir, dir, 'campaign_info', 'info.txt');
        if (await fs.pathExists(infoFile)) {
            const content = await fs.readFile(infoFile, 'utf8');
            const parsed = parseInfoFile(content);
            if (parsed.Name) displayName = parsed.Name;
        }

        creators.push({ dir, displayName });
    }

    return creators;
}

module.exports = { resolveImage, readSinglePost, findPostById, readPostData, getCreators };
