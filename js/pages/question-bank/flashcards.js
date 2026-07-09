/**
 * Flashcard feed: loads flashcards (with search + explanation filter) and
 * renders cards.
 */
import { supabase } from '../../lib/supabase.js';
import { renderFlashcardCard } from './flashcard-card.js';
import { updateFeedCount } from './feed-count.js';

export async function loadFlashcards() {
    const feed = document.getElementById('flashcard-feed');
    const loading = document.getElementById('flashcard-feed-loading');
    const empty = document.getElementById('flashcard-feed-empty');
    if (!feed || !loading || !empty) return;
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

    const search = (document.getElementById('search-questions') && document.getElementById('search-questions').value)
        ? document.getElementById('search-questions').value.trim()
        : '';
    const explanationFilterEl = document.getElementById('filter-explanation');
    const explanationFilter = explanationFilterEl ? explanationFilterEl.value.trim() : '';
    let query = supabase.from('flashcards').select('*').order('created_at', { ascending: false });
    if (search) query = query.or('front.ilike.%' + search + '%,back.ilike.%' + search + '%,explanation.ilike.%' + search + '%');

    const { data, error } = await query;
    loading.classList.add('hidden');
    if (error) {
        empty.classList.remove('hidden');
        empty.textContent = 'Failed to load flashcards: ' + (error.message || JSON.stringify(error));
        return;
    }
    let rows = data || [];
    if (explanationFilter === 'non-empty') {
        rows = rows.filter(r => !!((r.explanation || r.explaination || '').trim()));
    } else if (explanationFilter === 'empty') {
        rows = rows.filter(r => !((r.explanation || r.explaination || '').trim()));
    }
    updateFeedCount(rows.length);
    if (!rows.length) {
        empty.classList.remove('hidden');
        return;
    }
    rows.forEach((row, idx) => feed.appendChild(renderFlashcardCard(row, idx + 1)));
}
