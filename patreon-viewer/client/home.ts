const PAGE_SIZE_OPTIONS = [24, 60, 90];
const PAGE_SIZE_KEY = 'postsPerPage';

function loadPageSize(): number {
    const saved = localStorage.getItem(PAGE_SIZE_KEY);
    const num = Number(saved);
    return PAGE_SIZE_OPTIONS.includes(num) ? num : PAGE_SIZE_OPTIONS[0];
}

let postsPerPage = loadPageSize();

const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const postsContainer = document.getElementById('postsContainer') as HTMLElement;
const postCountDisplay = document.getElementById('postCountDisplay') as HTMLElement;
const paginationContainer = document.getElementById('paginationContainer') as HTMLElement;
const pageSizeSelect = document.getElementById('pageSizeSelect') as HTMLSelectElement;

const allPosts = Array.from(postsContainer.querySelectorAll<HTMLElement>('.post-item'));
let currentPage = 1;

pageSizeSelect.value = String(postsPerPage);
pageSizeSelect.addEventListener('change', () => {
    postsPerPage = Number(pageSizeSelect.value);
    localStorage.setItem(PAGE_SIZE_KEY, String(postsPerPage));
    currentPage = 1;
    applyFiltersAndPaginate();
});

function getFilteredPosts(): HTMLElement[] {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) return allPosts;
    return allPosts.filter((post) => {
        const searchData = (post.getAttribute('data-search') || '').toLowerCase();
        return searchData.includes(searchTerm);
    });
}

function applyFiltersAndPaginate(): void {
    const filtered = getFilteredPosts();
    const totalPages = Math.max(1, Math.ceil(filtered.length / postsPerPage));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * postsPerPage;
    const end = start + postsPerPage;
    const visible = new Set(filtered.slice(start, end));

    for (const post of allPosts) {
        post.style.display = visible.has(post) ? '' : 'none';
    }

    if (filtered.length === 0) {
        postCountDisplay.textContent = 'No matching posts';
    } else {
        const showEnd = Math.min(end, filtered.length);
        postCountDisplay.innerHTML = `Showing <strong>${start + 1}\u2013${showEnd}</strong> of <strong>${filtered.length}</strong> posts`;
    }

    renderPagination(totalPages, filtered.length);
}

function renderPagination(totalPages: number, totalItems: number): void {
    if (totalItems <= postsPerPage) {
        paginationContainer.innerHTML = '';
        return;
    }

    const pages = getPageNumbers(currentPage, totalPages);

    let html = '<nav aria-label="Post navigation"><ul class="pagination justify-content-center mb-0">';

    html += `<li class="page-item${currentPage === 1 ? ' disabled' : ''}">`;
    html += `<a class="page-link" href="#" data-page="${currentPage - 1}" aria-label="Previous">&laquo;</a></li>`;

    for (const page of pages) {
        if (page === '...') {
            html += '<li class="page-item disabled"><span class="page-link">&hellip;</span></li>';
        } else {
            const num = page as number;
            html += `<li class="page-item${num === currentPage ? ' active' : ''}">`;
            html += `<a class="page-link" href="#" data-page="${num}">${num}</a></li>`;
        }
    }

    html += `<li class="page-item${currentPage === totalPages ? ' disabled' : ''}">`;
    html += `<a class="page-link" href="#" data-page="${currentPage + 1}" aria-label="Next">&raquo;</a></li>`;

    html += '</ul></nav>';
    paginationContainer.innerHTML = html;
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [1];

    if (current > 3) pages.push('...');

    const rangeStart = Math.max(2, current - 1);
    const rangeEnd = Math.min(total - 1, current + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) {
        pages.push(i);
    }

    if (current < total - 2) pages.push('...');

    pages.push(total);
    return pages;
}

searchInput.addEventListener('input', () => {
    currentPage = 1;
    applyFiltersAndPaginate();
});

paginationContainer.addEventListener('click', (e) => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-page]');
    if (!target) return;
    const page = Number(target.dataset.page);
    if (Number.isNaN(page) || page < 1) return;
    currentPage = page;
    applyFiltersAndPaginate();
    postsContainer.scrollIntoView({ behavior: 'smooth' });
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

applyFiltersAndPaginate();
