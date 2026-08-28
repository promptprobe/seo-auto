import {
  defineContentProfile,
  type ContentBrief,
  type ContentGenerator,
  type DraftRecord,
  type DraftStore,
  type ExistingContent,
} from '../src/index.js';

export const exampleBrief: ContentBrief = {
  id: 'brief-webhook-retries',
  topic: 'Reliable webhook retries',
  keyword: 'webhook retry strategy',
  audience: 'API developers',
  intent: 'learn how to retry failed webhooks safely',
  requiredPoints: ['idempotency', 'backoff', 'dead-letter handling'],
  excludedPoints: ['vendor-specific claims'],
  sources: [{ title: 'HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' }],
  internalLinks: ['/guides/idempotency'],
  locale: 'en-US',
};

export const exampleProfile = defineContentProfile({
  name: 'developer-education',
  titleMinChars: 15,
  titleMaxChars: 70,
  bodyMinChars: 180,
  minH2Count: 2,
  minFaqCount: 2,
  minInternalLinks: 1,
  minSources: 1,
  metaTitleMinChars: 15,
  metaTitleMaxChars: 70,
  metaDescriptionMinChars: 40,
  metaDescriptionMaxChars: 170,
  qualityThreshold: 85,
  faqHeading: 'Frequently asked questions',
  forbiddenPatterns: [{ name: 'guaranteed ranking claim', pattern: /guaranteed\s+(?:rank|ranking)/i }],
  requiredPatterns: [{ name: 'practical checklist', pattern: /^## Practical checklist$/m }],
});

export function validGenerator(overrides: Partial<ContentGenerator> = {}): ContentGenerator {
  return {
    async generateTitle() {
      return 'Reliable webhook retry patterns for production APIs';
    },
    async generateBody() {
      return `## Define retry boundaries

Retry only failures that can recover. Use exponential backoff, cap the retry window, and make every request idempotent. The [idempotency guide](/guides/idempotency) explains how to keep repeated deliveries safe.

## Practical checklist

Record attempt counts, preserve the original event identifier, and send exhausted events to a dead-letter queue. Operators should be able to replay an event after correcting the underlying problem.`;
    },
    async generateFaq() {
      return [
        { question: 'Which failures should be retried?', answer: 'Retry transient failures and rate limits, not permanent validation errors.' },
        { question: 'Why is idempotency required?', answer: 'It keeps repeated deliveries from applying the same business action twice.' },
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
    ...overrides,
  };
}

export class MemoryDraftStore implements DraftStore {
  readonly drafts: DraftRecord[] = [];

  constructor(readonly existing: readonly ExistingContent[] = []) {}

  async listExistingContent(): Promise<readonly ExistingContent[]> {
    return this.existing;
  }

  async saveDraft(record: DraftRecord): Promise<{ id: string }> {
    this.drafts.push(record);
    return { id: `draft-${this.drafts.length}` };
  }
}
