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
   The app uses native ES modules, so it must be served over HTTP — opening the
   files directly via `file://` will not work.

6. **(Optional)** Verify inserts with:
   ```bash
   node test-import-error.js
   ```
   Update the URL and anon key at the top of that file first.

## Project structure

The front-end is organised as ES modules (no build step required):

```
js/
  config.js              # Supabase credentials (gitignored; copy from config.example.js)
  lib/supabase.js        # Shared Supabase client
  render/                # Markdown + LaTeX rendering (shared)
  parsers/bulk.js        # Tagged bulk-import text parsers (shared)
  data/taxonomy.js       # Loads subjects/topics from assets/*.json
  ui/                    # theme toggle, paste-list fix
  pages/
    question-bank/       # index.html: state, filters, pagination, cards, feeds
    add-content/         # add-question.html: editor, toolbar, import pipeline
```

Each HTML page loads a single module entry point
(`js/pages/<page>/index.js`), which composes the feature modules.

## Notes

- `js/config.js` is gitignored; do not commit it.
- Free-tier projects pause after inactivity; open the dashboard periodically or upgrade to avoid deletion.
- There is no auth layer — anyone with the anon key can read/write data. Keep the key out of public repos and use RLS only for a personal/single-user setup.
