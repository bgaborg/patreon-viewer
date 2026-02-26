import moment from 'moment';

export interface ParsedInfo {
    [key: string]: string;
}

export function parseInfoFile(content: string): ParsedInfo {
    const lines = content.split('\n');
    const post: ParsedInfo = {};
    let currentKey: string | null = null;

    for (const line of lines) {
        const match = line.match(/^([A-Za-z][\w\s]*?):\s?(.*)/);
        if (match) {
            currentKey = match[1].trim();
            post[currentKey] = match[2];
        } else if (currentKey && line.startsWith('  ')) {
            post[currentKey] += `\n${line}`;
        }
    }

    return post;
}

interface HandlebarsBlockOptions {
    fn: (context: unknown) => string;
    inverse: (context: unknown) => string;
}

export const handlebarsHelpers = {
    formatDate: (dateString: string | null): string => (dateString ? moment(dateString).format('MMMM DD, YYYY') : ''),
    stripHtml: (html: string | null): string => (html || '').replace(/<[^>]*>/g, ''),
    truncate: (str: string | null, length: number): string => {
        if (!str) return '';
        if (str.length > length) {
            return `${str.substring(0, length)}...`;
        }
        return str;
    },
    postTypeBadge: (type: string | null): string => {
        const types: Record<string, { icon: string; label: string }> = {
            video_embed: { icon: 'fa-video', label: 'Video' },
            video_external_file: { icon: 'fa-video', label: 'Video' },
            audio_embed: { icon: 'fa-music', label: 'Audio' },
            image_file: { icon: 'fa-image', label: 'Image' },
            text_only: { icon: 'fa-align-left', label: 'Text' },
        };
        const safeType = (type || '').replace(/[<>&"']/g, '');
        const t = (type && types[type]) || { icon: 'fa-file', label: safeType };
        return `<i class="fas ${t.icon} me-1"></i>${t.label}`;
    },
    encodeMediaPath: (...segments: unknown[]): string => {
        const parts = (segments as string[]).slice(0, -1);
        return `/media/${parts.map((s) => encodeURIComponent(s)).join('/')}`;
    },
    endsWith: (str: string | null, suffix: string | null): boolean => {
        if (!str || !suffix) return false;
        return str.toString().endsWith(suffix.toString());
    },
    eq: function (this: unknown, a: unknown, b: unknown, options?: HandlebarsBlockOptions): boolean | string {
        if (options?.fn) {
            return a === b ? options.fn(this) : options.inverse(this);
        }
        return a === b;
    },
    isVideo: (filename: string | null): boolean => {
        if (!filename) return false;
        const lower = filename.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv');
    },
};
