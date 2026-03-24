// ==UserScript==
// @name         Selection-Based MCQ Bridge
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Preserves Markdown formatting (bold, italic, lists) via HTML↔Markdown; uses ClipboardEvent for React/TipTap state sync
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

    const DATA_KEY = "mcqTransfer";

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

    function htmlToMarkdown(containerEl) {
        if (!containerEl || !containerEl.children) return (containerEl && containerEl.innerText) ? containerEl.innerText.trim() : '';
        const parts = [];
        for (const child of containerEl.children) {
            if (child.classList && child.classList.contains('fmt-list')) {
                const items = child.querySelectorAll(':scope > .fmt-list-item');
                items.forEach(item => {
                    const numSpan = item.querySelector(':scope > .fmt-list-num');
                    const contentSpan = item.querySelector(':scope > span:last-child');
                    const content = contentSpan ? inlineHtmlToMarkdown(contentSpan) : '';
                    if (numSpan) {
                        const n = (numSpan.textContent || '').trim().replace(/\.$/, '');
                        parts.push(n + '. ' + content);
                    } else {
                        parts.push('- ' + content);
                    }
                });
                parts.push(''); // block separator after list
            } else if (child.classList && child.classList.contains('fmt-p')) {
                parts.push(inlineHtmlToMarkdown(child));
            }
        }
        return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
        let out = '';
        let inOl = false, inUl = false;
        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i];
            const olMatch = raw.match(/^(\d+)\.\s+(.*)$/);
            const ulMatch = raw.match(/^[-*]\s+(.*)$/);
            if (olMatch) {
                if (!inOl) { if (inUl) out += '</ul>'; inUl = false; out += '<ol>'; inOl = true; }
                out += '<li>' + doInline(olMatch[2]) + '</li>';
            } else if (ulMatch) {
                if (!inUl) { if (inOl) out += '</ol>'; inOl = false; out += '<ul>'; inUl = true; }
                out += '<li>' + doInline(ulMatch[1]) + '</li>';
            } else {
                if (inOl) { out += '</ol>'; inOl = false; }
                if (inUl) { out += '</ul>'; inUl = false; }
                const trimmed = raw.trim();
                if (trimmed !== '') out += '<p>' + doInline(trimmed).replace(/\n/g, '<br>') + '</p>';
            }
        }
        if (inOl) out += '</ol>';
        if (inUl) out += '</ul>';
        for (var j = 0; j < latexParts.length; j++) {
            out = out.split(latexParts[j].ph).join(
                latexParts[j].original.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            );
        }
        return out || '<p></p>';
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
                alert("Please highlight the MCQ text first!");
                return;
            }

            const container = selection.getRangeAt(0).commonAncestorContainer.parentElement;
            const scope = container.closest('.mb-4') || container.closest('div') || container;

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

            // Correct answer: option with .option-letter.bg-primary (or wrapper with border-primary)
            let correctOption = "";
            const optionWrappers = scope.querySelectorAll('.option-wrapper');
            optionWrappers.forEach(wrap => {
                const letterEl = wrap.querySelector('.option-letter');
                if (letterEl && (letterEl.classList.contains('bg-primary') || wrap.classList.contains('border-primary'))) {
                    correctOption = (letterEl.textContent || '').trim().toUpperCase() || "";
                }
            });

            const data = {
                question: questionText,
                options,
                explanations,
                correctOption: correctOption,
                level: scope.querySelector('.question-difficulty-badge')?.innerText.trim() || "",
                subject: scope.querySelector('.question-subject-tag')?.innerText.trim() || "",
                topic: scope.querySelector('.bg-slate-100.dark\\:bg-slate-700')?.innerText.trim() || ""
            };

            GM_setValue(DATA_KEY, data);
            btn.innerHTML = '✅ Formatting Sent!';
            setTimeout(() => btn.innerHTML = '🚀 Sync', 1500);
        };
    }

    // --- 2. SPACED REVISION: THE INJECTOR ---
    if (location.href.includes("spacedrevision.com")) {
        const performPaste = async (data) => {
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

                // 3) Absolute fallback – at least makes text visible, though
                // some frameworks may not fully sync state from this.
                editorEl.innerHTML = html;
                editorEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Set value on a React-controlled <select> by resetting React's
            // internal value tracker so the synthetic change event is recognised.
            function setReactSelect(select, value) {
                const nativeSetter = Object.getOwnPropertyDescriptor(
                    HTMLSelectElement.prototype, 'value').set;
                nativeSetter.call(select, value);
                const tracker = select._valueTracker;
                if (tracker) tracker.setValue('');
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Paste into each editor sequentially with a delay between each one.
            // The delay lets React re-render so that the next editor's
            // handleEditorChange closure captures the updated formData.
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
            if (correctIndex >= 0) {
                const toggleSelector = 'div[class*="peer-checked:after:translate-x-5"], div[class*="w-11"][class*="h-6"][class*="rounded-full"]';
                const toggleDivs = Array.from(document.querySelectorAll(toggleSelector)).filter(d => {
                    const label = d.closest('label');
                    return label && (label.textContent || '').includes('Select as Answer');
                });
                const checkboxes = toggleDivs.map(div => {
                    const input = div.previousElementSibling && div.previousElementSibling.matches('input[type="checkbox"]')
                        ? div.previousElementSibling
                        : div.closest('label')?.querySelector('input[type="checkbox"]');
                    return input;
                }).filter(Boolean);
                if (checkboxes.length >= 4 && correctIndex < checkboxes.length) {
                    checkboxes.forEach((cb, i) => {
                        const shouldCheck = i === correctIndex;
                        if (cb.checked !== shouldCheck) {
                            cb.click();
                        }
                    });
                }
            }

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

        const pBtn = document.createElement('button');
        pBtn.innerHTML = '📥 Paste';
        Object.assign(pBtn.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', padding: '12px 20px', background: '#4F46E5', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' });
        document.body.appendChild(pBtn);
        pBtn.onclick = () => { const d = GM_getValue(DATA_KEY); if (d) performPaste(d); };
        GM_addValueChangeListener(DATA_KEY, (n, o, v, r) => { if (r) performPaste(v); });
    }
})();
