import { auditContent } from '../audit/content.js';
import { findDuplicateTitle } from '../briefs.js';
import type {
  AuditIssue,
  ContentBrief,
  FaqItem,
  PipelineDependencies,
  PipelineResult,
} from '../types.js';

export class PipelineGateError extends Error {
  readonly stage: 'duplicate' | 'deterministic_audit' | 'quality_review';
  readonly issues: readonly string[];

  constructor(
    stage: PipelineGateError['stage'],
    message: string,
    issues: readonly string[] = [],
  ) {
    super(message);
    this.name = 'PipelineGateError';
    this.stage = stage;
    this.issues = issues;
  }
}

function formatFaqSection(heading: string, faq: readonly FaqItem[]): string {
  const items = faq
    .map((item) => `### ${item.question.trim()}\n\n${item.answer.trim()}`)
    .join('\n\n');
  return `## ${heading}\n\n${items}`;
}

function auditMessages(issues: readonly AuditIssue[]): string[] {
  return issues.map((item) => `${item.code}: ${item.message}`);
}

export function createContentPipeline(dependencies: PipelineDependencies) {
  const { generator, store, profile } = dependencies;
  const now = dependencies.now ?? (() => new Date());

  return {
    async run(brief: ContentBrief): Promise<PipelineResult> {
      const existingContent = await store.listExistingContent();
      const context = { brief, existingContent };
      const title = (await generator.generateTitle(context)).trim();
      const duplicate = findDuplicateTitle(title, existingContent);

      if (duplicate) {
        throw new PipelineGateError(
          'duplicate',
          `Generated title duplicates existing content: ${duplicate.title}`,
          [duplicate.id],
        );
      }

      const body = (await generator.generateBody({ ...context, title })).trim();
      const faq = await generator.generateFaq({ ...context, title, body });
      const markdown = `${body}\n\n${formatFaqSection(profile.faqHeading, faq)}`.trim();
      const metadata = await generator.generateMetadata({ ...context, title, body, faq });
      const audit = auditContent({ brief, profile, title, markdown, faq, metadata });

      if (!audit.passed) {
        throw new PipelineGateError(
          'deterministic_audit',
          'Draft failed deterministic content checks.',
          auditMessages(audit.issues),
        );
      }

      const qualityReview = generator.reviewDraft
        ? await generator.reviewDraft({ ...context, title, markdown, faq, metadata })
        : null;

      if (
        qualityReview
        && (
          !qualityReview.pass
          || qualityReview.score < profile.qualityThreshold
          || qualityReview.unsupportedClaims.length > 0
          || qualityReview.overlapRisk === 'high'
        )
      ) {
        throw new PipelineGateError(
          'quality_review',
          'Draft failed the quality review gate.',
          [
            ...qualityReview.issues,
            ...qualityReview.unsupportedClaims.map((claim) => `Unsupported claim: ${claim}`),
          ],
        );
      }

      const draft = {
        briefId: brief.id,
        title,
        markdown,
        faq,
        metadata,
        status: 'review_required' as const,
        createdAt: now().toISOString(),
        audit,
        qualityReview,
      };
      const storedDraft = await store.saveDraft(draft);
      return { storedDraft, draft };
    },
  };
}
