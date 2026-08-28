import { markdownH2Headings, promisedListCount } from '../normalize.js';
import type {
  AuditIssue,
  AuditResult,
  ContentBrief,
  ContentProfile,
  FaqItem,
  NamedPattern,
  SeoMetadataDraft,
} from '../types.js';

export interface ContentAuditInput {
  brief: ContentBrief;
  profile: ContentProfile;
  title: string;
  markdown: string;
  faq: readonly FaqItem[];
  metadata: SeoMetadataDraft;
}

function patternMatches(pattern: RegExp, value: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function issue(
  code: string,
  message: string,
  path: Exclude<AuditIssue['path'], undefined>,
): AuditIssue {
  return { code, message, path };
}

function checkPatterns(
  value: string,
  patterns: readonly NamedPattern[],
  mode: 'forbidden' | 'required',
): AuditIssue[] {
  return patterns.flatMap(({ name, pattern }) => {
    const matches = patternMatches(pattern, value);
    const invalid = mode === 'forbidden' ? matches : !matches;
    if (!invalid) return [];
    return [issue(
      mode === 'forbidden' ? 'forbidden_pattern' : 'required_pattern',
      mode === 'forbidden' ? `Forbidden pattern found: ${name}` : `Required pattern missing: ${name}`,
      'body',
    )];
  });
}

export function auditContent(input: ContentAuditInput): AuditResult {
  const { brief, profile, title, markdown, faq, metadata } = input;
  const issues: AuditIssue[] = [];
  const h2Headings = markdownH2Headings(markdown);
  const internalLinks = markdown.match(/\[[^\]]+\]\((?:\/|\.\/|\.\.\/)[^)]+\)/g) ?? [];

  if (title.trim().length < profile.titleMinChars || title.trim().length > profile.titleMaxChars) {
    issues.push(issue(
      'title_length',
      `Title must be ${profile.titleMinChars}-${profile.titleMaxChars} characters.`,
      'title',
    ));
  }
  if (markdown.trim().length < profile.bodyMinChars) {
    issues.push(issue('body_length', `Body must be at least ${profile.bodyMinChars} characters.`, 'body'));
  }
  if (/^#\s+[^#]/m.test(markdown)) {
    issues.push(issue('duplicate_h1', 'Body markdown must not contain an H1.', 'body'));
  }
  if (h2Headings.length < profile.minH2Count) {
    issues.push(issue('h2_count', `Body must contain at least ${profile.minH2Count} H2 headings.`, 'body'));
  }
  if (faq.length < profile.minFaqCount) {
    issues.push(issue('faq_count', `Draft must contain at least ${profile.minFaqCount} FAQ items.`, 'faq'));
  }
  if (internalLinks.length < profile.minInternalLinks) {
    issues.push(issue(
      'internal_links',
      `Draft must contain at least ${profile.minInternalLinks} internal links.`,
      'body',
    ));
  }
  if ((brief.sources?.length ?? 0) < profile.minSources) {
    issues.push(issue('source_count', `Brief must contain at least ${profile.minSources} sources.`, 'brief'));
  }

  const compactMetaTitle = metadata.title.trim();
  const compactDescription = metadata.description.trim();
  if (
    compactMetaTitle.length < profile.metaTitleMinChars
    || compactMetaTitle.length > profile.metaTitleMaxChars
  ) {
    issues.push(issue(
      'meta_title_length',
      `Meta title must be ${profile.metaTitleMinChars}-${profile.metaTitleMaxChars} characters.`,
      'metadata',
    ));
  }
  if (
    compactDescription.length < profile.metaDescriptionMinChars
    || compactDescription.length > profile.metaDescriptionMaxChars
  ) {
    issues.push(issue(
      'meta_description_length',
      `Meta description must be ${profile.metaDescriptionMinChars}-${profile.metaDescriptionMaxChars} characters.`,
      'metadata',
    ));
  }

  const promisedCount = promisedListCount(title);
  if (promisedCount !== null) {
    const numberedHeadings = h2Headings.filter((heading) => /^\d+[.)]\s+/.test(heading));
    if (numberedHeadings.length > 0 && numberedHeadings.length !== promisedCount) {
      issues.push(issue(
        'promised_count_mismatch',
        `Title promises ${promisedCount} items but body contains ${numberedHeadings.length} numbered H2 headings.`,
        'body',
      ));
    }
  }

  const sourceText = `${title}\n${markdown}`;
  const metadataNumbers = Array.from(new Set(`${metadata.title}\n${metadata.description}`.match(/\d+/g) ?? []));
  const unsupportedNumbers = metadataNumbers.filter((value) => !sourceText.includes(value));
  if (unsupportedNumbers.length > 0) {
    issues.push(issue(
      'unsupported_meta_numbers',
      `Metadata introduces numbers not supported by the title or body: ${unsupportedNumbers.join(', ')}`,
      'metadata',
    ));
  }

  const generatedText = `${title}\n${markdown}\n${faq.map((item) => `${item.question}\n${item.answer}`).join('\n')}`;
  issues.push(...checkPatterns(generatedText, profile.forbiddenPatterns, 'forbidden'));
  issues.push(...checkPatterns(generatedText, profile.requiredPatterns, 'required'));

  return { passed: issues.length === 0, issues };
}
