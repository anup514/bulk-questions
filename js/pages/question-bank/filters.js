/**
 * Filter bar wiring: subject/topic dropdowns (from the static taxonomy),
 * level/explanation selects, search box, view segments, and delete-all.
 */
import { supabase } from '../../lib/supabase.js';
import { questionBankState, taxonomy } from './state.js';
import { loadTaxonomy, topicsForSubject } from '../../data/taxonomy.js';
import { HEADING_ORDER } from '../../data/headings.js';

/**
 * Populates the heading filter dropdown in canonical chapter order.
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

    HEADING_ORDER.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        headingSelect.appendChild(opt);
    });

    if (selected && [...headingSelect.options].some(o => o.value === selected)) {
        headingSelect.value = selected;
    }

    headingSelect.addEventListener('change', refetch);
}

/**
 * Populates the exam filter from distinct exam values in the DB.
 * @param {() => void} onFilterChange
 */
export async function initExamFilter(onFilterChange) {
    const examSelect = document.getElementById('filter-exam');
    if (!examSelect) return;

    const refetch = () => {
        questionBankState.page = 0;
        onFilterChange();
    };

    const selected = examSelect.value;
    examSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'All exams';
    examSelect.appendChild(defaultOpt);

    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('questions')
                .select('exam')
                .not('exam', 'is', null);
            if (error) throw error;
            const exams = [...new Set((data || []).map(r => (r.exam || '').trim()).filter(Boolean))]
                .sort((a, b) => a.localeCompare(b));
            exams.forEach(exam => {
                const opt = document.createElement('option');
                opt.value = exam;
                opt.textContent = exam;
                examSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Error initializing exam filter', e);
        }
    }

    if (selected && [...examSelect.options].some(o => o.value === selected)) {
        examSelect.value = selected;
    }

    examSelect.addEventListener('change', refetch);
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
