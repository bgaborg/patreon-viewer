const searchInput = document.getElementById('searchInput') as HTMLInputElement;
searchInput.addEventListener('input', (e) => {
    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
    const posts = document.querySelectorAll<HTMLElement>('.post-item');

    for (const post of posts) {
        const searchData = (post.getAttribute('data-search') || '').toLowerCase();
        post.style.display = searchData.includes(searchTerm) ? '' : 'none';
    }
});

document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const clickedElement = target.classList.contains('post-image-clickable')
        ? target
        : target.closest<HTMLElement>('.post-image-clickable');
    if (!clickedElement) return;
    const postId = clickedElement.getAttribute('data-post-id');
    if (postId) {
        window.location.href = `/post/${postId}`;
    }
});
