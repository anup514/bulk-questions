/**
 * Bulk import pipeline: parse the editor content into MCQs + flashcards and
 * insert them into Supabase, reporting progress/errors to the UI.
 */
import { supabase } from '../../lib/supabase.js';
import { parseBulkRawText, parseFlashcardRawText } from '../../parsers/bulk.js';
import { getBulkEditorText, getEditor } from './editor.js';
import { escapeHtml } from './toolbar.js';

export function showBulkImportMessage(msg, isError) {
    const el = document.getElementById('bulk-import-message');
    if (!el) return;
    el.textContent = msg;
    el.className = (isError ? 'is-error' : 'is-success');
    el.classList.remove('hidden');
}

export async function saveBulkQuestions() {
    const raw = getBulkEditorText();
    const questions = parseBulkRawText(raw);
    const flashcards = parseFlashcardRawText(raw);
    if (!questions.length && !flashcards.length) {
        showBulkImportMessage('No valid content found. Use MCQ tags ([Q]…) and/or flashcard tags ([F]…[B]…).', true);
        return;
    }
    if (!supabase) { showBulkImportMessage('Supabase not configured. Add js/config.js.', true); return; }
    const btn = document.getElementById('bulk-import-btn');
    if (btn) btn.disabled = true;
    let okMcq = 0, failMcq = 0;
    let okFlash = 0, failFlash = 0;
    const failures = [];
    try {
        showBulkImportMessage('Importing ' + questions.length + ' MCQ(s) and ' + flashcards.length + ' flashcard(s)...', false);

        let nextIndexBase = 1;
        const { data: maxRow, error: maxErr } = await supabase
            .from('questions')
            .select('index')
            .order('index', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!maxErr && maxRow && maxRow.index != null) {
            nextIndexBase = maxRow.index + 1;
        } else if (maxErr) {
            failures.push({ step: 'read-max-index', message: maxErr.message || String(maxErr) });
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const qIndex = nextIndexBase + i;
            const { data: row, error: qErr } = await supabase.from('questions').insert({
                stem: q.stem,
                difficulty: q.difficulty,
                subject: q.subject,
                topics: q.topics && q.topics.length ? q.topics : null,
                heading: q.heading || null,
                index: qIndex
            }).select('id').single();

            if (qErr) {
                failMcq++;
                failures.push({ step: 'insert-question', question: (q.stem || '').slice(0, 120), message: qErr.message || JSON.stringify(qErr) });
                continue;
            }

            const opts = q.options.map((o, idx) => ({
                question_id: row.id,
                option_letter: o.letter,
                option_text: o.text || '(No text)',
                explanation: o.explanation || null,
                is_correct: idx === q.correctIndex
            }));
            const { error: oErr } = await supabase.from('options').insert(opts);
            if (oErr) {
                failMcq++;
                failures.push({ step: 'insert-options', question: (q.stem || '').slice(0, 120), message: oErr.message || JSON.stringify(oErr) });
            } else {
                okMcq++;
            }
        }

        for (let i = 0; i < flashcards.length; i++) {
            const fc = flashcards[i];
            const { error: fErr } = await supabase.from('flashcards').insert({
                front: fc.front,
                back: fc.back,
                explanation: fc.explanation
            });
            if (fErr) {
                failFlash++;
                failures.push({ step: 'insert-flashcard', flashcard: (fc.front || '').slice(0, 120), message: fErr.message || JSON.stringify(fErr) });
            } else {
                okFlash++;
            }
        }
    } catch (e) {
        failures.push({ step: 'exception', message: (e && (e.message || String(e))) || 'Unknown error' });
    } finally {
        if (btn) btn.disabled = false;
    }

    if (failures.length) {
        const first = failures[0];
        const detail = (first.step ? first.step + ': ' : '') + (first.message || 'Unknown error');
        const totalOk = okMcq + okFlash;
        const totalFail = failMcq + failFlash;
        showBulkImportMessage(totalOk + ' imported, ' + totalFail + ' failed. ' + detail, totalFail > 0);
    } else {
        showBulkImportMessage('Imported — MCQs: ' + okMcq + ', Flashcards: ' + okFlash + '.', false);
    }

    const editor = getEditor();
    if ((okMcq + okFlash) > 0 && editor) {
        editor.commands.setContent('');
    }
}

export async function loadBulkImportFile() {
    const editor = getEditor();
    if (!editor) return;
    try {
        const res = await fetch('question-bank-import.txt');
        if (!res.ok) throw new Error('File not found');
        const text = await res.text();
        const lines = text.split(/\r?\n/);
        const html = lines.map((line) => '<p>' + escapeHtml(line) + '</p>').join('');
        editor.commands.setContent(html);
        showBulkImportMessage('Loaded question-bank-import.txt', false);
    } catch (e) {
        showBulkImportMessage('Could not load file: ' + (e.message || 'Unknown error'), true);
    }
}
