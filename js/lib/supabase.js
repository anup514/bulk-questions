/**
 * Supabase client.
 *
 * Reads credentials from the globals set by `js/config.js`
 * (window.SUPABASE_URL / window.SUPABASE_ANON_KEY) and uses the Supabase UMD
 * bundle that must be loaded via a classic <script> before any module runs.
 *
 * Exports a single shared client instance (or null when unconfigured).
 */
function createClient() {
    const url = typeof window !== 'undefined' && window.SUPABASE_URL;
    const key = typeof window !== 'undefined' && window.SUPABASE_ANON_KEY;
    if (!url || !key) {
        console.warn('Supabase: SUPABASE_URL or SUPABASE_ANON_KEY missing. Load js/config.js with valid values.');
        return null;
    }
    const lib = typeof window !== 'undefined' ? window.supabase : null;
    if (!lib || typeof lib.createClient !== 'function') {
        console.warn('Supabase: UMD library not loaded. Include the @supabase/supabase-js script before the app modules.');
        return null;
    }
    return lib.createClient(url, key);
}

export const supabase = createClient();

// Preserve the historical global so any remaining inline references keep working.
if (typeof window !== 'undefined') {
    window.supabase = supabase;
}
