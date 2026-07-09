/**
 * LaTeX rendering helpers.
 *
 * Extracts `$...$` / `$$...$$` spans from text, renders them with KaTeX (loaded
 * globally as `window.katex`), and restores them into escaped HTML. Falls back
 * to the raw (escaped) source when KaTeX is unavailable or throws.
 */

export function extractLatex(text) {
    const parts = [];
    let counter = 0;
    const PH = '\uFFFDLX';
    let processed = text;
    processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, function (m, latex) {
        const ph = PH + (counter++) + '\uFFFD';
        parts.push({ ph: ph, latex: latex, display: true, original: m });
        return ph;
    });
    processed = processed.replace(/\$([^\$\n]+?)\$/g, function (m, latex) {
        const ph = PH + (counter++) + '\uFFFD';
        parts.push({ ph: ph, latex: latex, display: false, original: m });
        return ph;
    });
    return { text: processed, parts: parts };
}

export function restoreLatex(html, parts) {
    const katex = typeof window !== 'undefined' ? window.katex : undefined;
    for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (typeof katex !== 'undefined') {
            try {
                const rendered = katex.renderToString(part.latex, {
                    displayMode: part.display,
                    throwOnError: false
                });
                const dataAttr = part.original
                    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const cls = part.display ? 'math-display' : 'math-inline';
                html = html.split(part.ph).join(
                    '<span class="' + cls + '" data-latex="' + dataAttr + '">' + rendered + '</span>'
                );
                continue;
            } catch (e) { /* fall through to raw */ }
        }
        html = html.split(part.ph).join(
            part.original.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        );
    }
    return html;
}

/** Renders inline text with LaTeX but no block/list formatting. */
export function renderTextWithLatex(text) {
    if (!text) return '';
    const extracted = extractLatex(text);
    const html = extracted.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return restoreLatex(html, extracted.parts);
}
