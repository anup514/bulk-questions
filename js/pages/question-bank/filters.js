/**
 * Filter bar wiring: subject/topic dropdowns (from the static taxonomy),
 * level/date/explanation selects, search box, view segments, and delete-all.
 */
import { supabase } from '../../lib/supabase.js';
import { questionBankState, taxonomy } from './state.js';
import { loadTaxonomy, topicsForSubject } from '../../data/taxonomy.js';

function formatDisplayDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function localDateKey(isoTimestamp) {
    const d = new Date(isoTimestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function dayStart(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function dayEnd(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

/** @returns {{ start: string|null, end: string|null }} */
export function getDateFilterBounds() {
    const fromEl = document.getElementById('filter-date-from');
    const toEl = document.getElementById('filter-date-to');
    const singleEl = document.getElementById('filter-date');
    const from = fromEl && fromEl.value ? fromEl.value.trim() : '';
    const to = toEl && toEl.value ? toEl.value.trim() : '';
    const single = singleEl && singleEl.value ? singleEl.value.trim() : '';

    if (from || to) {
        return {
            start: from ? dayStart(from) : null,
            end: to ? dayEnd(to) : null
        };
    }
    if (single) {
        return { start: dayStart(single), end: dayEnd(single) };
    }
    return { start: null, end: null };
}

export function applyCreatedAtFilter(query, bounds) {
    if (bounds.start) query = query.gte('created_at', bounds.start);
    if (bounds.end) query = query.lte('created_at', bounds.end);
    return query;
}

/**
 * Populates the date filter dropdown with distinct question dates from the DB
 * and wires single-day vs range filter inputs.
 * @param {() => void} onFilterChange
 */
export async function initDateFilter(onFilterChange) {
    const dateSelect = document.getElementById('filter-date');
    const fromEl = document.getElementById('filter-date-from');
    const toEl = document.getElementById('filter-date-to');
    if (!dateSelect) return;

    const refetch = () => {
        questionBankState.page = 0;
        onFilterChange();
    };

    const selected = dateSelect.value;
    dateSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'All dates';
    dateSelect.appendChild(defaultOpt);

    if (supabase) {
        try {
            const { data, error } = await supabase.from('questions').select('created_at');
            if (!error && data) {
                const dates = new Set();
                data.forEach(row => {
                    if (row.created_at) dates.add(localDateKey(row.created_at));
                });
                [...dates].sort().reverse().forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d;
                    opt.textContent = formatDisplayDate(d);
                    dateSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error loading date filter options', e);
        }
    }

    if (selected && [...dateSelect.options].some(o => o.value === selected)) {
        dateSelect.value = selected;
    }

    dateSelect.addEventListener('change', () => {
        if (fromEl) fromEl.value = '';
        if (toEl) toEl.value = '';
        refetch();
    });

    const onRangeChange = () => {
        if (dateSelect.value) dateSelect.value = '';
        refetch();
    };
    if (fromEl) fromEl.addEventListener('change', onRangeChange);
    if (toEl) toEl.addEventListener('change', onRangeChange);
}

/**
 * Populates the heading filter dropdown with distinct headings from the DB.
 * @param {() => void} onFilterChange
 */
export async function initHeadingFilter(onFilterChange) {
    const headingSelect = document.getElementById('filter-heading');
    if (!headingSelect) return;

    const refetch = () => {
        questionBankState.page = 0;
        onFilterChange();
    };

    const selected = headingSelect.value;
    headingSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'All headings';
    headingSelect.appendChild(defaultOpt);

    if (supabase) {
        try {
            const { data, error } = await supabase.from('questions').select('heading');
            if (!error && data) {
                const headings = new Set();
                data.forEach(row => {
                    const h = (row.heading || '').trim();
                    if (h) headings.add(h);
                });
                [...headings].sort((a, b) => a.localeCompare(b)).forEach(h => {
                    const opt = document.createElement('option');
                    opt.value = h;
                    opt.textContent = h;
                    headingSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error('Error loading heading filter options', e);
        }
    }

    if (selected && [...headingSelect.options].some(o => o.value === selected)) {
        headingSelect.value = selected;
    }

    headingSelect.addEventListener('change', refetch);
}

function resetTopicDropdown() {
    const topicSelect = document.getElementById('filter-topic');
    if (!topicSelect) return;
    topicSelect.innerHTML = '';
    const defaultTopic = document.createElement('option');
    defaultTopic.value = '';
    defaultTopic.textContent = 'All topics';
    topicSelect.appendChild(defaultTopic);
    topicSelect.disabled = true;
}

function updateTopicDropdownForSubject() {
    const subjectSelect = document.getElementById('filter-subject');
    const topicSelect = document.getElementById('filter-topic');
    if (!subjectSelect || !topicSelect) return;

    const subjectId = parseInt(subjectSelect.value || '0', 10);
    topicSelect.innerHTML = '';
    const defaultTopic = document.createElement('option');
    defaultTopic.value = '';
    defaultTopic.textContent = 'All topics';
    topicSelect.appendChild(defaultTopic);

    const topics = topicsForSubject(taxonomy.topics, subjectId);
    if (topics.length === 0) {
        topicSelect.disabled = true;
        return;
    }
    topics.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = t.name;
        topicSelect.appendChild(opt);
    });
    topicSelect.disabled = false;
}

/**
 * Loads the taxonomy and populates the subject/topic dropdowns.
 * @param {() => void} onFilterChange - called (after resetting to page 0) when a filter changes.
 */
export async function initSubjectAndTopicFilters(onFilterChange) {
    const subjectSelect = document.getElementById('filter-subject');
    const topicSelect = document.getElementById('filter-topic');
    if (!subjectSelect || !topicSelect) return;

    try {
        const { subjects, topics } = await loadTaxonomy();
        taxonomy.subjects = subjects;
        taxonomy.topics = topics;

        subjectSelect.innerHTML = '';
        const defaultSub = document.createElement('option');
        defaultSub.value = '';
        defaultSub.textContent = 'All subjects';
        subjectSelect.appendChild(defaultSub);
        taxonomy.subjects.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = String(sub.id);
            opt.textContent = sub.name;
            opt.setAttribute('data-name', sub.name);
            subjectSelect.appendChild(opt);
        });

        resetTopicDropdown();

        subjectSelect.addEventListener('change', () => {
            updateTopicDropdownForSubject();
            questionBankState.page = 0;
            onFilterChange();
        });

        topicSelect.addEventListener('change', () => {
            questionBankState.page = 0;
            onFilterChange();
        });
    } catch (e) {
        console.error('Error initializing subject/topic filters', e);
    }
}

/**
 * Wires level/explanation/search filters, delete-all, and view segments.
 * @param {{ onRefetch: () => void, onDeleteAll: () => void, onSetView: (view: string) => void }} handlers
 */
export function wireFiltersAndSearch({ onRefetch, onDeleteAll, onSetView }) {
    const refetch = () => { questionBankState.page = 0; onRefetch(); };
    const elLevel = document.getElementById('filter-level');
    if (elLevel) elLevel.addEventListener('change', refetch);
    const elExplanation = document.getElementById('filter-explanation');
    if (elExplanation) elExplanation.addEventListener('change', refetch);
    const searchEl = document.getElementById('search-questions');
    if (searchEl) searchEl.addEventListener('input', () => { clearTimeout(questionBankState.searchDebounce); questionBankState.searchDebounce = setTimeout(refetch, 300); });
    const deleteAllBtn = document.getElementById('delete-all-questions-btn');
    if (deleteAllBtn) deleteAllBtn.addEventListener('click', onDeleteAll);
    const mcqBtn = document.getElementById('view-mcq-btn');
    if (mcqBtn) mcqBtn.addEventListener('click', () => onSetView('mcq'));
    const flashBtn = document.getElementById('view-flashcards-btn');
    if (flashBtn) flashBtn.addEventListener('click', () => onSetView('flashcards'));
}
