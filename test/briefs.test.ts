import assert from 'node:assert/strict';
import test from 'node:test';
import { selectUnusedBriefs, type ContentBrief } from '../src/index.js';

test('brief selection skips topics already owned by existing content', () => {
  const briefs: ContentBrief[] = [
    { id: 'one', topic: 'Webhook retries', keyword: 'webhook retries', audience: 'developers', intent: 'Webhook retries' },
    { id: 'two', topic: 'API pagination', keyword: 'api pagination', audience: 'developers', intent: 'Learn pagination' },
  ];
  const selected = selectUnusedBriefs(
    briefs,
    [{ id: 'existing', title: 'A guide', primaryIntent: 'Webhook retries' }],
    1,
  );

  assert.deepEqual(selected.map((brief) => brief.id), ['two']);
});
