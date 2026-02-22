const moment = require('moment');

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
            post[currentKey] += `\n${line}`;
        }
    }

    return post;
}

const handlebarsHelpers = {
    formatDate: (dateString) => (dateString ? moment(dateString).format('MMMM DD, YYYY') : ''),
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
        return `/media/${parts.map((s) => encodeURIComponent(s)).join('/')}`;
    },
    endsWith: (str, suffix) => {
        if (!str || !suffix) return false;
        return str.toString().endsWith(suffix.toString());
    },
    eq: function (a, b, options) {
        if (options?.fn) {
            return a === b ? options.fn(this) : options.inverse(this);
        }
        return a === b;
    },
    isVideo: (filename) => {
        if (!filename) return false;
        const lower = filename.toLowerCase();
        return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mkv');
    },
};

module.exports = { parseInfoFile, handlebarsHelpers };
