import { normalizeCompact } from './normalize.js';
import type { ContentBrief, ExistingContent } from './types.js';

function existingFingerprints(content: readonly ExistingContent[]): Set<string> {
  return new Set(
    content.flatMap((item) => [item.title, item.primaryIntent ?? ''])
      .map(normalizeCompact)
      .filter(Boolean),
  );
}

export function selectUnusedBriefs(
  briefs: readonly ContentBrief[],
  existingContent: readonly ExistingContent[],
  count = 1,
): ContentBrief[] {
  const safeCount = Number.isSafeInteger(count) ? Math.max(0, count) : 1;
  const used = existingFingerprints(existingContent);
  const selected: ContentBrief[] = [];

  for (const brief of briefs) {
    const candidates = [brief.topic, brief.keyword, brief.intent].map(normalizeCompact).filter(Boolean);
    if (candidates.some((candidate) => used.has(candidate))) continue;
    selected.push(brief);
    candidates.forEach((candidate) => used.add(candidate));
    if (selected.length >= safeCount) break;
  }

  return selected;
}

export function findDuplicateTitle(
  title: string,
  existingContent: readonly ExistingContent[],
): ExistingContent | null {
  const normalized = normalizeCompact(title);
  if (!normalized) return null;
  return existingContent.find((item) => normalizeCompact(item.title) === normalized) ?? null;
}
