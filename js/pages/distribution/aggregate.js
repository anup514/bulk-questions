/**
 * Fetch question metadata and aggregate counts for the distribution page.
 */
import { supabase } from '../../lib/supabase.js';
import { HEADING_ORDER } from '../../data/headings.js';

const PAGE_SIZE = 1000;
const UNASSIGNED = '(Unassigned)';

/** Exclude questions with index ≤ this value from distribution charts. */
export const EXCLUDE_UNTIL_INDEX = 222;

const LEVEL_ORDER = ['easy', 'medium', 'hard'];
export const LEVEL_LABELS = {
    easy: 'Basic',
    medium: 'Intermediate',
    hard: 'Advanced'
};

/** Load question rows included in the distribution charts. */
export async function fetchQuestionMeta() {
    if (!supabase) {
        return { error: 'Supabase not configured. Add your URL and anon key in js/config.js.', rows: [] };
    }

    const rows = [];
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('questions')
            .select('heading, difficulty')
            .gt('index', EXCLUDE_UNTIL_INDEX)
            .order('index', { ascending: true, nullsFirst: false })
            .range(from, from + PAGE_SIZE - 1);

        if (error) return { error: error.message, rows: [] };

        const batch = data || [];
        rows.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
    }

    return { error: null, rows };
}

/**
 * @param {Array<{heading?: string, difficulty?: string}>} rows
 */
export function aggregate(rows) {
    const byHeading = {};
    const byLevel = { easy: 0, medium: 0, hard: 0 };

    for (const q of rows) {
        const heading = (q.heading || '').trim() || UNASSIGNED;
        byHeading[heading] = (byHeading[heading] || 0) + 1;

        const level = (q.difficulty || '').trim();
        if (LEVEL_ORDER.includes(level)) byLevel[level] += 1;
        else {
            const key = level || UNASSIGNED;
            byLevel[key] = (byLevel[key] || 0) + 1;
        }
    }

    const headingRank = new Map(HEADING_ORDER.map((h, i) => [h, i]));
    const headings = Object.entries(byHeading)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
            const ai = headingRank.has(a.name) ? headingRank.get(a.name) : Infinity;
            const bi = headingRank.has(b.name) ? headingRank.get(b.name) : Infinity;
            if (ai !== bi) return ai - bi;
            return b.count - a.count || a.name.localeCompare(b.name);
        });

    const levels = [
        ...LEVEL_ORDER.map((key) => ({ key, label: LEVEL_LABELS[key], count: byLevel[key] || 0 })),
        ...Object.entries(byLevel)
            .filter(([key]) => !LEVEL_ORDER.includes(key))
            .map(([key, count]) => ({ key, label: key, count }))
            .sort((a, b) => b.count - a.count)
    ];

    return {
        total: rows.length,
        headingCount: headings.filter((h) => h.name !== UNASSIGNED).length,
        headings,
        levels
    };
}
