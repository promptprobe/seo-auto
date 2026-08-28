export interface SourceReference {
  title: string;
  url: string;
  checkedAt?: string;
  notes?: string;
}

export interface ContentBrief {
  id: string;
  topic: string;
  keyword: string;
  audience: string;
  intent: string;
  angle?: string;
  requiredPoints?: readonly string[];
  excludedPoints?: readonly string[];
  sources?: readonly SourceReference[];
  internalLinks?: readonly string[];
  locale?: string;
}

export interface ExistingContent {
  id: string;
  title: string;
  slug?: string;
  primaryIntent?: string;
  outline?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SeoMetadataDraft {
  title: string;
  description: string;
  tags: readonly string[];
}

export interface NamedPattern {
  name: string;
  pattern: RegExp;
}

export interface ContentProfile {
  name: string;
  titleMinChars: number;
  titleMaxChars: number;
  bodyMinChars: number;
  minH2Count: number;
  minFaqCount: number;
  minInternalLinks: number;
  minSources: number;
  metaTitleMinChars: number;
  metaTitleMaxChars: number;
  metaDescriptionMinChars: number;
  metaDescriptionMaxChars: number;
  qualityThreshold: number;
  faqHeading: string;
  forbiddenPatterns: readonly NamedPattern[];
  requiredPatterns: readonly NamedPattern[];
}

export interface AuditIssue {
  code: string;
  message: string;
  path?: 'brief' | 'title' | 'body' | 'faq' | 'metadata';
}

export interface AuditResult {
  passed: boolean;
  issues: readonly AuditIssue[];
}

export interface QualityReview {
  pass: boolean;
  score: number;
  issues: readonly string[];
  unsupportedClaims: readonly string[];
  overlapRisk: 'low' | 'medium' | 'high';
}

export interface GenerationContext {
  brief: ContentBrief;
  existingContent: readonly ExistingContent[];
}

export interface ContentGenerator {
  generateTitle(context: GenerationContext): Promise<string>;
  generateBody(context: GenerationContext & { title: string }): Promise<string>;
  generateFaq(
    context: GenerationContext & { title: string; body: string },
  ): Promise<readonly FaqItem[]>;
  generateMetadata(
    context: GenerationContext & {
      title: string;
      body: string;
      faq: readonly FaqItem[];
    },
  ): Promise<SeoMetadataDraft>;
  reviewDraft?(
    context: GenerationContext & {
      title: string;
      markdown: string;
      faq: readonly FaqItem[];
      metadata: SeoMetadataDraft;
    },
  ): Promise<QualityReview>;
}

export interface DraftRecord {
  briefId: string;
  title: string;
  markdown: string;
  faq: readonly FaqItem[];
  metadata: SeoMetadataDraft;
  status: 'review_required';
  createdAt: string;
  audit: AuditResult;
  qualityReview: QualityReview | null;
}

export interface StoredDraft {
  id: string;
}

export interface DraftStore {
  listExistingContent(): Promise<readonly ExistingContent[]>;
  saveDraft(record: DraftRecord): Promise<StoredDraft>;
}

export interface PipelineDependencies {
  generator: ContentGenerator;
  store: DraftStore;
  profile: ContentProfile;
  now?: () => Date;
}

export interface PipelineResult {
  storedDraft: StoredDraft;
  draft: DraftRecord;
}
