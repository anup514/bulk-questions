/**
 * Lightweight markdown renderer for question/answer/explanation bodies.
 *
 * Supports inline bold/italic, ordered/unordered nested lists, paragraphs, and
 * inline/display LaTeX (delegated to render/latex.js). Output is escaped HTML
 * intended for a `.rendered-markdown` container.
 */
import { extractLatex, restoreLatex } from './latex.js';

export function formatInlineMarkdown(str) {
    if (!str) return '';
    return str
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function detectListIndentUnit(lines) {
    const indents = [];
    for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^(\s*)(?:(?:\d+)\.|[-*])\s+/);
        if (match && match[1].length > 0) indents.push(match[1].length);
    }
    if (indents.length === 0) return 2;
    const min = Math.min.apply(null, indents);
    return min <= 2 ? 2 : min;
}

function parseFormattedLine(line, indentUnit) {
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);
    if (olMatch) {
        return {
            type: 'ol',
            depth: Math.floor(olMatch[1].replace(/\t/g, '  ').length / indentUnit),
            num: olMatch[2],
            content: olMatch[3]
        };
    }
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (ulMatch) {
        return {
            type: 'ul',
            depth: Math.floor(ulMatch[1].replace(/\t/g, '  ').length / indentUnit),
            content: ulMatch[2]
        };
    }
    const trimmed = line.trim();
    if (trimmed === '') return { type: 'blank' };
    return { type: 'p', content: trimmed };
}

function normalizeListDepths(parsed) {
    let minDepth = Infinity;
    for (let i = 0; i < parsed.length; i++) {
        const line = parsed[i];
        if (line.type === 'ol' || line.type === 'ul') {
            if (line.depth < minDepth) minDepth = line.depth;
        }
    }
    if (!isFinite(minDepth) || minDepth === 0) return parsed;
    return parsed.map(function (line) {
        if (line.type !== 'ol' && line.type !== 'ul') return line;
        return { type: line.type, depth: line.depth - minDepth, num: line.num, content: line.content };
    });
}

function renderListBlock(parsed, startIdx, baseDepth) {
    let html = '<div class="fmt-list">';
    let i = startIdx;
    while (i < parsed.length) {
        const line = parsed[i];
        if (line.type === 'p' || line.type === 'blank') break;
        if (line.depth < baseDepth) break;
        if (line.depth > baseDepth) break;

        if (line.type === 'ol') {
            html += '<div class="fmt-list-item"><span class="fmt-list-num">' + line.num + '.</span><span>';
        } else {
            html += '<div class="fmt-list-item"><span class="fmt-bullet">&bull;</span><span>';
        }
        if (line.content) html += formatInlineMarkdown(line.content);
        i++;
        if (i < parsed.length && (parsed[i].type === 'ol' || parsed[i].type === 'ul') && parsed[i].depth > baseDepth) {
            const nested = renderListBlock(parsed, i, baseDepth + 1);
            html += nested.html;
            i = nested.nextIdx;
        }
        html += '</span></div>';
    }
    html += '</div>';
    return { html: html, nextIdx: i };
}

export function renderFormattedText(text) {
    if (!text) return '';
    const extracted = extractLatex(text);
    const escaped = extracted.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = escaped.split(/\n/);
    const indentUnit = detectListIndentUnit(lines);
    const parsed = normalizeListDepths(lines.map(function (line) {
        return parseFormattedLine(line, indentUnit);
    }));
    let html = '';
    let i = 0;

    while (i < parsed.length) {
        const line = parsed[i];
        if (line.type === 'blank') {
            i++;
            continue;
        }
        if (line.type === 'p') {
            html += '<div class="fmt-p">' + formatInlineMarkdown(line.content) + '</div>';
            i++;
            continue;
        }
        const block = renderListBlock(parsed, i, 0);
        if (block.nextIdx === i) {
            html += '<div class="fmt-p">' + formatInlineMarkdown(line.content || '') + '</div>';
            i++;
            continue;
        }
        html += block.html;
        i = block.nextIdx;
    }
    return restoreLatex(html, extracted.parts);
}
