/**
 * Parsers for the tagged bulk-import text format.
 *
 * MCQ blocks start with [Q] and may include [O1]-[O4], [E]/[EA]-[ED], [SUB],
 * [TOP], [T] (heading/group), [LEV], [ANS], [END]. A [T] line before [Q]
 * applies to all following questions until the next [T]. Flashcard blocks start
 * with [F] and may include [B] (back) and [E] (explanation).
 */

const MCQ_TAG_RE = /\[(O1|O2|O3|O4|01|02|03|04|E|EA|EB|EC|ED|SUB|TOP|T|LEV|ANS|END)\]/gi;
const MCQ_LINE_TAG_RE = /^\[(O1|O2|O3|O4|01|02|03|04|E|EA|EB|EC|ED|SUB|TOP|T|LEV|ANS|END)\]\s*(.*)$/i;

function splitMcqSections(text) {
    const sections = [];
    let currentHeading = null;
    let currentLines = null;

    for (const line of text.split(/\r?\n/)) {
        const tMatch = line.match(/^\[T\]\s*(.*)$/i);
        if (tMatch) {
            currentHeading = (tMatch[1] || '').trim() || null;
            continue;
        }
        const qMatch = line.match(/^\[Q\]\s*(.*)$/i);
        if (qMatch) {
            if (currentLines) {
                sections.push({ heading: currentHeading, block: currentLines.join('\n') });
            }
            currentLines = [qMatch[1] || ''];
            continue;
        }
        if (currentLines) currentLines.push(line);
    }
    if (currentLines) {
        sections.push({ heading: currentHeading, block: currentLines.join('\n') });
    }
    return sections;
}

function parseMcqBlock(block, inheritedHeading) {
    const levMap = { basic: 'easy', intermediate: 'medium', advanced: 'hard' };
    let stem = '', o1 = '', o2 = '', o3 = '', o4 = '';
    let ea = '', eb = '', ec = '', ed = '', generalE = '';
    let subject = '', topics = [], difficulty = 'medium';
    let heading = inheritedHeading || null;
    let correctLetter = 'A';
    const normalized = block.replace(MCQ_TAG_RE, '\n[$1]');
    const lines = normalized.split(/\r?\n/);
    let currentTag = 'Q';
    let currentContent = [];
    function flush() {
        const s = currentContent.join('\n').trim();
        if (currentTag === 'Q') stem = s;
        else if (currentTag === 'O1') o1 = s;
        else if (currentTag === 'O2') o2 = s;
        else if (currentTag === 'O3') o3 = s;
        else if (currentTag === 'O4') o4 = s;
        else if (currentTag === 'E') generalE = s;
        else if (currentTag === 'EA') ea = s;
        else if (currentTag === 'EB') eb = s;
        else if (currentTag === 'EC') ec = s;
        else if (currentTag === 'ED') ed = s;
        else if (currentTag === 'SUB') subject = s;
        else if (currentTag === 'TOP') topics.push(s);
        else if (currentTag === 'T') heading = s || null;
        else if (currentTag === 'LEV') difficulty = levMap[s.toLowerCase()] || 'medium';
        else if (currentTag === 'ANS') {
            const c = (s || '').trim().charAt(0).toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(c)) correctLetter = c;
        }
        currentContent = [];
    }
    for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        const match = line.match(MCQ_LINE_TAG_RE);
        if (match) {
            flush();
            let tag = (match[1] || '').toUpperCase();
            if (tag === '01') tag = 'O1';
            if (tag === '02') tag = 'O2';
            if (tag === '03') tag = 'O3';
            if (tag === '04') tag = 'O4';
            if (tag === 'END') break;
            currentTag = tag;
            currentContent = [match[2]];
        } else {
            currentContent.push(line);
        }
    }
    flush();
    stem = stem.trim();
    if (!stem) return null;
    const options = [
        { letter: 'A', text: o1.trim(), explanation: (ea || generalE).trim() || null },
        { letter: 'B', text: o2.trim(), explanation: (eb || generalE).trim() || null },
        { letter: 'C', text: o3.trim(), explanation: (ec || generalE).trim() || null },
        { letter: 'D', text: o4.trim(), explanation: (ed || generalE).trim() || null }
    ];
    const letters = ['A', 'B', 'C', 'D'];
    const correctIndex = Math.max(0, letters.indexOf(correctLetter));
    return {
        stem,
        options,
        correctIndex,
        subject: subject.trim() || null,
        topics,
        heading: (heading || '').trim() || null,
        difficulty
    };
}

export function parseBulkRawText(text) {
    const questions = [];
    for (const { heading, block } of splitMcqSections(text)) {
        const q = parseMcqBlock(block.trim(), heading);
        if (q) questions.push(q);
    }
    return questions;
}

export function parseFlashcardRawText(text) {
    const cards = [];
    const blocks = text.split(/\[F\]/i);
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i].trim();
        let front = '', back = '', explanation = '';
        const normalized = block.replace(/\[(B|E|END)\]/gi, '\n[$1]');
        const lines = normalized.split(/\r?\n/);
        let currentTag = 'F';
        let currentContent = [];
        function flush() {
            const s = currentContent.join('\n').trim();
            if (currentTag === 'F') front = s;
            else if (currentTag === 'B') back = s;
            else if (currentTag === 'E') explanation = s;
            currentContent = [];
        }
        for (let j = 0; j < lines.length; j++) {
            const line = lines[j];
            const match = line.match(/^\[(B|E|END)\]\s*(.*)$/i);
            if (match) {
                flush();
                const tag = (match[1] || '').toUpperCase();
                if (tag === 'END') break;
                currentTag = tag;
                currentContent = [match[2] || ''];
            } else {
                currentContent.push(line);
            }
        }
        flush();
        if (!front || !back) continue;
        cards.push({
            front: front.trim(),
            back: back.trim(),
            explanation: explanation.trim() || null
        });
    }
    return cards;
}
