/**
 * Loads the static subject/topic taxonomy from assets/*.json.
 */

export async function loadTaxonomy() {
    const [subjectsResp, topicsResp] = await Promise.all([
        fetch('assets/subjects.json'),
        fetch('assets/topics.json')
    ]);
    if (!subjectsResp.ok || !topicsResp.ok) throw new Error('Failed to load subject/topic data');
    const subjects = await subjectsResp.json();
    const topics = await topicsResp.json();
    return { subjects, topics };
}

export function topicsForSubject(topics, subjectId) {
    if (!subjectId || !Array.isArray(topics) || topics.length === 0) return [];
    return topics.filter(t => t.subject_tag_id === subjectId);
}
