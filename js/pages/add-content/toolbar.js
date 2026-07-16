/**
 * Editor toolbar actions and wiring.
 *
 * Buttons declare their behaviour via data attributes so the HTML stays free of
 * inline handlers:
 *   - data-tag="[Q]"                         -> insertTag
 *   - data-md-prefix="- "                    -> insertMarkdownLinePrefix
 *   - data-md-before / data-md-after / data-md-placeholder -> insertMarkdown
 *   - data-action="paste-plain"              -> pasteAsPlainText
 */
import { getEditor } from './editor.js';

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function insertTag(tag) {
    const editor = getEditor();
    if (!editor) return;
    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    const atLineStart = $pos.parentOffset === 0;
    const textToInsert = (atLineStart ? '' : '\n') + tag + ' ';
    editor.chain().focus().insertContentAt(from, textToInsert).run();
}

function insertMarkdown(wrapBefore, wrapAfter, placeholder) {
    const editor = getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to, '');
    const text = selected || (placeholder || '');
    const insert = wrapBefore + text + wrapAfter;
    const chain = editor.chain().focus();
    if (to > from) chain.deleteRange({ from, to });
    chain.insertContentAt(from, insert).run();
}

function insertMarkdownLinePrefix(prefix) {
    const editor = getEditor();
    if (!editor) return;
    const { from } = editor.state.selection;
    const $pos = editor.state.doc.resolve(from);
    const lineStart = from - $pos.parentOffset;
    editor.chain().focus().insertContentAt(lineStart, prefix).run();
}

async function pasteAsPlainText() {
    const editor = getEditor();
    if (!editor) return;
    try {
        const plain = navigator.clipboard && await navigator.clipboard.readText();
        if (!plain || !plain.trim()) return;
        const lines = plain.split(/\r?\n/);
        const html = lines.map((line) => '<p>' + escapeHtml(line) + '</p>').join('');
        editor.chain().focus().deleteSelection().insertContent(html).run();
    } catch (e) {
        console.warn('Paste as plain text failed:', e);
    }
}

/** Attaches click handlers to every toolbar button described by data attributes. */
export function wireToolbar(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-tag]').forEach(btn => {
        btn.addEventListener('click', () => insertTag(btn.getAttribute('data-tag')));
    });
    scope.querySelectorAll('[data-md-prefix]').forEach(btn => {
        btn.addEventListener('click', () => insertMarkdownLinePrefix(btn.getAttribute('data-md-prefix')));
    });
    scope.querySelectorAll('[data-md-before]').forEach(btn => {
        btn.addEventListener('click', () => insertMarkdown(
            btn.getAttribute('data-md-before') || '',
            btn.getAttribute('data-md-after') || '',
            btn.getAttribute('data-md-placeholder') || ''
        ));
    });
    scope.querySelectorAll('[data-action="paste-plain"]').forEach(btn => {
        btn.addEventListener('click', pasteAsPlainText);
    });
}
