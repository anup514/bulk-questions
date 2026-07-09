/**
 * Updates the toolbar feed-count label for the active view.
 */
import { viewState } from './state.js';

/**
 * @param {number} count
 */
export function updateFeedCount(count) {
    const el = document.getElementById('feed-count');
    if (!el) return;
    const n = Math.max(0, count || 0);
    const kind = viewState.active === 'flashcards' ? 'flashcard' : 'question';
    const label = n === 1 ? kind : kind + 's';
    el.textContent = n.toLocaleString() + ' ' + label;
}
