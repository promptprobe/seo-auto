import { buildContentOpportunities, opportunityDates, type OpportunitySnapshot } from '../src/index.js';

// Synthetic observations; no external service or production data is used.
const snapshots: OpportunitySnapshot[] = opportunityDates('2026-09-25', 56).map(date => ({
  date, finalized: true, propertyImpressions: 40,
  queries: [
    { query: 'webhook retries', clicks: 1, impressions: 20, position: 8 },
    { query: 'webhook signing', clicks: 0, impressions: 10, position: 14 },
  ],
  pages: [
    { query: 'webhook retries', page: 'https://example.com/retries', clicks: 1, impressions: 20, position: 8 },
    { query: 'webhook signing', page: 'https://example.com/guides', clicks: 0, impressions: 10, position: 14 },
  ],
}));

const report = buildContentOpportunities({ snapshots, periodEnd: '2026-09-25', asOfDate: '2026-09-28', inventoryComplete: true,
  inventory: [
    { id: 'retries', url: 'https://example.com/retries', title: 'Webhook retries', status: 'published', kind: 'article', queries: ['webhook retries'] },
    { id: 'guides', url: 'https://example.com/guides', title: 'Guides', status: 'published', kind: 'hub', queries: [] },
  ],
});

console.table(report.rows.map(row => ({ query: row.query, action: row.action, score: row.score,
  impressions: row.current.impressions, target: row.target?.url ?? 'review a new brief' })));
