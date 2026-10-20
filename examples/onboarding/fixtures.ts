import { opportunityDates, type OpportunityInput } from '../../src/index.js';

// Invented observations, with different languages and no geographic filter.
export function demoInput(): OpportunityInput {
  return {
    asOfDate: '2026-09-28', periodEnd: '2026-09-25', inventoryComplete: true,
    snapshots: opportunityDates('2026-09-25', 56).map(date => ({
      date, finalized: true, propertyImpressions: 60,
      queries: [
        { query: 'webhook retries', clicks: 1, impressions: 20, position: 8 },
        { query: 'firmar webhooks', clicks: 0, impressions: 12, position: 14 },
        { query: 'ウェブフック 再試行', clicks: 0, impressions: 8, position: 9 },
      ],
      pages: [
        { query: 'webhook retries', page: 'https://example.com/retries/', clicks: 1, impressions: 20, position: 8 },
        { query: 'firmar webhooks', page: 'https://example.com/guides/', clicks: 0, impressions: 12, position: 14 },
        { query: 'ウェブフック 再試行', page: 'https://example.com/guides/', clicks: 0, impressions: 8, position: 9 },
      ],
    })),
    inventory: [
      { id: 'posts:1', url: 'https://example.com/retries/', title: 'Webhook retries', status: 'published', kind: 'article', queries: [] },
      { id: 'pages:2', url: 'https://example.com/guides/', title: 'Guides', status: 'published', kind: 'hub', queries: [] },
      { id: 'posts:3', url: 'https://example.com/?p=3', title: 'ウェブフック 再試行', status: 'draft', kind: 'article', queries: ['ウェブフック 再試行'] },
    ],
  };
}
