import path from 'node:path';
import fs from 'fs-extra';
import { parseInfoFile } from './helpers.js';

export interface PostInfo {
    id: string | undefined;
    title: string | undefined;
    content: string | undefined;
    teaser: string | undefined;
    type: string | undefined;
    published: string | undefined;
    lastEdited: string | undefined;
    url: string | undefined;
    likeCount: number | undefined;
    commentCount: number | undefined;
    attachments: string[];
    embedFiles: string[];
    images: string[];
    hasThumbnail: boolean;
    thumbnailFile: string | null;
    hasCoverImage: boolean;
    coverImageFile: string | null;
    creatorDir: string;
    dirName: string;
    apiData: Record<string, unknown> | undefined;
}

export interface Creator {
    dir: string;
    displayName: string;
}

export async function resolveImage(dir: string, baseName: string): Promise<string | null> {
    const jpg = path.join(dir, `${baseName}.jpg`);
    if (await fs.pathExists(jpg)) return jpg;
    const webp = path.join(dir, `${baseName}.webp`);
    if (await fs.pathExists(webp)) return webp;
    return null;
}

async function readSinglePost(
    _dataDir: string,
    creatorDir: string,
    postDir: string,
    postPath: string,
): Promise<PostInfo> {
    const postInfoPath = path.join(postPath, 'post_info');

    const infoFile = path.join(postInfoPath, 'info.txt');
    let postInfo: Record<string, string> = {};
    if (await fs.pathExists(infoFile)) {
        const infoContent = await fs.readFile(infoFile, 'utf8');
        postInfo = parseInfoFile(infoContent);
    }

    const apiFile = path.join(postInfoPath, 'post-api.json');
    let apiData: Record<string, unknown> = {};
    if (await fs.pathExists(apiFile)) {
        try {
            const apiContent = await fs.readFile(apiFile, 'utf8');
            apiData = JSON.parse(apiContent);
        } catch (e) {
            console.error(`Invalid JSON in ${apiFile}:`, (e as Error).message);
        }
    }

    const data = apiData.data as Record<string, unknown> | undefined;
    const attributes = data?.attributes as Record<string, unknown> | undefined;

    const attachmentsPath = path.join(postPath, 'attachments');
    let attachments: string[] = [];
    if (await fs.pathExists(attachmentsPath)) {
        attachments = (await fs.readdir(attachmentsPath)).filter((f: string) => !f.startsWith('.'));
    }

    const embedPath = path.join(postPath, 'embed');
    let embedFiles: string[] = [];
    if (await fs.pathExists(embedPath)) {
        embedFiles = (await fs.readdir(embedPath)).filter((f: string) => !f.startsWith('.'));
    }

    const imagesPath = path.join(postPath, 'images');
    let images: string[] = [];
    if (await fs.pathExists(imagesPath)) {
        images = (await fs.readdir(imagesPath)).filter((f: string) => !f.startsWith('.'));
    }

    const thumbnailPath = await resolveImage(postInfoPath, 'thumbnail');
    const coverImagePath = await resolveImage(postInfoPath, 'cover-image');

    return {
        id: postInfo.ID || (data?.id as string | undefined),
        title: postInfo.Title || (attributes?.title as string | undefined),
        content: postInfo.Content || (attributes?.content as string | undefined),
        teaser: postInfo.Teaser,
        type: postInfo.Type || (attributes?.post_type as string | undefined),
        published: postInfo.Published || (attributes?.published_at as string | undefined),
        lastEdited: postInfo['Last Edited'] || (attributes?.edited_at as string | undefined),
        url: postInfo.URL || (attributes?.url as string | undefined),
        likeCount: attributes?.like_count as number | undefined,
        commentCount: attributes?.comment_count as number | undefined,
        attachments,
        embedFiles,
        images,
        hasThumbnail: !!thumbnailPath,
        thumbnailFile: thumbnailPath ? path.basename(thumbnailPath) : null,
        hasCoverImage: !!coverImagePath,
        coverImageFile: coverImagePath ? path.basename(coverImagePath) : null,
        creatorDir,
        dirName: postDir,
        apiData: attributes as Record<string, unknown> | undefined,
    };
}

export async function findPostById(dataDir: string, postId: string): Promise<PostInfo | null> {
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

export async function readPostData(dataDir: string, creatorFilter: string | null): Promise<PostInfo[]> {
    try {
        const posts: PostInfo[] = [];
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
                        console.error(`Error reading post ${postDir}:`, (error as Error).message);
                    }
                }
            }
        }

        posts.sort((a, b) => {
            const dateA = new Date(a.published || 0).getTime();
            const dateB = new Date(b.published || 0).getTime();
            return dateB - dateA;
        });

        return posts;
    } catch (error) {
        console.error('Error reading data directory:', error);
        return [];
    }
}

export async function getCreators(dataDir: string): Promise<Creator[]> {
    const creators: Creator[] = [];
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
