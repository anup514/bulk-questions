/**
 * TipTap rich-text editor for the bulk input area, plus a serializer that turns
 * the document back into the tagged plain-text format the parsers expect.
 */
import { Editor } from 'https://cdn.jsdelivr.net/npm/@tiptap/core@2.8.0/+esm';
import StarterKit from 'https://cdn.jsdelivr.net/npm/@tiptap/starter-kit@2.8.0/+esm';
import Placeholder from 'https://cdn.jsdelivr.net/npm/@tiptap/extension-placeholder@2.8.0/+esm';

let editor = null;

export function getEditor() {
    return editor;
}

export function createBulkEditor(element) {
    if (!element) return null;
    editor = new Editor({
        element: element,
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
        },
    });
    // Preserve the historical global for any external integrations.
    window.bulkEditor = editor;
    return editor;
}

/** Serializes the editor content into tagged plain text (lists -> "1. " / "- "). */
export function getBulkEditorText() {
    if (!editor) return '';
    const parts = [];
    function textFromNode(node) {
        let out = '';
        node.descendants((n) => {
            if (n.isText) out += n.text;
            else if (n.type.name === 'hardBreak') out += '\n';
        });
        return out;
    }
    function collectBlocks(node) {
        if (node.type.name === 'paragraph') {
            parts.push(textFromNode(node));
            return;
        }
        if (node.type.name === 'orderedList') {
            let index = 1;
            node.forEach((item) => {
                if (item.type.name === 'listItem') {
                    parts.push(index + '. ' + textFromNode(item).replace(/^\s+|\s+$/g, ''));
                    index += 1;
                }
            });
            return;
        }
        if (node.type.name === 'bulletList') {
            node.forEach((item) => {
                if (item.type.name === 'listItem') {
                    parts.push('- ' + textFromNode(item).replace(/^\s+|\s+$/g, ''));
                }
            });
            return;
        }
        node.forEach(collectBlocks);
    }
    editor.state.doc.forEach(collectBlocks);
    return parts.join('\n');
}
