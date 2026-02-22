function mediaPath(creatorDir, postDir, type, filename) {
    return `/media/${encodeURIComponent(creatorDir)}/${encodeURIComponent(postDir)}/${type}/${encodeURIComponent(filename)}`;
}

const videoModal = new bootstrap.Modal(document.getElementById('videoModal'));
const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));

// Video play buttons via data attributes
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-play-video');
    if (!btn) return;
    const video = document.getElementById('videoPlayer');
    video.src = mediaPath(btn.dataset.creator, btn.dataset.post, 'embed', btn.dataset.file);
    videoModal.show();
});

// Image click via data attributes
document.addEventListener('click', (e) => {
    const el = e.target.closest('.js-show-image');
    if (!el) return;
    const img = document.getElementById('modalImage');
    img.src = mediaPath(el.dataset.creator, el.dataset.post, 'images', el.dataset.file);
    img.alt = el.dataset.file;
    imageModal.show();
});

// Clean up video when modal is closed
document.getElementById('videoModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('videoPlayer').src = '';
});
