import assert from 'node:assert/strict';
import test from 'node:test';
import { auditContent } from '../src/index.js';
import { exampleBrief, exampleProfile } from './helpers.js';

test('content audit detects a mismatch between a promised list and numbered H2 headings', () => {
  const markdown = `## 1. First step

Use a stable event identifier and record the first delivery attempt. [Guide](/guide).

## 2. Second step

Cap retries and preserve exhausted events for later replay.

## Practical checklist

Review the retry policy before launch.`;
  const result = auditContent({
    brief: exampleBrief,
    profile: { ...exampleProfile, bodyMinChars: 50 },
    title: '3 steps for a reliable webhook retry workflow',
    markdown,
    faq: [
      { question: 'Question one?', answer: 'Answer one.' },
      { question: 'Question two?', answer: 'Answer two.' },
    ],
    metadata: {
      title: '3 steps for a reliable webhook retry workflow',
      description: 'Follow 3 practical steps for safe webhook retries, controlled backoff, and recoverable failures.',
      tags: [],
    },
  });

  assert.equal(result.passed, false);
  assert.ok(result.issues.some((item) => item.code === 'promised_count_mismatch'));
});
