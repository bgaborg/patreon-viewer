// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const posts = document.querySelectorAll('.post-item');

    for (const post of posts) {
        const searchData = post.getAttribute('data-search').toLowerCase();
        if (searchData.includes(searchTerm)) {
            post.style.display = '';
        } else {
            post.style.display = 'none';
        }
    }
});

// Image click navigation
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('post-image-clickable') || e.target.closest('.post-image-clickable')) {
        const clickedElement = e.target.classList.contains('post-image-clickable') ? e.target : e.target.closest('.post-image-clickable');
        const postId = clickedElement.getAttribute('data-post-id');
        if (postId) {
            window.location.href = `/post/${postId}`;
        }
    }
});