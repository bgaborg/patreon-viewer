declare const bootstrap: {
    Modal: new (el: HTMLElement) => { show: () => void };
};

function mediaPath(creatorDir: string, postDir: string, type: string, filename: string): string {
    return `/media/${encodeURIComponent(creatorDir)}/${encodeURIComponent(postDir)}/${type}/${encodeURIComponent(filename)}`;
}

const imageModalEl = document.getElementById('imageModal') as HTMLElement;
const imageModal = new bootstrap.Modal(imageModalEl);

document.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.js-show-image');
    if (!el) return;
    const img = document.getElementById('modalImage') as HTMLImageElement;
    const creator = el.dataset.creator ?? '';
    const post = el.dataset.post ?? '';
    const file = el.dataset.file ?? '';
    img.src = mediaPath(creator, post, 'images', file);
    img.alt = file;
    imageModal.show();
});
