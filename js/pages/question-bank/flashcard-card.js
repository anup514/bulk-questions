/**
 * Renders a single flashcard card with inline edit / explanation / delete.
 */
import { supabase } from '../../lib/supabase.js';
import { renderTextWithLatex } from '../../render/latex.js';

export function renderFlashcardCard(card, idx) {
    const explanationText = (card.explanation || card.explaination || '').trim();
    const wrap = document.createElement('div');
    wrap.className = 'content-card';
    wrap.innerHTML =
        '<div class="content-card__body" style="display:flex;flex-direction:column;gap:1rem">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">' +
                '<span class="badge badge-neutral">Card ' + idx + '</span>' +
                '<div class="card-actions">' +
                    '<button type="button" class="flashcard-edit-btn edit" title="Edit"><span class="material-symbols-outlined" style="font-size:1.125rem">edit</span></button>' +
                    '<button type="button" class="flashcard-delete-btn danger" title="Delete"><span class="material-symbols-outlined" style="font-size:1.125rem">delete</span></button>' +
                '</div>' +
            '</div>' +
            '<div>' +
                '<div style="font-size:0.6875rem;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;color:var(--clr-text-tertiary);margin-bottom:0.25rem">Front</div>' +
                '<div class="flashcard-front-view" style="font-size:0.875rem;line-height:1.6;white-space:pre-wrap;word-break:break-word">' + renderTextWithLatex(card.front || '') + '</div>' +
                '<textarea class="flashcard-front-input field-input hidden" style="min-height:4rem"></textarea>' +
            '</div>' +
            '<div>' +
                '<div style="font-size:0.6875rem;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;color:var(--clr-text-tertiary);margin-bottom:0.25rem">Back</div>' +
                '<div class="flashcard-back-view" style="font-size:0.875rem;line-height:1.6;white-space:pre-wrap;word-break:break-word">' + renderTextWithLatex(card.back || '') + '</div>' +
                '<textarea class="flashcard-back-input field-input hidden" style="min-height:4rem"></textarea>' +
            '</div>' +
            '<div>' +
                '<div style="font-size:0.6875rem;font-weight:500;text-transform:uppercase;letter-spacing:0.04em;color:var(--clr-text-tertiary);margin-bottom:0.25rem">Explanation</div>' +
                '<textarea class="flashcard-explanation-input field-input" style="min-height:4.5rem" placeholder="Add explanation…"></textarea>' +
                '<div style="margin-top:0.5rem;display:flex;align-items:center;gap:0.5rem">' +
                    '<button type="button" class="flashcard-save-explanation-btn btn btn-primary">Save</button>' +
                    '<span class="flashcard-save-status" style="font-size:0.75rem;color:var(--clr-text-secondary)"></span>' +
                '</div>' +
                '<textarea class="flashcard-explanation-edit-input field-input hidden" style="margin-top:0.5rem;min-height:4.5rem"></textarea>' +
            '</div>' +
            '<div class="flashcard-edit-actions hidden" style="display:none;gap:0.5rem">' +
                '<button type="button" class="flashcard-save-edit-btn btn btn-primary">Save changes</button>' +
                '<button type="button" class="flashcard-cancel-edit-btn btn btn-ghost">Cancel</button>' +
            '</div>' +
        '</div>';

    const frontInput = wrap.querySelector('.flashcard-front-input');
    const backInput = wrap.querySelector('.flashcard-back-input');
    const frontView = wrap.querySelector('.flashcard-front-view');
    const backView = wrap.querySelector('.flashcard-back-view');
    const expInput = wrap.querySelector('.flashcard-explanation-input');
    const expEditInput = wrap.querySelector('.flashcard-explanation-edit-input');
    const saveExpBtn = wrap.querySelector('.flashcard-save-explanation-btn');
    const saveStatus = wrap.querySelector('.flashcard-save-status');
    const editBtn = wrap.querySelector('.flashcard-edit-btn');
    const deleteBtn = wrap.querySelector('.flashcard-delete-btn');
    const editActions = wrap.querySelector('.flashcard-edit-actions');
    const saveEditBtn = wrap.querySelector('.flashcard-save-edit-btn');
    const cancelEditBtn = wrap.querySelector('.flashcard-cancel-edit-btn');

    expInput.value = explanationText;
    expEditInput.value = explanationText;
    frontInput.value = card.front || '';
    backInput.value = card.back || '';

    saveExpBtn.addEventListener('click', async () => {
        if (!supabase) return;
        saveExpBtn.disabled = true;
        saveStatus.textContent = 'Saving...';
        const nextExplanation = (expInput.value || '').trim();
        const { error } = await supabase
            .from('flashcards')
            .update({ explanation: nextExplanation || null })
            .eq('id', card.id);
        saveExpBtn.disabled = false;
        if (error) {
            saveStatus.textContent = 'Failed to save';
            saveStatus.className = 'flashcard-save-status status-error';
        } else {
            card.explanation = nextExplanation || null;
            saveStatus.textContent = 'Saved';
            saveStatus.className = 'flashcard-save-status status-success';
            expEditInput.value = nextExplanation;
            setTimeout(() => {
                if (saveStatus.textContent === 'Saved') saveStatus.textContent = '';
            }, 1200);
        }
    });

    editBtn.addEventListener('click', () => {
        frontView.classList.add('hidden');
        backView.classList.add('hidden');
        frontInput.classList.remove('hidden');
        backInput.classList.remove('hidden');
        expInput.classList.add('hidden');
        saveExpBtn.classList.add('hidden');
        expEditInput.classList.remove('hidden');
        editActions.classList.remove('hidden');
        editActions.style.display = 'flex';
        frontInput.focus();
    });

    cancelEditBtn.addEventListener('click', () => {
        frontInput.value = card.front || '';
        backInput.value = card.back || '';
        expEditInput.value = (card.explanation || card.explaination || '').trim();
        frontInput.classList.add('hidden');
        backInput.classList.add('hidden');
        frontView.classList.remove('hidden');
        backView.classList.remove('hidden');
        expEditInput.classList.add('hidden');
        expInput.classList.remove('hidden');
        saveExpBtn.classList.remove('hidden');
        editActions.classList.add('hidden');
        editActions.style.display = 'none';
    });

    saveEditBtn.addEventListener('click', async () => {
        if (!supabase) return;
        saveEditBtn.disabled = true;
        const nextFront = (frontInput.value || '').trim();
        const nextBack = (backInput.value || '').trim();
        const nextExp = (expEditInput.value || '').trim();
        if (!nextFront || !nextBack) {
            alert('Front and Back cannot be empty.');
            saveEditBtn.disabled = false;
            return;
        }
        const { error } = await supabase
            .from('flashcards')
            .update({
                front: nextFront,
                back: nextBack,
                explanation: nextExp || null
            })
            .eq('id', card.id);
        saveEditBtn.disabled = false;
        if (error) {
            alert('Failed to save flashcard: ' + (error.message || JSON.stringify(error)));
            return;
        }
        card.front = nextFront;
        card.back = nextBack;
        card.explanation = nextExp || null;
        frontView.innerHTML = renderTextWithLatex(card.front);
        backView.innerHTML = renderTextWithLatex(card.back);
        expInput.value = nextExp;
        saveStatus.textContent = 'Saved';
        saveStatus.className = 'flashcard-save-status status-success';
        cancelEditBtn.click();
    });

    deleteBtn.addEventListener('click', async () => {
        if (!supabase) return;
        if (!confirm('Delete this flashcard permanently?')) return;
        deleteBtn.disabled = true;
        const { error } = await supabase.from('flashcards').delete().eq('id', card.id);
        if (error) {
            deleteBtn.disabled = false;
            alert('Failed to delete flashcard: ' + (error.message || JSON.stringify(error)));
            return;
        }
        wrap.remove();
    });

    return wrap;
}
