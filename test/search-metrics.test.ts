import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateSearchMetrics, classifyAveragePosition, compareSearchMetrics } from '../src/index.js';

test('search metrics use impression-weighted position and an explicit CTR denominator', () => {
  const totals = aggregateSearchMetrics([
    { clicks: 5, impressions: 100, position: 4 },
    { clicks: 1, impressions: 20, position: 10 },
  ]);

  assert.equal(totals.clicks, 6);
  assert.equal(totals.impressions, 120);
  assert.equal(totals.ctr, 0.05);
  assert.equal(totals.position, 5);
  assert.equal(classifyAveragePosition(totals.position), 'top10');
});

test('metric comparison does not invent a relative change from a zero baseline', () => {
  const comparison = compareSearchMetrics(
    [{ clicks: 2, impressions: 50, position: 8 }],
    [{ clicks: 0, impressions: 0, position: 0 }],
  );

  assert.equal(comparison.absolute.clicks, 2);
  assert.equal(comparison.relative.clicks, null);
  assert.equal(comparison.previous.position, null);
});
