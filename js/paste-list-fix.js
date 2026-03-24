/**
 * Paste list fix: when pasting into explanation (and other) textareas, preserve
 * markdown-style formatting. Intercepts paste, reads text/html when present,
 * and converts to plain text with newlines and list markers (1. / -) so that
 * lists and paragraphs are preserved instead of being stripped by the browser.
 */
(function () {
    /**
     * Converts HTML string into markdown-style text so formatting is preserved in textareas.
     * - <ol><li>...</li></ol> -> "1. ...\n2. ...\n"
     * - <ul><li>...</li></ul> -> "- ...\n"
     * - Nested lists indent with two spaces per level (markdown-style).
     * - <p>, <div>, <br> -> newlines; other tags stripped to text.
     * - <b>, <strong> -> **text**; <i>, <em> -> *text*
     */
    function htmlToMarkdown(html) {
        if (!html || typeof html !== 'string') return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        let parsedMarkdown = '';

        /** listDepth: each nested list level adds two spaces before list markers (markdown-style). */
        function walk(node, inList, listIndex, listDepth) {
            inList = inList === undefined ? null : inList;
            listIndex = listIndex === undefined ? 1 : listIndex;
            listDepth = listDepth === undefined || listDepth === null ? 0 : listDepth;

            if (node.nodeType === Node.TEXT_NODE) {
                const content = node.textContent;
                if (content.trim()) {
                    parsedMarkdown += content.replace(/\s+/g, ' ');
                } else if (content.length > 0 && !parsedMarkdown.endsWith(' ') && !parsedMarkdown.endsWith('\n')) {
                    parsedMarkdown += ' ';
                }
                return listIndex;
            }

            if (node.nodeType !== Node.ELEMENT_NODE) return listIndex;
            const tag = node.tagName.toLowerCase();

            if (tag === 'script' || tag === 'style' || tag === 'meta') return listIndex;

            if (tag === 'b' || tag === 'strong') {
                parsedMarkdown += '**';
                for (let i = 0; i < node.childNodes.length; i++) {
                    walk(node.childNodes[i], inList, listIndex, listDepth);
                }
                parsedMarkdown += '**';
                return listIndex;
            }

            if (tag === 'i' || tag === 'em') {
                parsedMarkdown += '*';
                for (let i = 0; i < node.childNodes.length; i++) {
                    walk(node.childNodes[i], inList, listIndex, listDepth);
                }
                parsedMarkdown += '*';
                return listIndex;
            }

            if (tag === 'ol') {
                if (!parsedMarkdown.endsWith('\n')) parsedMarkdown += '\n';
                let childIndex = 1;
                for (let i = 0; i < node.childNodes.length; i++) {
                    childIndex = walk(node.childNodes[i], 'ol', childIndex, listDepth);
                }
                parsedMarkdown += '\n';
                return listIndex;
            }

            if (tag === 'ul') {
                if (!parsedMarkdown.endsWith('\n')) parsedMarkdown += '\n';
                for (let i = 0; i < node.childNodes.length; i++) {
                    walk(node.childNodes[i], 'ul', 1, listDepth);
                }
                parsedMarkdown += '\n';
                return listIndex;
            }

            if (tag === 'li') {
                if (!parsedMarkdown.endsWith('\n')) parsedMarkdown += '\n';
                const indent = '  '.repeat(listDepth);
                if (inList === 'ol') {
                    parsedMarkdown += indent + listIndex + '. ';
                    listIndex++;
                } else {
                    parsedMarkdown += indent + '- ';
                }
                for (let i = 0; i < node.childNodes.length; i++) {
                    const child = node.childNodes[i];
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const ct = child.tagName.toLowerCase();
                        if (ct === 'ul' || ct === 'ol') {
                            walk(child, ct === 'ol' ? 'ol' : 'ul', 1, listDepth + 1);
                    } else {
                        listIndex = walk(child, null, listIndex, listDepth);
                    }
                } else {
                    listIndex = walk(child, null, listIndex, listDepth);
                }
                }
                return listIndex;
            }

            if (tag === 'p' || tag === 'div') {
                if (!parsedMarkdown.endsWith('\n')) parsedMarkdown += '\n';
                for (let i = 0; i < node.childNodes.length; i++) {
                    listIndex = walk(node.childNodes[i], inList, listIndex, listDepth);
                }
                if (!parsedMarkdown.endsWith('\n')) parsedMarkdown += '\n';
                return listIndex;
            }

            if (tag === 'br') {
                parsedMarkdown += '\n';
                return listIndex;
            }

            for (let i = 0; i < node.childNodes.length; i++) {
                listIndex = walk(node.childNodes[i], inList, listIndex, listDepth);
            }
            return listIndex;
        }

        if (doc.body) {
            walk(doc.body, null, 1, 0);
        }

        parsedMarkdown = parsedMarkdown.replace(/\n{3,}/g, '\n\n').trim();
        return parsedMarkdown;
    }

    /**
     * Inserts text at the current cursor position in the textarea, replacing any selection.
     */
    function insertAtCursor(textarea, text) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = before + text + after;
        textarea.value = newValue;
        const newPos = start + text.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.addEventListener('paste', function (e) {
        const target = e.target;
        if (target.tagName !== 'TEXTAREA') return;

        const html = (e.clipboardData && e.clipboardData.getData('text/html')) || '';
        const text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';

        // Only intercept when rich HTML is present so we can preserve structure as markdown-style text
        if (!html || html.trim().length === 0) {
            return;
        }

        e.preventDefault();

        let parsedMarkdown;
        try {
            parsedMarkdown = htmlToMarkdown(html);
        } catch (err) {
            insertAtCursor(target, text);
            return;
        }

        // If HTML conversion produced very little content, fall back to plain text
        const parsedLen = (parsedMarkdown || '').replace(/\s/g, '').length;
        const textLen = (text || '').replace(/\s/g, '').length;
        if (parsedLen < textLen * 0.5) {
            insertAtCursor(target, text);
        } else {
            insertAtCursor(target, parsedMarkdown);
        }
    });
})();
