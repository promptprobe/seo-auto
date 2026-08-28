import {
  createContentPipeline,
  defineContentProfile,
  type ContentGenerator,
  type DraftRecord,
  type DraftStore,
} from '../src/index.js';

const generator: ContentGenerator = {
  async generateTitle() {
    return 'Reliable webhook retry patterns for production APIs';
  },
  async generateBody() {
    return `## Define retry boundaries

Retry only failures that can recover. Use bounded exponential backoff and make every request idempotent. The [idempotency guide](/guides/idempotency) explains how repeated deliveries can remain safe.

## Practical checklist

Record attempt counts, preserve the original event identifier, and send exhausted events to a dead-letter queue. Operators should be able to replay an event after correcting the underlying problem.`;
  },
  async generateFaq() {
    return [
      { question: 'Which failures should be retried?', answer: 'Retry transient failures and rate limits, not permanent validation errors.' },
      { question: 'Why is idempotency required?', answer: 'It prevents repeated deliveries from applying the same business action twice.' },
    ];
  },
  async generateMetadata() {
    return {
      title: 'Reliable webhook retry patterns for production APIs',
      description: 'Design safe webhook retries with idempotency, bounded backoff, observability, and a recoverable dead-letter workflow.',
      tags: ['webhooks', 'retries', 'api reliability'],
    };
  },
  async reviewDraft() {
    return { pass: true, score: 92, issues: [], unsupportedClaims: [], overlapRisk: 'low' };
  },
};

class MemoryStore implements DraftStore {
  drafts: DraftRecord[] = [];

  async listExistingContent() {
    return [];
  }

  async saveDraft(draft: DraftRecord) {
    this.drafts.push(draft);
    return { id: `draft-${this.drafts.length}` };
  }
}

const profile = defineContentProfile({
  name: 'developer-education',
  bodyMinChars: 180,
  minH2Count: 2,
  minFaqCount: 2,
  metaDescriptionMinChars: 40,
  requiredPatterns: [{ name: 'practical checklist', pattern: /^## Practical checklist$/m }],
  forbiddenPatterns: [{ name: 'guaranteed ranking claim', pattern: /guaranteed\s+(?:rank|ranking)/i }],
});

const store = new MemoryStore();
const pipeline = createContentPipeline({ generator, store, profile });
const result = await pipeline.run({
  id: 'webhook-retries',
  topic: 'Reliable webhook retries',
  keyword: 'webhook retry strategy',
  audience: 'API developers',
  intent: 'learn how to retry failed webhooks safely',
  sources: [{ title: 'HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' }],
  internalLinks: ['/guides/idempotency'],
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
