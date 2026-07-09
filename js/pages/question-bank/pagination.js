/**
 * Vertical pagination rail for the MCQ feed.
 */
import { PAGE_SIZE, questionBankState } from './state.js';

/**
 * Renders the pagination controls.
 * @param {(page: number) => void} onGoToPage - called with a zero-based page index.
 */
export function renderPagination(onGoToPage) {
    const container = document.getElementById('pagination-container');
    if (!container) return;
    container.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(questionBankState.totalCount / PAGE_SIZE));
    const page = questionBankState.page;

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'pagination__btn';
    prev.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.125rem">expand_less</span>';
    prev.title = 'Previous page';
    prev.disabled = page === 0;
    prev.addEventListener('click', () => onGoToPage(Math.max(0, page - 1)));
    container.appendChild(prev);

    function addPageButton(i) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pagination__btn' + (i === page ? ' is-active' : '');
        btn.textContent = i + 1;
        btn.title = 'Page ' + (i + 1);
        btn.addEventListener('click', () => onGoToPage(i));
        container.appendChild(btn);
    }

    function addEllipsis() {
        const dots = document.createElement('span');
        dots.className = 'pagination__ellipsis';
        dots.textContent = '…';
        container.appendChild(dots);
    }

    if (totalPages <= 11) {
        for (let i = 0; i < totalPages; i++) addPageButton(i);
    } else {
        addPageButton(0);
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages - 2, page + 2);

        if (start > 1) addEllipsis();
        for (let i = start; i <= end; i++) addPageButton(i);
        if (end < totalPages - 2) addEllipsis();

        addPageButton(totalPages - 1);
    }

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'pagination__btn';
    next.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.125rem">expand_more</span>';
    next.title = 'Next page';
    next.disabled = page >= totalPages - 1;
    next.addEventListener('click', () => onGoToPage(Math.min(totalPages - 1, page + 1)));
    container.appendChild(next);

    const jumpWrap = document.createElement('div');
    jumpWrap.className = 'pagination__jump';
    const jumpInput = document.createElement('input');
    jumpInput.type = 'number';
    jumpInput.min = '1';
    jumpInput.max = String(totalPages);
    jumpInput.placeholder = '#';
    jumpInput.setAttribute('aria-label', 'Jump to page');

    const jumpBtn = document.createElement('button');
    jumpBtn.type = 'button';
    jumpBtn.className = 'btn btn-ghost';
    jumpBtn.textContent = 'Go';

    function goToTypedPage() {
        const raw = (jumpInput.value || '').trim();
        const target = parseInt(raw, 10);
        if (!target || target < 1 || target > totalPages) return;
        onGoToPage(target - 1);
    }

    jumpBtn.addEventListener('click', goToTypedPage);
    jumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') goToTypedPage();
    });
    jumpWrap.appendChild(jumpInput);
    jumpWrap.appendChild(jumpBtn);
    container.appendChild(jumpWrap);
}
