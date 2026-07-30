/**
 * TipTap rich-text editor for the bulk input area, plus a serializer that turns
 * the document back into the tagged plain-text format the parsers expect.
 */
import { Editor } from 'https://cdn.jsdelivr.net/npm/@tiptap/core@2.8.0/+esm';
import StarterKit from 'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.8.0/+esm';
import Placeholder from 'https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@2.8.0/+esm';
import { htmlToMarkdown } from '../../ui/paste-list-fix.js';

let editor = null;

/** HTML-escapes a string so markdown/tag characters render literally. */
function escapeHtmlText(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Wraps each line of text in a <p>, escaped so markers stay literal. Leading
 * indentation is emitted as &nbsp; because HTML collapses leading whitespace,
 * which would otherwise flatten nested lists.
 */
function textToParagraphHtml(text) {
    return text
        .split(/\r?\n/)
        .map((line) => {
            if (!line) return '<p></p>';
            const leading = (line.match(/^[ \t]*/) || [''])[0];
            const indent = leading.replace(/\t/g, '  ').replace(/ /g, '&nbsp;');
            return '<p>' + indent + escapeHtmlText(line.slice(leading.length)) + '</p>';
        })
        .join('');
}

/**
 * Rewrites rich clipboard HTML into literal-markdown paragraphs before the
 * editor parses it, so pasting shows `**bold**`, `*italic*`, and `- lists`
 * verbatim (like the plain textareas in index.html) instead of rendering them.
 */
function transformPastedHtml(html) {
    try {
        const md = htmlToMarkdown(html);
        if (!md) return html;
        return textToParagraphHtml(md);
    } catch (e) {
        return html;
    }
}

export function getEditor() {
    return editor;
}

export function createBulkEditor(element) {
    if (!element) return null;
    editor = new Editor({
        element: element,
        // Keep the editor plain-textarea-like: markdown markers (**bold**, - list)
        // are shown literally instead of being auto-converted to rich nodes.
        enableInputRules: false,
        enablePasteRules: false,
        extensions: [
            StarterKit.configure({ codeBlock: false }),
            Placeholder.configure({
                placeholder: '',
                emptyEditorClass: 'is-empty-before',
                emptyNodeClass: 'empty-node',
                showOnlyCurrent: false,
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'tiptap',
            },
            transformPastedHTML: transformPastedHtml,
        },
    });
    // Preserve the historical global for any external integrations.
    window.bulkEditor = editor;
    return editor;
}

/**
 * Serializes the editor content into tagged plain/markdown text.
 *
 * Inline bold/italic marks become `**...**` / `*...*`, and nested lists are
 * indented two spaces per depth so the markdown renderer can reconstruct them.
 * Single-level lists and plain paragraphs serialize exactly as before.
 */
export function getBulkEditorText() {
    if (!editor) return '';
    const parts = [];

    function inlineText(node) {
        let out = '';
        node.forEach((child) => {
            if (child.isText) {
                let t = (child.text || '').replace(/\u00a0/g, ' ');
                const marks = child.marks || [];
                if (marks.some((m) => m.type.name === 'italic')) t = '*' + t + '*';
                if (marks.some((m) => m.type.name === 'bold')) t = '**' + t + '**';
                out += t;
            } else if (child.type.name === 'hardBreak') {
                out += '\n';
            } else {
                out += inlineText(child);
            }
        });
        return out;
    }

    function serializeList(listNode, depth) {
        const ordered = listNode.type.name === 'orderedList';
        const indent = '  '.repeat(depth);
        const lines = [];
        let counter = 1;
        listNode.forEach((item) => {
            if (item.type.name !== 'listItem') return;
            const marker = ordered ? counter + '. ' : '- ';
            counter += 1;
            let itemLine = null;
            const trailing = [];
            item.forEach((child) => {
                if (child.type.name === 'bulletList' || child.type.name === 'orderedList') {
                    trailing.push(serializeList(child, depth + 1));
                } else if (child.type.name === 'paragraph') {
                    const t = inlineText(child).trim();
                    if (itemLine === null) itemLine = t;
                    else trailing.push(indent + '  ' + t);
                } else {
                    const t = inlineText(child).trim();
                    if (itemLine === null) itemLine = t;
                    else if (t) trailing.push(indent + '  ' + t);
                }
            });
            lines.push(indent + marker + (itemLine || ''));
            for (const t of trailing) lines.push(t);
        });
        return lines.join('\n');
    }

    function collectBlocks(node) {
        if (node.type.name === 'paragraph') {
            parts.push(inlineText(node));
            return;
        }
        if (node.type.name === 'orderedList' || node.type.name === 'bulletList') {
            parts.push(serializeList(node, 0));
            return;
        }
        node.forEach(collectBlocks);
    }
    editor.state.doc.forEach(collectBlocks);
    return parts.join('\n');
}
