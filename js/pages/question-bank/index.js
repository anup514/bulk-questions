/**
 * Question Bank page entry point.
 *
 * Composition root: wires the view switcher, filters, and feeds together, and
 * initialises the theme toggle and the paste-list fix.
 */
import { viewState } from './state.js';
import { initTheme } from '../../ui/theme.js';
import '../../ui/paste-list-fix.js';
import { initSubjectAndTopicFilters, initDateFilter, initHeadingFilter, wireFiltersAndSearch } from './filters.js';
import { loadQuestions, deleteAllQuestions } from './questions.js';
import { loadFlashcards } from './flashcards.js';

function refreshActiveView() {
    if (viewState.active === 'flashcards') return loadFlashcards();
    return loadQuestions();
}

function setActiveView(next) {
    viewState.active = next === 'flashcards' ? 'flashcards' : 'mcq';
    const mcqBtn = document.getElementById('view-mcq-btn');
    const flashBtn = document.getElementById('view-flashcards-btn');
    const filters = document.getElementById('mcq-filter-bar');
    const pagination = document.getElementById('pagination-rail');
    const levelFilter = document.getElementById('filter-level');
    const subjectFilter = document.getElementById('filter-subject');
    const topicFilter = document.getElementById('filter-topic');
    const headingFilter = document.getElementById('filter-heading');
    const explanationFilter = document.getElementById('filter-explanation');
    const dateFilter = document.getElementById('filter-date');
    const dateRange = document.getElementById('filter-date-range');
    const deleteAllBtn = document.getElementById('delete-all-questions-btn');
    const qFeed = document.getElementById('question-feed');
    const qLoading = document.getElementById('question-feed-loading');
    const qEmpty = document.getElementById('question-feed-empty');
    const fFeed = document.getElementById('flashcard-feed');
    const fLoading = document.getElementById('flashcard-feed-loading');
    const fEmpty = document.getElementById('flashcard-feed-empty');

    const isMcq = viewState.active === 'mcq';
    if (mcqBtn) mcqBtn.classList.toggle('is-active', isMcq);
    if (flashBtn) flashBtn.classList.toggle('is-active', !isMcq);
    if (filters) filters.classList.remove('hidden');
    if (pagination) pagination.classList.toggle('hidden', !isMcq);
    if (levelFilter) levelFilter.classList.toggle('hidden', !isMcq);
    if (subjectFilter) subjectFilter.classList.toggle('hidden', !isMcq);
    if (topicFilter) topicFilter.classList.toggle('hidden', !isMcq);
    if (headingFilter) headingFilter.classList.toggle('hidden', !isMcq);
    if (dateFilter) dateFilter.classList.toggle('hidden', !isMcq);
    if (dateRange) dateRange.classList.toggle('hidden', !isMcq);
    if (deleteAllBtn) deleteAllBtn.classList.toggle('hidden', !isMcq);
    if (explanationFilter) explanationFilter.classList.remove('hidden');
    if (qFeed) qFeed.classList.toggle('hidden', !isMcq);
    if (qLoading) qLoading.classList.toggle('hidden', !isMcq);
    if (qEmpty) qEmpty.classList.toggle('hidden', !isMcq);
    if (fFeed) fFeed.classList.toggle('hidden', isMcq);
    if (fLoading) fLoading.classList.toggle('hidden', isMcq);
    if (fEmpty) fEmpty.classList.toggle('hidden', isMcq);
    refreshActiveView();
}

function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
}

ready(() => {
    initTheme();
    Promise.all([
        initSubjectAndTopicFilters(refreshActiveView),
        initDateFilter(refreshActiveView),
        initHeadingFilter(refreshActiveView)
    ]).finally(() => {
        wireFiltersAndSearch({
            onRefetch: refreshActiveView,
            onDeleteAll: deleteAllQuestions,
            onSetView: setActiveView
        });
        setActiveView('mcq');
    });
});
