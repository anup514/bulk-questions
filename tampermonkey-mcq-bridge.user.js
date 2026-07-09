// ==UserScript==
// @name         Selection-Based MCQ Bridge
// @namespace    http://tampermonkey.net/
// @version      9.4
// @description  Syncs MCQ and flashcard payloads with HTML↔Markdown conversion and TipTap-safe paste
// @author       Gemini
// @match        *://localhost/*
// @match        *://127.0.0.1/*
// @match        *://*.spacedrevision.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    const DATA_KEY = "spacedRevisionTransfer";

    // --- Convert rendered HTML (source site) back to markdown so we can re-render on target ---
    function inlineHtmlToMarkdown(el) {
        if (!el) return '';
        if (el.nodeType === Node.TEXT_NODE) {
            return (el.textContent || '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');
        }
        if (el.nodeType !== Node.ELEMENT_NODE) return '';

        if (el.classList && (el.classList.contains('math-inline') || el.classList.contains('math-display'))) {
            let latex = el.getAttribute('data-latex') || el.textContent || '';
            latex = latex.trim();
            // If already wrapped in $...$ or $$...$$, strip the outer pair so we don't double-wrap.
            const dollarWrapMatch = latex.match(/^(\${1,2})([\s\S]*?)\1$/);
            if (dollarWrapMatch) {
                latex = dollarWrapMatch[2];
            }

            if (el.classList.contains('math-display')) {
                return `$$${latex}$$`;
            }
            return `$${latex}$`;
        }

        const tag = (el.tagName || '').toLowerCase();
        const inner = Array.from(el.childNodes).map(inlineHtmlToMarkdown).join('');
        if (tag === 'strong') return '**' + inner + '**';
        if (tag === 'em') return '*' + inner + '*';
        return inner;
    }

    function fmtListToMarkdown(listEl, depth) {
        depth = depth || 0;
        const indent = '  '.repeat(depth);
        const parts = [];
        for (const item of listEl.querySelectorAll(':scope > .fmt-list-item')) {
            const numSpan = item.querySelector(':scope > .fmt-list-num');
            const contentSpan = item.querySelector(':scope > span:last-child');
            const content = contentSpanToMarkdown(contentSpan, depth);
            const lines = content.split('\n');
            if (numSpan) {
                const n = (numSpan.textContent || '').trim().replace(/\.$/, '');
                parts.push(indent + n + '. ' + (lines[0] || ''));
            } else {
                parts.push(indent + '- ' + (lines[0] || ''));
            }
            for (let i = 1; i < lines.length; i++) parts.push(lines[i]);
        }
        return parts.join('\n');
    }

    function contentSpanToMarkdown(contentSpan, depth) {
        if (!contentSpan) return '';
        let inline = '';
        const nestedParts = [];
        for (const child of contentSpan.childNodes) {
            if (child.nodeType === Node.ELEMENT_NODE && child.classList && child.classList.contains('fmt-list')) {
                nestedParts.push(fmtListToMarkdown(child, depth + 1));
            } else {
                inline += inlineHtmlToMarkdown(child);
            }
        }
        inline = inline.trim();
        if (nestedParts.length > 0) {
            const nested = nestedParts.join('\n');
            return inline ? inline + '\n' + nested : nested;
        }
        return inline;
    }

    function htmlToMarkdown(containerEl) {
        if (!containerEl || !containerEl.children) return (containerEl && containerEl.innerText) ? containerEl.innerText.trim() : '';
        const parts = [];
        for (const child of containerEl.children) {
            if (child.classList && child.classList.contains('fmt-list')) {
                parts.push(fmtListToMarkdown(child, 0));
                parts.push('');
            } else if (child.classList && child.classList.contains('fmt-p')) {
                parts.push(inlineHtmlToMarkdown(child));
            }
        }
        return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function detectListIndentUnit(lines) {
        const indents = [];
        for (const line of lines) {
            const match = line.match(/^(\s*)(?:(?:\d+)\.|[-*])\s+/);
            if (match && match[1].length > 0) indents.push(match[1].length);
        }
        if (indents.length === 0) return 2;
        const min = Math.min(...indents);
        return min <= 2 ? 2 : min;
    }

    function parseMdLine(line, indentUnit) {
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
        if (olMatch) {
            return {
                type: 'ol',
                depth: Math.floor(olMatch[1].replace(/\t/g, '  ').length / indentUnit),
                num: olMatch[2],
                content: olMatch[3],
            };
        }
        const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
        if (ulMatch) {
            return {
                type: 'ul',
                depth: Math.floor(ulMatch[1].replace(/\t/g, '  ').length / indentUnit),
                content: ulMatch[2],
            };
        }
        const trimmed = line.trim();
        if (trimmed === '') return { type: 'blank' };
        return { type: 'p', content: trimmed };
    }

    function normalizeListDepths(parsed) {
        let minDepth = Infinity;
        for (const line of parsed) {
            if ((line.type === 'ol' || line.type === 'ul') && line.depth < minDepth) minDepth = line.depth;
        }
        if (!isFinite(minDepth) || minDepth === 0) return parsed;
        return parsed.map(line => {
            if (line.type !== 'ol' && line.type !== 'ul') return line;
            return { ...line, depth: line.depth - minDepth };
        });
    }

    function renderMdListBlock(parsed, startIdx, baseDepth, doInline) {
        const first = parsed[startIdx];
        const tag = first.type === 'ol' ? 'ol' : 'ul';
        let html = '<' + tag + '>';
        let i = startIdx;
        while (i < parsed.length) {
            const line = parsed[i];
            if (line.type === 'p' || line.type === 'blank') break;
            if (line.depth < baseDepth) break;
            if (line.depth > baseDepth) break;

            html += '<li>';
            if (line.content) html += '<p>' + doInline(line.content) + '</p>';
            i++;
            if (i < parsed.length && (parsed[i].type === 'ol' || parsed[i].type === 'ul') && parsed[i].depth > baseDepth) {
                const nested = renderMdListBlock(parsed, i, baseDepth + 1, doInline);
                html += nested.html;
                i = nested.nextIdx;
            }
            html += '</li>';
        }
        html += '</' + tag + '>';
        return { html, nextIdx: i };
    }

    function mdToHtml(md) {
        if (!md) return "";
        var latexParts = [];
        var lxCount = 0;
        var PH = '\uFFFDLX';
        var protectedMd = md;
        protectedMd = protectedMd.replace(/\$\$([\s\S]+?)\$\$/g, function(m) {
            var ph = PH + (lxCount++) + '\uFFFD';
            latexParts.push({ ph: ph, original: m });
            return ph;
        });
        protectedMd = protectedMd.replace(/\$([^\$\n]+?)\$/g, function(m) {
            var ph = PH + (lxCount++) + '\uFFFD';
            latexParts.push({ ph: ph, original: m });
            return ph;
        });
        const escape = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const doInline = (text) =>
            escape(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
        const lines = protectedMd.split(/\n/);
        const indentUnit = detectListIndentUnit(lines);
        const parsed = normalizeListDepths(lines.map(line => parseMdLine(line, indentUnit)));
        let out = '';
        let i = 0;

        while (i < parsed.length) {
            const line = parsed[i];
            if (line.type === 'blank') {
                i++;
                continue;
            }
            if (line.type === 'p') {
                out += '<p>' + doInline(line.content) + '</p>';
                i++;
                continue;
            }
            const block = renderMdListBlock(parsed, i, 0, doInline);
            if (block.nextIdx === i) {
                out += '<p>' + doInline(line.content || '') + '</p>';
                i++;
                continue;
            }
            out += block.html;
            i = block.nextIdx;
        }

        for (var j = 0; j < latexParts.length; j++) {
            out = out.split(latexParts[j].ph).join(
                latexParts[j].original.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            );
        }
        return out || '<p></p>';
    }

    function parseTaggedFlashcardFromText(rawText) {
        const text = (rawText || '').trim();
        if (!text) return null;
        if (!/\[F\]/i.test(text)) return null;
        const block = text.split(/\[F\]/i)[1] || '';
        const normalized = block.replace(/\[(B|E|END)\]/gi, '\n[$1]');
        const lines = normalized.split(/\r?\n/);
        let front = '';
        let back = '';
        let explanation = '';
        let currentTag = 'F';
        let currentContent = [];

        function flush() {
            const s = currentContent.join('\n').trim();
            if (currentTag === 'F') front = s;
            else if (currentTag === 'B') back = s;
            else if (currentTag === 'E') explanation = s;
            currentContent = [];
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const m = line.match(/^\[(B|E|END)\]\s*(.*)$/i);
            if (m) {
                flush();
                const tag = (m[1] || '').toUpperCase();
                if (tag === 'END') break;
                currentTag = tag;
                currentContent = [m[2] || ''];
            } else {
                currentContent.push(line);
            }
        }
        flush();
        if (!front || !back) return null;
        return {
            type: 'flashcard',
            front: front.trim(),
            back: back.trim(),
            explanation: explanation.trim() || '',
        };
    }

    function pageLooksLikeFlashcardForm() {
        const href = (location.href || '').toLowerCase();
        const hasUrlHint = href.includes('flashcard');
        const labels = Array.from(document.querySelectorAll('label')).map(el => (el.textContent || '').toLowerCase());
        const hasLabelHints = labels.some(t => t.includes('front')) &&
            labels.some(t => t.includes('back')) &&
            labels.some(t => t.includes('explanation'));
        return hasUrlHint || hasLabelHints;
    }

    // --- 1. LOCALHOST: THE SCRAPER ---
    if (location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1")) {
        const btn = document.createElement('button');
        btn.innerHTML = '🚀 Sync';
        Object.assign(btn.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', padding: '12px 20px', background: '#4F46E5', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' });
        document.body.appendChild(btn);

        btn.onclick = () => {
            const selection = window.getSelection();
            if (selection.rangeCount === 0 || selection.toString().trim() === "") {
                alert("Please highlight MCQ or flashcard tagged text first!");
                return;
            }

            const selectedText = selection.toString();
            const taggedFlashcard = parseTaggedFlashcardFromText(selectedText);
            if (taggedFlashcard) {
                GM_setValue(DATA_KEY, taggedFlashcard);
                btn.innerHTML = '✅ Flashcard Sent!';
                setTimeout(() => btn.innerHTML = '🚀 Sync', 1500);
                return;
            }

            let node = selection.getRangeAt(0).commonAncestorContainer;
            if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
            const scope = (node && node.closest)
                ? (node.closest('.question-card') || node.closest('.mb-4') || node.closest('.content-card') || node)
                : node;

            const stemEl = scope.querySelector('.question-stem');
            const optionEls = scope.querySelectorAll('.option-text');
            const explanationEls = scope.querySelectorAll('.explanation-container');

            // Question stem: use HTML→markdown if it's rendered markdown, else plain text
            let questionText = '';
            if (stemEl) {
                questionText = (stemEl.classList.contains('rendered-markdown') && stemEl.children.length)
                    ? htmlToMarkdown(stemEl)
                    : (stemEl.innerText || '').trim();
            }

            const options = Array.from(optionEls).map(el => {
                if (el.querySelector('.math-inline, .math-display')) return inlineHtmlToMarkdown(el).trim();
                return (el.innerText || '').trim();
            });

            // Explanations: use HTML→markdown when rendered, else plain text
            const explanations = Array.from(explanationEls).map(el => {
                if (el.classList.contains('rendered-markdown') && el.children.length)
                    return htmlToMarkdown(el);
                return (el.innerText || '').trim();
            });

            // Correct answer: checked radio, .is-correct wrapper, or legacy bg-primary styling
            let correctOption = "";
            const optionWrappers = scope.querySelectorAll('.option-wrapper');
            for (const wrap of optionWrappers) {
                const letter = (wrap.getAttribute('data-option-letter') || '').trim().toUpperCase()
                    || ((wrap.querySelector('.option-letter')?.textContent || '').trim().toUpperCase());
                if (!letter) continue;

                const checkedRadio = wrap.querySelector('input[type="radio"]:checked');
                if (checkedRadio) {
                    correctOption = (checkedRadio.value || letter).trim().toUpperCase();
                    break;
                }
                if (wrap.classList.contains('is-correct')) {
                    correctOption = letter;
                    break;
                }
                const letterEl = wrap.querySelector('.option-letter');
                if (letterEl && (letterEl.classList.contains('bg-primary') || wrap.classList.contains('border-primary'))) {
                    correctOption = letter;
                    break;
                }
            }

            const data = {
                type: 'mcq',
                question: questionText,
                options,
                explanations,
                correctOption: correctOption,
                level: scope.querySelector('.question-difficulty-badge')?.innerText.trim() || "",
                subject: scope.querySelector('.question-subject-tag')?.innerText.trim() || "",
                topic: (scope.querySelector('.question-topic-tags .badge-topic') || scope.querySelector('.badge-topic'))?.innerText.trim()
                    || scope.querySelector('.bg-slate-100.dark\\:bg-slate-700')?.innerText.trim() || ""
            };

            GM_setValue(DATA_KEY, data);
            btn.innerHTML = '✅ Formatting Sent!';
            setTimeout(() => btn.innerHTML = '🚀 Sync', 1500);
        };
    }

    // --- 2. SPACED REVISION: THE INJECTOR ---
    if (location.href.includes("spacedrevision.com")) {
        const delay = ms => new Promise(r => setTimeout(r, ms));

        // Paste HTML into a TipTap/ProseMirror editor in a way ProseMirror
        // understands. Prefer execCommand('insertHTML') (what browsers use
        // for rich pastes), and fall back to a synthetic ClipboardEvent,
        // and finally to direct innerHTML + input event as a last resort.
        function pasteIntoEditor(editorEl, html) {
            editorEl.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editorEl);
            sel.removeAllRanges();
            sel.addRange(range);

            // 1) Try execCommand, which ProseMirror/Tiptap hooks into.
            try {
                const ok = document.execCommand && document.execCommand('insertHTML', false, html);
                if (ok) return;
            } catch (e) {
                console.warn('execCommand insertHTML failed, trying ClipboardEvent', e);
            }

            // 2) Try synthetic ClipboardEvent-based paste.
            try {
                const dt = new DataTransfer();
                dt.setData('text/html', html);
                dt.setData('text/plain', html.replace(/<[^>]*>/g, ''));
                const evt = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: dt,
                });
                const dispatched = editorEl.dispatchEvent(evt);
                if (dispatched) return;
            } catch (e) {
                console.warn('ClipboardEvent paste failed, falling back to innerHTML', e);
            }

            // 3) Absolute fallback.
            editorEl.innerHTML = html;
            editorEl.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Set value on a React-controlled <select>.
        function setReactSelect(select, value) {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLSelectElement.prototype, 'value').set;
            nativeSetter.call(select, value);
            const tracker = select._valueTracker;
            if (tracker) tracker.setValue('');
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function sortByDocumentPosition(nodes) {
            return nodes.slice().sort((a, b) => {
                const pos = a.compareDocumentPosition(b);
                if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
            });
        }

        function hasAllClasses(el, tokens) {
            const cls = typeof el.className === 'string' ? el.className : '';
            return tokens.every(t => cls.includes(t));
        }

        function isSrAnswerRow(el) {
            return el && el.tagName === 'DIV'
                && hasAllClasses(el, ['flex', 'items-center', 'gap-4', 'mt-4', 'mb-2'])
                && /select\s+as\s+answer/i.test((el.textContent || '').replace(/\s+/g, ' '));
        }

        function isSrAnswerToggle(el) {
            return el && el.tagName === 'DIV'
                && hasAllClasses(el, ['w-11', 'h-6', 'rounded-full', 'peer-checked:after:translate-x-5']);
        }

        function findMcqAnswerRows() {
            return sortByDocumentPosition(Array.from(document.querySelectorAll('div')).filter(isSrAnswerRow));
        }

        function inputFromAnswerRow(row) {
            if (!row) return null;
            const toggle = row.querySelector('div[class*="peer-checked:after:translate-x-5"]')
                || row.querySelector('div[class*="w-11"][class*="h-6"][class*="rounded-full"]');
            if (toggle && toggle.previousElementSibling?.matches('input[type="checkbox"], input[type="radio"]')) {
                return toggle.previousElementSibling;
            }
            return row.querySelector('input[type="checkbox"], input[type="radio"]')
                || inputFromAnswerLabel(row.querySelector('label'));
        }

        function toggleFromAnswerRow(row) {
            if (!row) return null;
            return row.querySelector('div[class*="peer-checked:after:translate-x-5"]')
                || row.querySelector('div[class*="w-11"][class*="h-6"][class*="rounded-full"]');
        }

        function inputFromAnswerLabel(label) {
            if (!label) return null;
            const direct = label.querySelector('input[type="checkbox"], input[type="radio"]');
            if (direct) return direct;
            if (label.htmlFor) {
                const linked = document.getElementById(label.htmlFor);
                if (linked && linked.matches('input[type="checkbox"], input[type="radio"]')) return linked;
            }
            const sibling = label.previousElementSibling;
            if (sibling && sibling.matches('input[type="checkbox"], input[type="radio"]')) return sibling;
            const toggle = label.querySelector('div[class*="rounded-full"]');
            if (toggle?.previousElementSibling?.matches('input')) return toggle.previousElementSibling;
            return label.control || null;
        }

        function findMcqAnswerInputs() {
            const rows = findMcqAnswerRows();
            if (rows.length >= 4) {
                const inputs = rows.slice(0, 4).map(inputFromAnswerRow).filter(Boolean);
                if (inputs.length === 4) return inputs;
            }

            const toggles = sortByDocumentPosition(
                Array.from(document.querySelectorAll('div')).filter(isSrAnswerToggle)
            );
            if (toggles.length >= 4) {
                const inputs = toggles.slice(0, 4).map(toggle => {
                    if (toggle.previousElementSibling?.matches('input[type="checkbox"], input[type="radio"]')) {
                        return toggle.previousElementSibling;
                    }
                    const row = toggle.closest('div');
                    return row ? inputFromAnswerRow(row) : null;
                }).filter(Boolean);
                if (inputs.length === 4) return inputs;
            }

            const answerLabels = sortByDocumentPosition(
                Array.from(document.querySelectorAll('label')).filter(l =>
                    /select\s+as\s+answer/i.test((l.textContent || '').replace(/\s+/g, ' '))
                )
            );
            if (answerLabels.length >= 4) {
                const inputs = answerLabels.slice(0, 4).map(inputFromAnswerLabel).filter(Boolean);
                if (inputs.length === 4) return inputs;
            }

            const byOption = [];
            for (let n = 1; n <= 4; n++) {
                const optLabel = Array.from(document.querySelectorAll('label')).find(l =>
                    new RegExp('option\\s*' + n + '\\b', 'i').test((l.textContent || '').replace(/\s+/g, ' '))
                );
                if (!optLabel) return null;
                let root = optLabel.closest('div');
                let answerInput = null;
                for (let depth = 0; depth < 8 && root; depth++) {
                    if (isSrAnswerRow(root)) {
                        answerInput = inputFromAnswerRow(root);
                        break;
                    }
                    const answerLabel = Array.from(root.querySelectorAll('label')).find(l =>
                        /select\s+as\s+answer/i.test((l.textContent || '').replace(/\s+/g, ' '))
                    );
                    answerInput = inputFromAnswerLabel(answerLabel);
                    if (answerInput) break;
                    root = root.parentElement;
                }
                if (!answerInput) return null;
                byOption.push(answerInput);
            }
            return byOption.length === 4 ? byOption : null;
        }

        function activateAnswerControl(input, shouldBeActive, row) {
            if (!input) return false;
            if (input.checked === shouldBeActive) return true;

            const toggle = toggleFromAnswerRow(row)
                || input.nextElementSibling?.matches('div') && input.nextElementSibling
                || input.parentElement?.querySelector('div[class*="peer-checked:after:translate-x-5"]')
                || input.parentElement?.querySelector('div[class*="w-11"][class*="h-6"][class*="rounded-full"]');
            const label = input.closest('label')
                || (input.id ? document.querySelector('label[for="' + CSS.escape(input.id) + '"]') : null);
            const clickTargets = [toggle, label, input].filter(Boolean);

            for (const target of clickTargets) {
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                if (input.checked === shouldBeActive) return true;
            }

            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked').set;
            setter.call(input, shouldBeActive);
            const tracker = input._valueTracker;
            if (tracker) tracker.setValue(String(!shouldBeActive));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return input.checked === shouldBeActive;
        }

        async function selectCorrectAnswer(correctIndex) {
            if (correctIndex < 0) return false;

            for (let attempt = 0; attempt < 6; attempt++) {
                const rows = findMcqAnswerRows();
                if (rows.length > correctIndex) {
                    rows.forEach((row, i) => {
                        if (i === correctIndex) return;
                        const input = inputFromAnswerRow(row);
                        if (input?.checked) activateAnswerControl(input, false, row);
                    });
                    await delay(80);
                    const targetRow = rows[correctIndex];
                    const targetInput = inputFromAnswerRow(targetRow);
                    const targetToggle = toggleFromAnswerRow(targetRow);
                    if (targetToggle) targetToggle.click();
                    await delay(80);
                    if (targetInput?.checked) return true;
                    if (activateAnswerControl(targetInput, true, targetRow)) return true;
                }

                const inputs = findMcqAnswerInputs();
                if (inputs && inputs.length > correctIndex) {
                    inputs.forEach((input, i) => {
                        if (i !== correctIndex && input.checked) activateAnswerControl(input, false);
                    });
                    await delay(80);
                    if (activateAnswerControl(inputs[correctIndex], true)) return true;
                }

                await delay(350);
            }
            return false;
        }

        function findEditorByLabel(labelNeedle) {
            const needle = (labelNeedle || '').toLowerCase();
            const labels = Array.from(document.querySelectorAll('label'));
            for (const label of labels) {
                const text = (label.textContent || '').trim().toLowerCase();
                if (!text.includes(needle)) continue;
                const container = label.closest('div,section,form') || document;
                let editor = container.querySelector('.tiptap.ProseMirror');
                if (!editor && label.parentElement) {
                    editor = label.parentElement.querySelector('.tiptap.ProseMirror');
                }
                if (!editor) {
                    const maybeSibling = label.nextElementSibling;
                    if (maybeSibling) editor = maybeSibling.querySelector && maybeSibling.querySelector('.tiptap.ProseMirror');
                }
                if (editor) return editor;
            }
            return null;
        }

        function findFlashcardSubmitButton() {
            return Array.from(document.querySelectorAll('button,input[type="submit"]')).find(el => {
                const text = ((el.textContent || '') + ' ' + (el.value || '')).toLowerCase();
                if (!text.includes('submit')) return false;
                const cls = (el.className || '');
                return cls.includes('bg-teal-600') &&
                    cls.includes('hover:bg-teal-700') &&
                    cls.includes('text-white') &&
                    cls.includes('font-semibold') &&
                    cls.includes('px-8') &&
                    cls.includes('py-3') &&
                    cls.includes('rounded-lg') &&
                    cls.includes('transition-colors') &&
                    cls.includes('w-full') &&
                    cls.includes('max-w-md');
            });
        }

        const performPasteMcq = async (data) => {
            // Paste into each editor sequentially with a delay between each one.
            const editors = document.querySelectorAll('.tiptap.ProseMirror');
            for (const editor of editors) {
                const parentHTML = editor.closest('div').parentElement.innerHTML;
                let content = "";

                if (parentHTML.includes('Question')) content = data.question;
                else if (parentHTML.includes('Option 1')) content = data.options[0];
                else if (parentHTML.includes('Explanation 1')) content = data.explanations[0];
                else if (parentHTML.includes('Option 2')) content = data.options[1];
                else if (parentHTML.includes('Explanation 2')) content = data.explanations[1];
                else if (parentHTML.includes('Option 3')) content = data.options[2];
                else if (parentHTML.includes('Explanation 3')) content = data.explanations[2];
                else if (parentHTML.includes('Option 4')) content = data.options[3];
                else if (parentHTML.includes('Explanation 4')) content = data.explanations[3];

                if (content) {
                    const html = mdToHtml(content);
                    pasteIntoEditor(editor, html);
                    await delay(200);
                }
            }

            const setDropdown = (labelText, valueToSet) => {
                const targetContainer = Array.from(document.querySelectorAll('div')).find(c =>
                    c.querySelector('label')?.innerText.includes(labelText));
                const select = targetContainer?.querySelector('select');
                if (select && valueToSet) {
                    const opt = Array.from(select.options).find(o =>
                        o.text.trim().toLowerCase() === valueToSet.toLowerCase());
                    if (opt) setReactSelect(select, opt.value);
                }
            };

            setDropdown('Level', data.level);
            setDropdown('Subject', data.subject);
            await delay(500);
            setDropdown('Topic', data.topic);

            const correctIndex = data.correctOption ? ['A', 'B', 'C', 'D'].indexOf(data.correctOption.toUpperCase()) : -1;
            if (correctIndex < 0) {
                console.warn('[MCQ Bridge] No correct answer in payload — highlight the full question card on localhost and click Sync again.');
            }
            await delay(600);
            await selectCorrectAnswer(correctIndex);

            // Finally, click the \"Save MCQ\" button on Spaced Revision so the
            // newly-pasted content is submitted. Give React a brief moment to
            // flush state from the TipTap editors and dropdowns first.
            await delay(500);
            const saveBtn = Array.from(document.querySelectorAll('input[type=\"submit\"],button'))
                .find(el => {
                    const cls = el.className || '';
                    return cls.includes('bg-[#0E766E]') &&
                           cls.includes('text-white') &&
                           cls.includes('px-6') &&
                           cls.includes('py-2') &&
                           cls.includes('rounded-md') &&
                           cls.includes('font-semibold') &&
                           (el.value === 'Save MCQ ' || (el.textContent || '').includes('Save MCQ'));
                });
            if (saveBtn) {
                saveBtn.click();
            }
        };

        const performPasteFlashcard = async (data) => {
            if (!pageLooksLikeFlashcardForm()) {
                alert('Received flashcard payload, but current page does not look like a flashcard form.');
                return;
            }
            const frontEditor = findEditorByLabel('front');
            const backEditor = findEditorByLabel('back');
            const explanationEditor = findEditorByLabel('explanation');
            if (!frontEditor || !backEditor || !explanationEditor) {
                alert('Could not find Front/Back/Explanation editors on this page.');
                return;
            }

            pasteIntoEditor(frontEditor, mdToHtml(data.front || ''));
            await delay(200);
            pasteIntoEditor(backEditor, mdToHtml(data.back || ''));
            await delay(200);
            pasteIntoEditor(explanationEditor, mdToHtml(data.explanation || ''));
            await delay(400);

            const submitBtn = findFlashcardSubmitButton();
            if (submitBtn && !submitBtn.disabled) submitBtn.click();
        };

        const routePayload = async (data) => {
            if (!data || !data.type) return;
            if (data.type === 'flashcard') return performPasteFlashcard(data);
            if (data.type === 'mcq') return performPasteMcq(data);
        };

        const pBtn = document.createElement('button');
        pBtn.innerHTML = '📥 Paste';
        Object.assign(pBtn.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', padding: '12px 20px', background: '#4F46E5', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' });
        document.body.appendChild(pBtn);
        pBtn.onclick = () => { const d = GM_getValue(DATA_KEY); if (d) routePayload(d); };
        GM_addValueChangeListener(DATA_KEY, (n, o, v, r) => { if (r) routePayload(v); });
    }
})();
