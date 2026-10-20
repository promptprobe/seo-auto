import type { OpportunityReport } from '../../src/index.js';

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

export function reviewOutputs(report: OpportunityReport, locale: string) {
  const briefs = report.rows.map(row => ({
    status: 'review_required', locale, query: row.query, action: row.action, score: row.score,
    target: row.target?.url ?? null, period: report.period, evidence: row.current,
    nextStep: row.score === null ? 'Collect more finalized observations before ranking this work.'
      : row.action === 'improve' ? 'Review the existing page and its intent before editing.'
      : row.action === 'create' ? 'Check intent, sources and existing drafts; write an outline for human review.'
      : 'Review ownership, drafts or missing evidence before creating content.',
  }));
  const candidate = report.rows.find(row => row.action === 'create' && row.score !== null);
  const wordpressDraft = candidate ? {
    status: 'draft',
    title: candidate.query,
    content: `<p><strong>Review outline — not a finished article.</strong></p><h2>${escapeHtml(candidate.query)}</h2>`
      + '<p>TODO: define the reader question, verify sources, and write the article before publication.</p>',
  } : null;
  return { briefs, wordpressDraft };
}
