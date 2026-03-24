/**
 * Replicates the bulk import flow to capture the first Supabase error.
 * Run with: node test-import-error.js
 */
const SUPABASE_URL = 'https://wqfdhtbqquyuetqwkzjw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZmRodGJxcXV5dWV0cXdremp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNTM3MzgsImV4cCI6MjA4ODcyOTczOH0.GJ6_oiZ6-MlG-O4nkNBihypzaShqkUGdSn5OglKX_4k';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function run() {
  console.log('1. Select max index (questions)...');
  const selectRes = await fetch(
    SUPABASE_URL + '/rest/v1/questions?select=index&order=index.desc&limit=1',
    { method: 'GET', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } }
  );
  const selectText = await selectRes.text();
  if (!selectRes.ok) {
    console.error('FAILED: select max index');
    console.error('Status:', selectRes.status, selectRes.statusText);
    console.error('Body:', selectText);
    return;
  }
  let nextIndex = 0;
  try {
    const arr = JSON.parse(selectText);
    if (arr && arr.length > 0 && arr[0].index != null) nextIndex = arr[0].index + 1;
  } catch (_) {}
  console.log('   nextIndex =', nextIndex);

  console.log('2. Insert one question...');
  const insertQ = await fetch(SUPABASE_URL + '/rest/v1/questions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      stem: 'Test stem for error capture',
      difficulty: 'medium',
      subject: null,
      topics: null,
      index: nextIndex
    })
  });
  const insertQText = await insertQ.text();
  if (!insertQ.ok) {
    console.error('FAILED: questions insert');
    console.error('Status:', insertQ.status, insertQ.statusText);
    console.error('Body:', insertQText);
    return;
  }
  let questionId;
  try {
    const data = JSON.parse(insertQText);
    questionId = Array.isArray(data) ? data[0]?.id : data?.id;
  } catch (_) {}
  if (!questionId) {
    console.error('Question insert ok but no id in response:', insertQText);
    return;
  }
  console.log('   question id =', questionId);

  console.log('3. Insert options...');
  const insertOpts = await fetch(SUPABASE_URL + '/rest/v1/options', {
    method: 'POST',
    headers,
    body: JSON.stringify([
      { question_id: questionId, option_letter: 'A', option_text: 'A', explanation: null, is_correct: true },
      { question_id: questionId, option_letter: 'B', option_text: 'B', explanation: null, is_correct: false }
    ])
  });
  const insertOptsText = await insertOpts.text();
  if (!insertOpts.ok) {
    console.error('FAILED: options insert');
    console.error('Status:', insertOpts.status, insertOpts.statusText);
    console.error('Body:', insertOptsText);
    return;
  }
  console.log('   All steps succeeded.');
}

run().catch(e => {
  console.error('Exception:', e.message || e);
});
