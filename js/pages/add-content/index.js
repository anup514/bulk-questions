/**
 * Add Content page entry point.
 *
 * Creates the editor, wires the toolbar and import buttons, and initialises the
 * theme toggle and paste-list fix.
 */
import { initTheme } from '../../ui/theme.js';
import '../../ui/paste-list-fix.js';
import { createBulkEditor } from './editor.js';
import { wireToolbar } from './toolbar.js';
import { saveBulkQuestions, loadBulkImportFile } from './import.js';

function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
}

ready(() => {
    initTheme();

    const editorHost = document.getElementById('raw-input-editor');
    createBulkEditor(editorHost);

    wireToolbar(document);

    const bulkImportBtn = document.getElementById('bulk-import-btn');
    if (bulkImportBtn) bulkImportBtn.addEventListener('click', saveBulkQuestions);
    const bulkSubmitBtn = document.getElementById('bulk-submit-btn');
    if (bulkSubmitBtn) bulkSubmitBtn.addEventListener('click', saveBulkQuestions);

    if (editorHost) {
        editorHost.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                saveBulkQuestions();
            }
        });
    }

    const loadFileBtn = document.getElementById('bulk-load-file-btn');
    if (loadFileBtn) loadFileBtn.addEventListener('click', loadBulkImportFile);
});
