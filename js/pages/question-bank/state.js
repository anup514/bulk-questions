/**
 * Shared state and constants for the Question Bank page.
 */

export const PAGE_SIZE = 10;

export const DIFFICULTY_LABELS = { easy: 'Basic', medium: 'Intermediate', hard: 'Advanced' };
export const DIFFICULTY_CLASSES = {
    easy: 'badge-easy',
    medium: 'badge-medium',
    hard: 'badge-hard'
};

export const questionBankState = { page: 0, totalCount: 0, searchDebounce: null };

export const viewState = { active: 'mcq' };

export const taxonomy = { subjects: [], topics: [] };
