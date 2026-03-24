/**
 * Supabase client for ExamPrep.
 * Requires config.js to be loaded first (SUPABASE_URL, SUPABASE_ANON_KEY).
 */
(function () {
    const url = typeof window !== 'undefined' && window.SUPABASE_URL;
    const key = typeof window !== 'undefined' && window.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.warn('Supabase: SUPABASE_URL or SUPABASE_ANON_KEY missing. Load js/config.js with valid values.');
        window.supabase = null;
        return;
    }
    window.supabase = window.supabase.createClient(url, key);
})();
