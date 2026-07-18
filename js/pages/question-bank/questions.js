/**
 * MCQ feed: loads a page of questions (with filters) and their options, renders
 * cards + pagination, and supports bulk delete-all.
 */
import { supabase } from '../../lib/supabase.js';
import { HIDDEN_UNTIL_INDEX, PAGE_SIZE, questionBankState } from './state.js';
import { renderQuestionCard } from './question-card.js';
import { renderPagination } from './pagination.js';
import { updateFeedCount } from './feed-count.js';

/** Fetch size when loading all matching questions for explanation filtering. */
const FETCH_PAGE_SIZE = 1000;
/**
 * Max IDs per `.in()` call. Large UUID lists blow past PostgREST URL limits
 * and return 400 Bad Request.
 */
const IN_FILTER_CHUNK = 100;

function goToPage(page) {
    questionBankState.page = page;
    loadQuestions();
}

function refreshPagination() {
    renderPagination(goToPage);
}

/** Load options for many question IDs in URL-safe chunks. */
async function fetchOptionsByQuestionIds(questionIds) {
    const options = [];
    for (let i = 0; i < questionIds.length; i += IN_FILTER_CHUNK) {
        const chunk = questionIds.slice(i, i + IN_FILTER_CHUNK);
        const { data, error } = await supabase
            .from('options')
            .select('question_id, explanation')
            .in('question_id', chunk);
        if (error) return { data: null, error };
        options.push(...(data || []));
    }
    return { data: options, error: null };
}

export async function loadQuestions() {
    const feed = document.getElementById('question-feed');
    const loading = document.getElementById('question-feed-loading');
    const empty = document.getElementById('question-feed-empty');
    feed.innerHTML = '';
    loading.classList.remove('hidden');
    empty.classList.add('hidden');

    if (!supabase) {
        loading.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.textContent = 'Supabase not configured. Add your URL and anon key in js/config.js';
        updateFeedCount(0);
        return;
    }

    const level = document.getElementById('filter-level').value.trim();
    let subject = '';
    const subjectEl = document.getElementById('filter-subject');
    if (subjectEl) {
        const selected = subjectEl.options[subjectEl.selectedIndex];
        subject = selected ? (selected.getAttribute('data-name') || '').trim() : '';
    }
    const topic = document.getElementById('filter-topic').value.trim();
    const heading = (document.getElementById('filter-heading') && document.getElementById('filter-heading').value) ? document.getElementById('filter-heading').value.trim() : '';
    const explanationFilter = document.getElementById('filter-explanation').value.trim();
    const search = (document.getElementById('search-questions') && document.getElementById('search-questions').value) ? document.getElementById('search-questions').value.trim() : '';
    const from = questionBankState.page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let questions = [];
    let qErr = null;
    let count = 0;
    const applyQuestionBaseFilters = (query) => {
        if (HIDDEN_UNTIL_INDEX > 0) query = query.gt('index', HIDDEN_UNTIL_INDEX);
        if (level) query = query.eq('difficulty', level);
        if (subject) query = query.eq('subject', subject);
        if (topic) query = query.contains('topics', [topic]);
        if (heading) query = query.eq('heading', heading);
        if (search) query = query.ilike('stem', '%' + search + '%');
        return query;
    };

    if (!explanationFilter) {
        let query = supabase.from('questions').select('*', { count: 'exact' }).order('index', { ascending: true, nullsFirst: false });
        query = applyQuestionBaseFilters(query);
        const result = await query.range(from, to);
        questions = result.data || [];
        qErr = result.error || null;
        count = result.count || 0;
    } else {
        // Explanation-filter mode uses option-level explanation presence per question.
        const allQuestions = [];
        let fetchFrom = 0;
        while (true) {
            let pageQuery = supabase
                .from('questions')
                .select('id, index, stem, difficulty, subject, topics, heading')
                .order('index', { ascending: true, nullsFirst: false })
                .range(fetchFrom, fetchFrom + FETCH_PAGE_SIZE - 1);
            pageQuery = applyQuestionBaseFilters(pageQuery);
            const { data: pageRows, error: pageErr } = await pageQuery;
            if (pageErr) {
                qErr = pageErr;
                break;
            }
            const batch = pageRows || [];
            allQuestions.push(...batch);
            if (batch.length < FETCH_PAGE_SIZE) break;
            fetchFrom += FETCH_PAGE_SIZE;
        }

        if (!qErr) {
            if (allQuestions.length === 0) {
                questions = [];
                count = 0;
            } else {
                const allIds = allQuestions.map(q => q.id);
                const { data: optionsForAll, error: optionsFilterErr } = await fetchOptionsByQuestionIds(allIds);
                if (optionsFilterErr) {
                    qErr = optionsFilterErr;
                } else {
                    const hasNonEmptyExplanation = {};
                    (optionsForAll || []).forEach(opt => {
                        const exp = (opt.explanation || '').trim();
                        if (exp) hasNonEmptyExplanation[opt.question_id] = true;
                    });
                    const filteredQuestions = allQuestions.filter(q => {
                        const hasAny = hasNonEmptyExplanation[q.id] === true;
                        return explanationFilter === 'non-empty' ? hasAny : !hasAny;
                    });
                    count = filteredQuestions.length;
                    const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
                    if (questionBankState.page > totalPages - 1) questionBankState.page = totalPages - 1;
                    const start = questionBankState.page * PAGE_SIZE;
                    questions = filteredQuestions.slice(start, start + PAGE_SIZE);
                }
            }
        }
    }

    loading.classList.add('hidden');
    if (qErr) {
        empty.classList.remove('hidden');
        empty.textContent = 'Error loading questions: ' + (qErr.message || 'Unknown error');
        return;
    }
    questionBankState.totalCount = count || 0;
    updateFeedCount(questionBankState.totalCount);
    if (!questions || questions.length === 0) {
        empty.classList.remove('hidden');
        refreshPagination();
        return;
    }

    const ids = questions.map(q => q.id);
    const { data: options, error: oErr } = await supabase.from('options').select('*').in('question_id', ids).order('option_letter');
    if (oErr) {
        empty.classList.remove('hidden');
        empty.textContent = 'Error loading options: ' + (oErr.message || 'Unknown error');
        return;
    }
    const optionsByQuestion = {};
    (options || []).forEach(opt => {
        if (!optionsByQuestion[opt.question_id]) optionsByQuestion[opt.question_id] = [];
        optionsByQuestion[opt.question_id].push(opt);
    });

    const onDeleted = () => {
        questionBankState.totalCount--;
        updateFeedCount(questionBankState.totalCount);
        refreshPagination();
    };
    questions.forEach(q => {
        const card = renderQuestionCard(q, optionsByQuestion[q.id] || [], { onDeleted });
        feed.appendChild(card);
    });
    refreshPagination();
}

export async function deleteAllQuestions() {
    if (!supabase) {
        alert('Supabase not configured.');
        return;
    }
    if (!confirm('Permanently delete ALL questions and their options from the database? This cannot be undone.')) return;
    const btn = document.getElementById('delete-all-questions-btn');
    if (btn) btn.disabled = true;
    const BATCH = 200;
    let totalDeleted = 0;
    try {
        for (;;) {
            const { data: batch } = await supabase.from('questions').select('id').limit(BATCH);
            if (!batch || batch.length === 0) break;
            const ids = batch.map(r => r.id);
            const { error: optErr } = await supabase.from('options').delete().in('question_id', ids);
            if (optErr) throw new Error('Options: ' + optErr.message);
            const { error: qErr } = await supabase.from('questions').delete().in('id', ids);
            if (qErr) throw new Error('Questions: ' + qErr.message);
            totalDeleted += ids.length;
        }
        questionBankState.totalCount = 0;
        questionBankState.page = 0;
        updateFeedCount(0);
        loadQuestions();
        alert('All ' + totalDeleted + ' question(s) have been deleted.');
    } catch (e) {
        alert('Failed to delete all: ' + (e.message || e));
    } finally {
        if (btn) btn.disabled = false;
    }
}
