/**
 * Renders a single MCQ card: stem, options, correct-answer toggle, inline
 * editing of stem/options/explanations, per-option explanation entry, and
 * delete.
 */
import { supabase } from '../../lib/supabase.js';
import { renderFormattedText } from '../../render/markdown.js';
import { renderTextWithLatex } from '../../render/latex.js';
import { topicsForSubject } from '../../data/taxonomy.js';
import { DIFFICULTY_LABELS, DIFFICULTY_CLASSES, taxonomy } from './state.js';

function fitBadgeSelectWidth(select) {
    const opt = select.options[select.selectedIndex];
    const label = (opt && opt.textContent) || select.getAttribute('data-placeholder') || '';
    const rootFs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const probe = document.createElement('span');
    probe.style.cssText = [
        'position:absolute',
        'visibility:hidden',
        'white-space:nowrap',
        'pointer-events:none',
        'left:-9999px',
        'top:0',
        'font-size:0.6875rem',
        'font-weight:500',
        'letter-spacing:0.02em',
        'font-family:' + getComputedStyle(document.body).fontFamily
    ].join(';');
    probe.textContent = label;
    document.body.appendChild(probe);
    const textWidth = probe.getBoundingClientRect().width;
    probe.remove();
    // Match select.badge-select paddings: 0.5rem left, 1.35rem right (chevron)
    select.style.width = Math.ceil(textWidth + (0.5 + 1.35) * rootFs) + 'px';
}

function fillSelectOptions(select, items, selectedValue, placeholder) {
    select.innerHTML = '';
    if (placeholder != null) {
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = placeholder;
        select.appendChild(empty);
        select.setAttribute('data-placeholder', placeholder);
    }
    items.forEach(item => {
        const value = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string' ? item : item.label;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
    });
    select.value = selectedValue || '';
    if (selectedValue && select.value !== selectedValue) {
        const orphan = document.createElement('option');
        orphan.value = selectedValue;
        orphan.textContent = selectedValue;
        select.appendChild(orphan);
        select.value = selectedValue;
    }
    fitBadgeSelectWidth(select);
}

async function persistQuestionMeta(question, patch) {
    if (!supabase) {
        alert('Supabase not configured.');
        return false;
    }
    const { error } = await supabase.from('questions').update(patch).eq('id', question.id);
    if (error) {
        alert('Failed to update: ' + error.message);
        return false;
    }
    Object.assign(question, patch);
    return true;
}

function subjectIdByName(name) {
    const match = (taxonomy.subjects || []).find(s => s.name === name);
    return match ? match.id : null;
}

function mountEditableMetaTags(card, question) {
    const difficultyEl = card.querySelector('.question-difficulty-badge');
    if (difficultyEl) {
        const select = document.createElement('select');
        const diffClass = DIFFICULTY_CLASSES[question.difficulty] || DIFFICULTY_CLASSES.medium;
        select.className = 'question-difficulty-badge badge badge-select ' + diffClass;
        select.title = 'Change difficulty';
        select.setAttribute('aria-label', 'Difficulty');
        fillSelectOptions(select, [
            { value: 'easy', label: DIFFICULTY_LABELS.easy },
            { value: 'medium', label: DIFFICULTY_LABELS.medium },
            { value: 'hard', label: DIFFICULTY_LABELS.hard }
        ], question.difficulty || 'medium');
        select.addEventListener('change', async () => {
            const prev = question.difficulty;
            const next = select.value;
            select.className = 'question-difficulty-badge badge badge-select ' + (DIFFICULTY_CLASSES[next] || DIFFICULTY_CLASSES.medium);
            fitBadgeSelectWidth(select);
            const ok = await persistQuestionMeta(question, { difficulty: next });
            if (!ok) {
                select.value = prev || 'medium';
                select.className = 'question-difficulty-badge badge badge-select ' + (DIFFICULTY_CLASSES[prev] || DIFFICULTY_CLASSES.medium);
                fitBadgeSelectWidth(select);
            }
        });
        difficultyEl.replaceWith(select);
    }

    const subjectEl = card.querySelector('.question-subject-tag');
    const topicTagsEl = card.querySelector('.question-topic-tags');
    let topicSelect = null;

    function rebuildTopicOptions(subjectName, selectedTopic) {
        if (!topicSelect) return;
        const sid = subjectIdByName(subjectName);
        const topics = topicsForSubject(taxonomy.topics, sid).map(t => t.name);
        fillSelectOptions(topicSelect, topics, selectedTopic || '', 'Topic');
        topicSelect.disabled = !subjectName || topics.length === 0;
    }

    if (subjectEl) {
        const select = document.createElement('select');
        select.className = 'question-subject-tag badge badge-select badge-neutral';
        select.title = 'Change subject';
        select.setAttribute('aria-label', 'Subject');
        const subjectNames = (taxonomy.subjects || []).map(s => s.name);
        const currentSubject = (question.subject || '').trim();
        fillSelectOptions(select, subjectNames, currentSubject, 'Subject');
        select.addEventListener('change', async () => {
            const prevSubject = question.subject || '';
            const prevTopics = Array.isArray(question.topics) ? question.topics.slice() : [];
            const nextSubject = select.value;
            const sid = subjectIdByName(nextSubject);
            const allowed = new Set(topicsForSubject(taxonomy.topics, sid).map(t => t.name));
            const kept = (prevTopics || []).filter(t => allowed.has(t));
            const nextTopics = kept.length ? kept : null;
            fitBadgeSelectWidth(select);
            rebuildTopicOptions(nextSubject, nextTopics && nextTopics[0] ? nextTopics[0] : '');
            const ok = await persistQuestionMeta(question, {
                subject: nextSubject || null,
                topics: nextTopics
            });
            if (!ok) {
                select.value = prevSubject;
                fitBadgeSelectWidth(select);
                rebuildTopicOptions(prevSubject, prevTopics[0] || '');
                question.subject = prevSubject;
                question.topics = prevTopics;
            }
        });
        subjectEl.replaceWith(select);
    }

    if (topicTagsEl) {
        topicTagsEl.innerHTML = '';
        topicSelect = document.createElement('select');
        topicSelect.className = 'badge badge-select badge-topic';
        topicSelect.title = 'Change topic';
        topicSelect.setAttribute('aria-label', 'Topic');
        const currentTopics = Array.isArray(question.topics) ? question.topics : [];
        const currentTopic = (currentTopics[0] || '').toString().trim();
        rebuildTopicOptions((question.subject || '').trim(), currentTopic);
        topicSelect.addEventListener('change', async () => {
            const prevTopics = Array.isArray(question.topics) ? question.topics.slice() : [];
            const next = topicSelect.value;
            const nextTopics = next ? [next] : null;
            fitBadgeSelectWidth(topicSelect);
            const ok = await persistQuestionMeta(question, { topics: nextTopics });
            if (!ok) {
                topicSelect.value = (prevTopics[0] || '').toString();
                fitBadgeSelectWidth(topicSelect);
            }
        });
        topicTagsEl.appendChild(topicSelect);
    }
}

function createOptionExpInput(row, initialValue) {
    const ta = document.createElement('textarea');
    ta.className = 'option-exp-input';
    ta.rows = 2;
    ta.placeholder = 'Add explanation…';
    ta.setAttribute('data-option-id', row.id || '');
    ta.value = initialValue !== undefined ? initialValue : '';
    function resizeExpTextarea() {
        ta.style.height = 'auto';
        ta.style.height = Math.max(ta.scrollHeight, 56) + 'px';
    }
    ta.addEventListener('input', resizeExpTextarea);
    ta.addEventListener('paste', () => setTimeout(resizeExpTextarea, 0));
    resizeExpTextarea();
    return ta;
}

function mountOptionExplanation(expEl, row) {
    expEl.innerHTML = '';
    const exp = (row && row.explanation) || '';
    if (exp) {
        expEl.classList.add('rendered-markdown');
        expEl.innerHTML = renderFormattedText(exp);
        return;
    }
    expEl.classList.remove('rendered-markdown');
    if (row && row.id) {
        expEl.appendChild(createOptionExpInput(row, ''));
    }
}

function ensureOptionExpInput(expEl, row) {
    let ta = expEl.querySelector('.option-exp-input');
    if (!ta && row && row.id) {
        expEl.innerHTML = '';
        expEl.classList.remove('rendered-markdown');
        ta = createOptionExpInput(row, '');
        expEl.appendChild(ta);
    }
    return ta;
}

function updateCorrectAnswerVisuals(card, letters, correctLetter) {
    letters.forEach(letter => {
        const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
        if (!wrap) return;
        const isCorrect = !!correctLetter && letter === correctLetter;
        wrap.className = 'option-wrapper option-row' + (isCorrect ? ' is-correct' : '');
        const letterEl = wrap.querySelector('.option-letter');
        if (letterEl) letterEl.className = 'option-letter';
        const optText = wrap.querySelector('.option-text');
        if (optText) {
            const hidden = optText.classList.contains('hidden');
            optText.className = hidden ? 'option-text hidden' : 'option-text';
        }
    });
}

/**
 * @param {object} question
 * @param {object[]} opts
 * @param {{ onDeleted?: () => void }} [ctx]
 */
export function renderQuestionCard(question, opts, ctx) {
    ctx = ctx || {};
    const t = document.getElementById('question-card-template');
    const clone = t.content.cloneNode(true);
    const card = clone.querySelector('.question-card');
    const serialEl = card.querySelector('.question-serial-badge');
    if (serialEl && typeof question.index === 'number') {
        const n = (question.index || 0);
        serialEl.textContent = n.toString() + '.';
    }
    const headingTag = card.querySelector('.question-heading-tag');
    if (headingTag) {
        const h = (question.heading || '').trim();
        if (h) {
            headingTag.textContent = h;
            headingTag.className = 'question-heading-tag badge badge-heading';
        }
    }
    mountEditableMetaTags(card, question);
    const stemEl = card.querySelector('.question-stem');
    stemEl.classList.add('rendered-markdown');
    stemEl.innerHTML = renderFormattedText(question.stem || '');

    const actionsRow = document.createElement('div');
    actionsRow.className = 'question-inline-edit-actions hidden';
    actionsRow.style.cssText = 'display:none;flex-wrap:wrap;align-items:center;gap:0.5rem;margin-top:0.75rem';
    actionsRow.innerHTML =
        '<button type="button" class="save-inline-edit-btn btn btn-primary">Save</button>' +
        '<button type="button" class="cancel-inline-edit-btn btn btn-ghost">Cancel</button>' +
        '<span class="inline-edit-status" style="font-size:0.75rem;color:var(--clr-text-secondary)"></span>';

    const optionsGrid = card.querySelector('.question-options');
    const letters = ['A', 'B', 'C', 'D'];
    const optMap = {};
    (opts || []).forEach(o => { optMap[o.option_letter] = o; });

    letters.forEach(letter => {
        const o = optMap[letter] || {};
        const isCorrect = o.is_correct === true;

        const div = document.createElement('div');
        div.setAttribute('data-option-letter', letter);
        div.className = 'option-wrapper option-row' + (isCorrect ? ' is-correct' : '');
        const radioDisabled = !o.id ? ' disabled' : '';
        const radioChecked = isCorrect ? ' checked' : '';
        div.innerHTML =
            '<div class="option-row__head">' +
            '<div class="option-letter">' + letter + '</div>' +
            '<label class="correct-option-label" title="Mark correct">' +
            '<input type="radio" name="correct-answer-' + question.id + '" value="' + letter + '"' + radioChecked + radioDisabled + ' />' +
            '</label>' +
            '</div>' +
            '<div class="option-content">' +
            '<div class="option-text">' + renderTextWithLatex(o.option_text || '') + '</div>' +
            '<div class="explanation-container" data-opt="' + letter + '"></div>' +
            '</div>';
        const expEl = div.querySelector('.explanation-container');
        expEl.setAttribute('data-opt', letter);
        mountOptionExplanation(expEl, o);

        const correctRadio = div.querySelector('input[type="radio"]');
        if (correctRadio && o.id) {
            correctRadio.addEventListener('change', async () => {
                if (!correctRadio.checked) return;
                const newLetter = correctRadio.value;
                const previousCorrect = letters.find(l => optMap[l] && optMap[l].is_correct === true) || null;
                const setRadioDisabledState = () => {
                    card.querySelectorAll('input[name="correct-answer-' + question.id + '"]').forEach(r => {
                        const L = r.value;
                        r.disabled = !optMap[L] || !optMap[L].id;
                    });
                };
                if (!supabase) {
                    alert('Supabase not configured.');
                    setRadioDisabledState();
                    if (previousCorrect) {
                        const pr = card.querySelector('input[name="correct-answer-' + question.id + '"][value="' + previousCorrect + '"]');
                        if (pr) pr.checked = true;
                    }
                    return;
                }
                card.querySelectorAll('input[name="correct-answer-' + question.id + '"]').forEach(r => { r.disabled = true; });
                let err = null;
                await Promise.all(letters.map(l => {
                    const row = optMap[l];
                    if (!row || !row.id) return Promise.resolve();
                    return supabase.from('options').update({ is_correct: l === newLetter }).eq('id', row.id).then(res => {
                        if (res.error) err = res.error;
                    });
                }));
                if (err) {
                    alert('Failed to update correct answer: ' + err.message);
                    letters.forEach(l => {
                        if (optMap[l]) optMap[l].is_correct = l === previousCorrect;
                    });
                    updateCorrectAnswerVisuals(card, letters, previousCorrect);
                    card.querySelectorAll('input[name="correct-answer-' + question.id + '"]').forEach(r => {
                        r.checked = previousCorrect ? r.value === previousCorrect : false;
                    });
                } else {
                    letters.forEach(l => {
                        if (optMap[l]) optMap[l].is_correct = l === newLetter;
                    });
                    updateCorrectAnswerVisuals(card, letters, newLetter);
                }
                setRadioDisabledState();
            });
        }

        optionsGrid.appendChild(div);
    });

    const hasEditableOptions = () => letters.some(letter => optMap[letter] && optMap[letter].id);

    let cardIsEditing = false;

    function exitInlineEdit() {
        cardIsEditing = false;
        actionsRow.classList.add('hidden');
        actionsRow.style.display = 'none';
        if (hasEditableOptions()) saveAllWrapper.classList.remove('hidden');
        const eb = card.querySelector('.edit-btn');
        if (eb) {
            eb.classList.remove('edit');
            eb.setAttribute('title', 'Edit question');
        }
        const stemTa = stemEl.querySelector('.question-stem-input');
        if (stemTa) stemTa.remove();
        letters.forEach(letter => {
            const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
            if (!wrap) return;
            const ota = wrap.querySelector('.question-option-input');
            if (ota) ota.remove();
            const eta = wrap.querySelector('.question-exp-input');
            if (eta) eta.remove();
            const span = wrap.querySelector('.option-text');
            if (span) span.classList.remove('hidden');
            const expEl = wrap.querySelector('.explanation-container');
            if (expEl) expEl.classList.remove('hidden');
        });
        stemEl.classList.add('rendered-markdown');
        stemEl.innerHTML = renderFormattedText(question.stem || '');
        letters.forEach(letter => {
            const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
            if (!wrap) return;
            const textEl = wrap.querySelector('.option-text');
            if (textEl) textEl.innerHTML = renderTextWithLatex((optMap[letter] && optMap[letter].option_text) || '');
            const expEl = wrap.querySelector('.explanation-container');
            const row = optMap[letter];
            if (!expEl) return;
            mountOptionExplanation(expEl, row);
        });
        const cl = letters.find(l => optMap[l] && optMap[l].is_correct) || null;
        updateCorrectAnswerVisuals(card, letters, cl);
        const st = actionsRow.querySelector('.inline-edit-status');
        if (st) {
            st.textContent = '';
            st.className = 'inline-edit-status status-muted';
        }
    }

    function enterInlineEdit() {
        cardIsEditing = true;
        actionsRow.classList.remove('hidden');
        actionsRow.style.display = 'flex';
        saveAllWrapper.classList.add('hidden');
        const eb = card.querySelector('.edit-btn');
        if (eb) {
            eb.classList.add('edit');
            eb.setAttribute('title', 'Cancel editing');
        }
        stemEl.classList.remove('rendered-markdown');
        stemEl.innerHTML = '';
        const stemTa = document.createElement('textarea');
        stemTa.className = 'question-stem-input field-input';
        stemTa.style.minHeight = '7rem';
        stemTa.value = question.stem || '';
        stemEl.appendChild(stemTa);
        letters.forEach(letter => {
            const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
            if (!wrap) return;
            const span = wrap.querySelector('.option-text');
            if (!span || wrap.querySelector('.question-option-input')) return;
            span.classList.add('hidden');
            const o = optMap[letter] || {};
            const ota = document.createElement('textarea');
            ota.className = 'question-option-input field-input';
            ota.style.minHeight = '3rem';
            ota.value = o.option_text || '';
            ota.setAttribute('data-option-letter', letter);
            span.insertAdjacentElement('afterend', ota);

            const expEl = wrap.querySelector('.explanation-container');
            if (expEl) expEl.classList.add('hidden');

            const eta = document.createElement('textarea');
            eta.className = 'question-exp-input field-input';
            eta.style.minHeight = '4.5rem';
            eta.value = o.explanation || '';
            eta.setAttribute('data-option-letter', letter);
            eta.placeholder = 'Edit explanation for option ' + letter + '...';
            ota.insertAdjacentElement('afterend', eta);
        });
    }

    actionsRow.querySelector('.cancel-inline-edit-btn').addEventListener('click', () => exitInlineEdit());
    actionsRow.querySelector('.save-inline-edit-btn').addEventListener('click', async () => {
        const btn = actionsRow.querySelector('.save-inline-edit-btn');
        const status = actionsRow.querySelector('.inline-edit-status');
        if (!supabase) {
            status.textContent = 'Supabase not configured.';
            status.className = 'inline-edit-status status-error';
            return;
        }
        const stemTa = stemEl.querySelector('.question-stem-input');
        const newStem = stemTa ? stemTa.value : question.stem;
        btn.disabled = true;
        status.textContent = 'Saving...';
        status.className = 'inline-edit-status status-muted';
        const { error: qErr } = await supabase.from('questions').update({ stem: newStem }).eq('id', question.id);
        if (qErr) {
            status.textContent = 'Failed: ' + qErr.message;
            status.className = 'inline-edit-status status-error';
            btn.disabled = false;
            return;
        }
        question.stem = newStem;
        let optErr = null;
        await Promise.all(letters.map(async letter => {
            const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
            const ota = wrap && wrap.querySelector('.question-option-input');
            const eta = wrap && wrap.querySelector('.question-exp-input');
            const row = optMap[letter];
            if (!ota || !eta || !row || !row.id) return;
            const text = ota.value;
            const explanation = (eta.value || '').trim();
            const { error } = await supabase
                .from('options')
                .update({ option_text: text, explanation: explanation || null })
                .eq('id', row.id);
            if (error) optErr = error;
            else {
                row.option_text = text;
                row.explanation = explanation || null;
            }
        }));
        btn.disabled = false;
        if (optErr) {
            alert('Stem saved, but an option failed to save: ' + optErr.message);
        }
        exitInlineEdit();
    });

    const saveAllWrapper = document.createElement('div');
    saveAllWrapper.className = 'save-all-explanations-wrapper';
    if (!hasEditableOptions()) saveAllWrapper.classList.add('hidden');
    saveAllWrapper.innerHTML =
        '<span class="save-all-status" style="font-size:0.75rem;color:var(--clr-text-secondary)"></span>' +
        '<button type="button" class="save-all-explanations-btn btn btn-primary">Save explanations</button>';
    const saveAllBtn = saveAllWrapper.querySelector('.save-all-explanations-btn');
    const clearAllBtn = card.querySelector('.clear-all-btn');
    const saveAllStatus = saveAllWrapper.querySelector('.save-all-status');
    if (!hasEditableOptions() && clearAllBtn) clearAllBtn.classList.add('hidden');

    function clearExplanationFields() {
        letters.forEach(letter => {
            const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
            const row = optMap[letter];
            const expEl = wrap && wrap.querySelector('.explanation-container');
            if (!expEl || !row || !row.id) return;
            expEl.innerHTML = '';
            expEl.classList.remove('rendered-markdown');
            expEl.appendChild(createOptionExpInput(row, ''));
        });
        card.querySelectorAll('.question-exp-input').forEach(ta => {
            ta.value = '';
        });
        saveAllStatus.textContent = '';
        saveAllStatus.className = 'save-all-status';
    }

    if (clearAllBtn) clearAllBtn.addEventListener('click', clearExplanationFields);
    saveAllBtn.addEventListener('click', async () => {
        function parseTaggedExplanations(text) {
            const result = {};
            if (!text) return result;
            const regex = /\[O([1-4]*)\]\s*([\s\S]*?)(?=\[O[1-4]*\]|\s*$)/g;
            let m;
            while ((m = regex.exec(text)) !== null) {
                const idx = parseInt(m[1], 10);
                const body = (m[2] || '').trim();
                if (idx >= 1 && idx <= 4 && body) {
                    result[idx] = body;
                }
            }
            return result;
        }
        const inputs = card.querySelectorAll('.option-exp-input');
        // If any textarea contains [O1]...[O4] tags, split and distribute them
        let taggedMap = null;
        inputs.forEach(ta => {
            if (taggedMap) return;
            const raw = (ta.value || '');
            if (/\[O[1-4]\]/.test(raw)) {
                taggedMap = parseTaggedExplanations(raw);
            }
        });
        if (taggedMap && Object.keys(taggedMap).length > 0) {
            const distLetters = ['A', 'B', 'C', 'D'];
            distLetters.forEach((letter, i) => {
                if (!taggedMap[i + 1]) return;
                const wrap = card.querySelector('.option-wrapper[data-option-letter="' + letter + '"]');
                const expCont = wrap ? wrap.querySelector('.explanation-container') : null;
                const row = optMap[letter];
                const ta = expCont ? ensureOptionExpInput(expCont, row) : null;
                if (!ta) return;
                ta.value = taggedMap[i + 1];
                ta.style.height = 'auto';
                ta.style.height = Math.max(ta.scrollHeight, 72) + 'px';
            });
        }
        const toSave = [];
        card.querySelectorAll('.option-exp-input').forEach(ta => {
            const raw = (ta.value || '').trim();
            if (raw) toSave.push({ id: ta.getAttribute('data-option-id'), text: raw, textarea: ta });
        });
        if (toSave.length === 0) {
            saveAllStatus.textContent = 'Enter at least one explanation to save.';
            saveAllStatus.className = 'save-all-status status-error';
            return;
        }
        if (!supabase) {
            saveAllStatus.textContent = 'Supabase not configured.';
            saveAllStatus.className = 'save-all-status status-error';
            return;
        }
        saveAllBtn.disabled = true;
        saveAllStatus.textContent = 'Saving...';
        saveAllStatus.className = 'save-all-status status-muted';
        let failed = 0;
        await Promise.all(toSave.map(async ({ id, text, textarea }) => {
            const { error } = await supabase.from('options').update({ explanation: text }).eq('id', id);
            if (error) {
                failed++;
                return;
            }
            const optionLetter = (textarea.closest('.option-wrapper') && textarea.closest('.option-wrapper').querySelector('.explanation-container'))
                ? (textarea.closest('.option-wrapper').querySelector('.explanation-container').getAttribute('data-opt') || '')
                : '';
            if (optionLetter && optMap[optionLetter]) optMap[optionLetter].explanation = text;
            const expContainer = textarea.closest('.option-wrapper').querySelector('.explanation-container');
            if (expContainer && optMap[optionLetter]) {
                mountOptionExplanation(expContainer, optMap[optionLetter]);
            }
        }));
        saveAllBtn.disabled = false;
        if (failed > 0) {
            saveAllStatus.textContent = failed + ' explanation(s) failed to save.';
            saveAllStatus.className = 'save-all-status status-error';
        } else {
            saveAllStatus.textContent = toSave.length === 1 ? '1 explanation saved.' : toSave.length + ' explanations saved.';
            saveAllStatus.className = 'save-all-status status-ok';
            setTimeout(() => { saveAllStatus.textContent = ''; }, 3000);
        }
    });
    card.querySelector('.content-card__body').appendChild(saveAllWrapper);
    card.querySelector('.content-card__body').appendChild(actionsRow);

    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
        if (cardIsEditing) exitInlineEdit();
        else enterInlineEdit();
    });

    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this question? This cannot be undone.')) return;
        if (!supabase) return;

        deleteBtn.disabled = true;
        const { error: optErr } = await supabase.from('options').delete().eq('question_id', question.id);
        if (optErr) { alert('Failed to delete options: ' + optErr.message); deleteBtn.disabled = false; return; }
        const { error: qErr } = await supabase.from('questions').delete().eq('id', question.id);
        if (qErr) { alert('Failed to delete question: ' + qErr.message); deleteBtn.disabled = false; return; }

        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => { card.remove(); if (ctx.onDeleted) ctx.onDeleted(); }, 300);
    });

    return card;
}
