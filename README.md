# bulk-questions

MCQ and flashcard bulk import / management UI backed by Supabase.

## Supabase setup (from scratch)

1. **Create a project** at [supabase.com/dashboard](https://supabase.com/dashboard) → New project.

2. **Run the schema** in **SQL Editor** → New query. Paste the contents of [`sql/setup.sql`](sql/setup.sql) and click **Run**. This creates `questions`, `options`, and `flashcards` with row-level security policies for the anon key.

3. **Copy API credentials** from **Settings → API**:
   - Project URL
   - `anon` `public` key

4. **Configure the app**:
   ```bash
   cp js/config.example.js js/config.js
   ```
   Edit `js/config.js` and paste your new URL and anon key.

5. **Serve locally** (any static server works), then open `index.html` or `add-question.html`:
   ```bash
   python3 -m http.server 8080
   ```

6. **(Optional)** Verify inserts with:
   ```bash
   node test-import-error.js
   ```
   Update the URL and anon key at the top of that file first.

## Notes

- `js/config.js` is gitignored; do not commit it.
- Free-tier projects pause after inactivity; open the dashboard periodically or upgrade to avoid deletion.
- There is no auth layer — anyone with the anon key can read/write data. Keep the key out of public repos and use RLS only for a personal/single-user setup.
