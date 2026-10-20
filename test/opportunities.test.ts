import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContentOpportunities, type OpportunityInput, type OpportunitySnapshot } from '../src/metrics/opportunities.js';

function input(): OpportunityInput {
  const snapshots: OpportunitySnapshot[] = Array.from({ length: 56 }, (_, i) => {
    const date = new Date('2026-08-01T00:00:00Z'); date.setUTCDate(date.getUTCDate() + i);
    return {
      date: date.toISOString().slice(0, 10), finalized: true, propertyImpressions: 30,
      queries: [{ query: 'webhook retry', clicks: 1, impressions: 20, position: 8 }],
      pages: [{ query: 'webhook retry', page: 'https://example.com/guides/retries', clicks: 1, impressions: 20, position: 8 }],
    };
  });
  return { snapshots, periodEnd: '2026-09-25', asOfDate: '2026-09-28', inventoryComplete: true,
    inventory: [{ id: 'retry', url: 'https://example.com/guides/retries', title: 'Retries', status: 'published', kind: 'article', queries: [] }] };
}

test('observed query metrics drive a bounded score and an existing article improvement', () => {
  const report = buildContentOpportunities(input()); const row = report.rows[0]!;
  assert.equal(row.action, 'improve'); assert.equal(row.target?.id, 'retry');
  assert.equal(row.current.impressions, 560); assert.equal(row.current.clicks, 28);
  assert.equal(row.current.ctr, 0.05); assert.equal(row.current.position, 8);
  assert.ok(row.score !== null && row.score >= 0 && row.score <= 100);
  assert.equal(report.coverage.queryImpressions, 560);
  assert.equal(report.coverage.propertyImpressions, 840);
  assert.equal(row.previous?.impressions, 560); assert.equal(row.impressionChange, 0);
});

test('page rows are attribution only and never inflate property-level query demand', () => {
  const data = input();
  data.snapshots.forEach(s => s.pages!.push({ ...s.pages![0]!, page: 'https://example.com/' }));
  const row = buildContentOpportunities(data).rows[0]!;
  assert.equal(row.current.impressions, 560); assert.equal(row.action, 'improve');
});

test('new articles require observed non-article landings and complete inventory', () => {
  const data = input(); data.inventory[0]!.kind = 'hub';
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'create');
  data.inventoryComplete = false;
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'investigate');
});

test('missing query-page evidence or unknown URLs never prove a content gap', () => {
  const data = input(); data.snapshots.forEach(s => { s.pages = []; });
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'investigate');
  data.snapshots.forEach(s => { s.pages = [{ query: 'webhook retry', page: 'https://other.test/unknown', clicks: 1, impressions: 20, position: 8 }]; });
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'investigate');
});

test('known draft ownership avoids creating another article', () => {
  const data = input(); data.inventory[0]!.status = 'draft'; data.inventory[0]!.queries = ['webhook retry'];
  data.snapshots.forEach(s => { s.pages = []; });
  const row = buildContentOpportunities(data).rows[0]!;
  assert.equal(row.action, 'review_draft'); assert.equal(row.target?.id, 'retry');
});

test('multiple article owners produce an overlap review, not an automatic merge or new article', () => {
  const data = input(); data.inventory.push({ ...data.inventory[0]!, id: 'other', url: 'https://example.com/other', queries: ['webhook retry'] });
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'review_overlap');
});

test('missing, stale and small-sample data do not get a fabricated numeric score', () => {
  const data = input(); data.snapshots.pop();
  assert.equal(buildContentOpportunities(data).rows[0]!.score, null);
  assert.equal(buildContentOpportunities(data).status, 'incomplete');
  const stale = input(); stale.asOfDate = '2026-10-10';
  assert.equal(buildContentOpportunities(stale).status, 'stale');
  assert.equal(buildContentOpportunities(stale).rows[0]!.score, null);
  const small = input(); small.snapshots.forEach(s => { s.queries![0]!.impressions = 1; s.queries![0]!.clicks = 0; });
  small.snapshots.slice(-26).forEach(s => { s.queries = []; });
  assert.equal(buildContentOpportunities(small).rows[0]!.score, null);
});

test('missing prior query rows are unknown, not zero or infinite growth', () => {
  const data = input(); data.snapshots.slice(0, 28).forEach(s => { s.queries = []; });
  const row = buildContentOpportunities(data).rows[0]!;
  assert.equal(row.previous, null); assert.equal(row.impressionChange, null);
});

test('duplicate dates fail closed instead of silently double-counting or overwriting', () => {
  const data = input(); data.snapshots.push(data.snapshots.at(-1)!);
  const report = buildContentOpportunities(data);
  assert.equal(report.status, 'incomplete'); assert.equal(report.rows[0]!.score, null);
});

test('invalid metrics and missing page dimensions cannot become scored work', () => {
  const data = input(); data.snapshots.at(-1)!.queries![0]!.impressions = NaN;
  assert.equal(buildContentOpportunities(data).status, 'incomplete');
  const missing = input(); missing.snapshots.at(-1)!.pages = null;
  assert.equal(buildContentOpportunities(missing).rows[0]!.score, null);
});

test('CTR benchmark uses other observed queries in the same position band', () => {
  const data = input();
  data.snapshots.forEach(s => {
    s.propertyImpressions = 300;
    for (let i = 0; i < 5; i++) s.queries!.push({ query: `peer ${i}`, impressions: 40, clicks: 4, position: 8 });
  });
  const row = buildContentOpportunities(data).rows.find(r => r.query === 'webhook retry')!;
  assert.equal(row.ctrBenchmark?.ctr, 0.1); assert.equal(row.ctrBenchmark?.queries, 5);
  assert.equal(row.components.find(c => c.id === 'ctr_gap')!.available, true);
  assert.equal(row.components.reduce((sum, c) => sum + c.weight, 0), 100);
});

test('empty data and invalid periods stay explicit', () => {
  const data = input(); data.snapshots = []; data.periodEnd = null;
  assert.equal(buildContentOpportunities(data).status, 'unavailable');
  assert.throws(() => buildContentOpportunities({ ...input(), periodEnd: '2026-02-30' }), /date/i);
});

test('an explicitly assigned hub is improved instead of competing with a new article', () => {
  const data = input(); data.inventory[0]!.kind = 'hub'; data.inventory[0]!.queries = ['webhook retry'];
  assert.equal(buildContentOpportunities(data).rows[0]!.action, 'improve');
});

test('query filtering applies to both demand and CTR peers', () => {
  const data = input();
  data.snapshots.forEach(s => {
    s.propertyImpressions = 300;
    for (let i = 0; i < 5; i++) s.queries!.push({ query: `brand ${i}`, impressions: 40, clicks: 4, position: 8 });
  });
  data.options = { includeQuery: query => !query.startsWith('brand') };
  const report = buildContentOpportunities(data);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0]!.ctrBenchmark, null);
  assert.equal(report.rows[0]!.score, 100);
});

test('a daily scope mismatch is not hidden by larger property totals on other days', () => {
  const data = input();
  data.snapshots.at(-1)!.propertyImpressions = 1;
  const report = buildContentOpportunities(data);
  assert.equal(report.status, 'incomplete');
  assert.equal(report.rows[0]!.score, null);
});

test('different daily positions are weighted by observed impressions', () => {
  const data = input();
  data.snapshots.at(-1)!.queries = [{ query: 'webhook retry', impressions: 10, clicks: 0, position: 20 }];
  const row = buildContentOpportunities(data).rows[0]!;
  assert.equal(row.current.position, (27 * 20 * 8 + 10 * 20) / 550);
  assert.equal(row.current.ctr, 27 / 550);
});
