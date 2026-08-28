import assert from 'node:assert/strict';
import test from 'node:test';
import { createContentPipeline, PipelineGateError } from '../src/index.js';
import { exampleBrief, exampleProfile, MemoryDraftStore, validGenerator } from './helpers.js';

test('the pipeline stores a review-required draft after both gates pass', async () => {
  const store = new MemoryDraftStore();
  const pipeline = createContentPipeline({
    generator: validGenerator(),
    store,
    profile: exampleProfile,
    now: () => new Date('2026-08-28T12:00:00.000Z'),
  });

  const result = await pipeline.run(exampleBrief);

  assert.equal(result.storedDraft.id, 'draft-1');
  assert.equal(result.draft.status, 'review_required');
  assert.equal(result.draft.createdAt, '2026-08-28T12:00:00.000Z');
  assert.equal(result.draft.audit.passed, true);
  assert.equal(result.draft.qualityReview?.score, 92);
  assert.equal(store.drafts.length, 1);
});

test('the pipeline rejects deterministic rule violations without saving', async () => {
  const store = new MemoryDraftStore();
  const generator = validGenerator({
    async generateBody() {
      return `## Practical checklist\n\nThis page promises a guaranteed ranking. [Read more](/guide).`;
    },
  });
  const pipeline = createContentPipeline({ generator, store, profile: exampleProfile });

  await assert.rejects(
    pipeline.run(exampleBrief),
    (error: unknown) => {
      assert.ok(error instanceof PipelineGateError);
      assert.equal(error.stage, 'deterministic_audit');
      assert.ok(error.issues.some((message) => message.includes('forbidden_pattern')));
      return true;
    },
  );
  assert.equal(store.drafts.length, 0);
});

test('the pipeline rejects an exact existing title before body generation', async () => {
  const store = new MemoryDraftStore([{ id: 'existing-1', title: 'Reliable webhook retry patterns for production APIs' }]);
  let generatedBody = false;
  const generator = validGenerator({
    async generateBody() {
      generatedBody = true;
      return 'should not run';
    },
  });
  const pipeline = createContentPipeline({ generator, store, profile: exampleProfile });

  await assert.rejects(
    pipeline.run(exampleBrief),
    (error: unknown) => error instanceof PipelineGateError && error.stage === 'duplicate',
  );
  assert.equal(generatedBody, false);
  assert.equal(store.drafts.length, 0);
});

test('the pipeline rejects a failed optional quality review', async () => {
  const store = new MemoryDraftStore();
  const generator = validGenerator({
    async reviewDraft() {
      return {
        pass: false,
        score: 70,
        issues: ['The draft overlaps an existing page.'],
        unsupportedClaims: [],
        overlapRisk: 'high',
      };
    },
  });
  const pipeline = createContentPipeline({ generator, store, profile: exampleProfile });

  await assert.rejects(
    pipeline.run(exampleBrief),
    (error: unknown) => error instanceof PipelineGateError && error.stage === 'quality_review',
  );
  assert.equal(store.drafts.length, 0);
});
