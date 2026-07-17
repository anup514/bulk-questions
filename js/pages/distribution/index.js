/**
 * Distribution page: interactive pie charts for headings and levels.
 */
import { initTheme } from '../../ui/theme.js';
import { fetchQuestionMeta, aggregate } from './aggregate.js';
import { renderAllCharts } from './charts.js';

let cachedStats = null;

function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
}

function show(el, visible) {
    if (el) el.classList.toggle('hidden', !visible);
}

async function loadDistribution() {
    const loading = document.getElementById('dist-loading');
    const errorEl = document.getElementById('dist-error');
    const empty = document.getElementById('dist-empty');
    const content = document.getElementById('dist-content');

    show(loading, true);
    show(errorEl, false);
    show(empty, false);
    show(content, false);

    const { error, rows } = await fetchQuestionMeta();
    show(loading, false);

    if (error) {
        if (errorEl) {
            errorEl.textContent = error;
            show(errorEl, true);
        }
        return;
    }

    if (!rows.length) {
        show(empty, true);
        return;
    }

    cachedStats = aggregate(rows);
    show(content, true);
    renderAllCharts(cachedStats);
}

ready(() => {
    initTheme();
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (cachedStats) renderAllCharts(cachedStats);
        });
    }
    loadDistribution();
});
