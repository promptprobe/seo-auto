// SPDX-License-Identifier: MIT
// Scheduling heuristics over observed site traffic, not search-volume or ranking predictions.
export const OPPORTUNITY_METHOD_VERSION = 'observed-search-v1';

export interface OpportunityQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}
export interface OpportunityPageRow extends OpportunityQueryRow { page: string }
export interface OpportunitySnapshot {
  date: string;
  finalized: boolean;
  propertyImpressions: number;
  queries: OpportunityQueryRow[] | null;
  pages: OpportunityPageRow[] | null;
}
export interface OpportunityContent {
  id: string;
  url: string;
  title: string;
  status: 'published' | 'draft';
  kind: 'article' | 'hub' | 'other';
  queries: string[];
  aliases?: string[];
}
export interface OpportunityInput {
  snapshots: OpportunitySnapshot[];
  periodEnd: string | null;
  asOfDate: string;
  inventory: OpportunityContent[];
  inventoryComplete: boolean;
  options?: {
    windowDays?: number;
    minImpressions?: number;
    minObservedDays?: number;
    maxDataAgeDays?: number;
    includeQuery?: (query: string) => boolean;
    normalizeQuery?: (query: string) => string;
  };
}
export type OpportunityAction = 'improve' | 'create' | 'review_draft' | 'review_overlap' | 'investigate';
export interface OpportunityMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  observedDays: number;
}
export interface OpportunityComponent {
  id: 'demand' | 'position' | 'ctr_gap';
  weight: number;
  available: boolean;
  points: number | null;
}
export interface ContentOpportunity {
  key: string;
  query: string;
  action: OpportunityAction;
  reason: string;
  target: OpportunityContent | null;
  relatedContent: OpportunityContent[];
  rankingPages: Array<{ url: string; impressions: number }>;
  current: OpportunityMetrics;
  previous: OpportunityMetrics | null;
  impressionChange: number | null;
  score: number | null;
  priority: 'high' | 'medium' | 'low' | 'unscored';
  evidence: 'repeated' | 'limited' | 'insufficient';
  components: OpportunityComponent[];
  ctrBenchmark: { ctr: number; impressions: number; queries: number } | null;
}
export interface OpportunityReport {
  methodVersion: string;
  status: 'ready' | 'incomplete' | 'stale' | 'unavailable';
  period: { start: string | null; end: string | null; previousStart: string | null; previousEnd: string | null; days: number };
  coverage: {
    currentDays: number;
    previousDays: number;
    queryImpressions: number;
    propertyImpressions: number;
    queryCoverage: number | null;
    inventoryComplete: boolean;
  };
  issues: string[];
  rows: ContentOpportunity[];
}

export function normalizeOpportunityQuery(query: string): string {
  return query.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function opportunityDates(end: string, count: number): string[] {
  if (!validDate(end) || !Number.isSafeInteger(count) || count < 1 || count > 732) throw new Error('Invalid date range');
  return Array.from({ length: count }, (_, i) => shiftDate(end, i - count + 1));
}

function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(date).toISOString().slice(0, 10) === date;
}
function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/$/, '') || '/';
    // Query parameters may identify distinct CMS pages; never strip them implicitly.
    return url.toString();
  } catch { return null; }
}
function validMetric(row: OpportunityQueryRow): boolean {
  return typeof row.query === 'string' && row.query.trim().length > 0
    && [row.clicks, row.impressions, row.position].every(Number.isFinite)
    && row.clicks >= 0 && row.impressions >= row.clicks
    && (row.impressions > 0 ? row.position > 0 : row.clicks === 0 && row.position >= 0);
}
function validSnapshot(snapshot: OpportunitySnapshot): boolean {
  return snapshot.finalized === true && Number.isFinite(snapshot.propertyImpressions) && snapshot.propertyImpressions >= 0
    && Array.isArray(snapshot.queries) && snapshot.queries.every(validMetric)
    && snapshot.queries.reduce((sum, row) => sum + row.impressions, 0) <= snapshot.propertyImpressions
    && Array.isArray(snapshot.pages) && snapshot.pages.every(row => validMetric(row) && normalizedUrl(row.page) !== null);
}

interface Aggregate { query: string; clicks: number; impressions: number; weightedPosition: number; dates: Set<string> }
function aggregate(snapshots: OpportunitySnapshot[], normalize: (query: string) => string): Map<string, Aggregate> {
  const rows = new Map<string, Aggregate>();
  for (const snapshot of snapshots) for (const row of snapshot.queries ?? []) {
    if (!row.impressions) continue;
    const key = normalize(row.query);
    if (!key) continue;
    const value = rows.get(key) ?? { query: row.query, clicks: 0, impressions: 0, weightedPosition: 0, dates: new Set<string>() };
    value.clicks += row.clicks;
    value.impressions += row.impressions;
    value.weightedPosition += row.position * row.impressions;
    value.dates.add(snapshot.date);
    rows.set(key, value);
  }
  return rows;
}
function metrics(value: Aggregate): OpportunityMetrics {
  return { clicks: value.clicks, impressions: value.impressions, ctr: value.clicks / value.impressions,
    position: value.weightedPosition / value.impressions, observedDays: value.dates.size };
}
function positionBand(position: number): number {
  return position <= 3 ? 0 : position <= 10 ? 1 : position <= 20 ? 2 : position <= 40 ? 3 : 4;
}
function positionPotential(position: number): number {
  return [0.2, 1, 0.8, 0.4, 0.1][positionBand(position)]!;
}

function decideAction(key: string, pages: ContentOpportunity['rankingPages'], inventory: OpportunityContent[], complete: boolean, normalize: (q: string) => string) {
  const ranked = new Set(pages.map(page => normalizedUrl(page.url)));
  const matches = (content: OpportunityContent) => [content.url, ...(content.aliases ?? [])].some(url => ranked.has(normalizedUrl(url)));
  const owns = (content: OpportunityContent) => content.queries.some(query => normalize(query) === key);
  const candidates = inventory.filter(content => owns(content) || (content.kind === 'article' && matches(content)));
  const published = candidates.filter(content => content.status === 'published');
  const drafts = candidates.filter(content => content.status === 'draft');
  const result = (action: OpportunityAction, reason: string, target: OpportunityContent | null = null) => ({ action, reason, target, relatedContent: candidates });
  if (published.length > 1) return result('review_overlap', 'multiple_article_owners', published[0]!);
  if (published.length === 1) return result('improve', 'existing_article_owner', published[0]!);
  if (drafts.length > 1) return result('review_overlap', 'multiple_draft_owners', drafts[0]!);
  if (drafts.length === 1) return result('review_draft', 'existing_draft_owner', drafts[0]!);
  if (!complete) return result('investigate', 'inventory_incomplete');
  if (!pages.length) return result('investigate', 'page_evidence_missing');
  const allKnownNonArticles = pages.every(page => inventory.some(content => content.status === 'published'
    && content.kind !== 'article' && [content.url, ...(content.aliases ?? [])].some(url => normalizedUrl(url) === normalizedUrl(page.url))));
  return allKnownNonArticles ? result('create', 'non_article_landings_only') : result('investigate', 'unknown_landing_page');
}

/** Pure computation. Inputs must share one property, country/device scope and search type. */
export function buildContentOpportunities(input: OpportunityInput): OpportunityReport {
  const { snapshots, periodEnd, asOfDate, inventory, inventoryComplete } = input;
  const days = input.options?.windowDays ?? 28;
  const minImpressions = input.options?.minImpressions ?? 20;
  const minDays = input.options?.minObservedDays ?? 3;
  const maxAge = input.options?.maxDataAgeDays ?? 7;
  const normalize = input.options?.normalizeQuery ?? normalizeOpportunityQuery;
  if (!validDate(asOfDate) || (periodEnd !== null && (!validDate(periodEnd) || periodEnd > asOfDate))) throw new Error('Invalid date');
  if (![days, minImpressions, minDays, maxAge].every(n => Number.isSafeInteger(n) && n > 0) || days > 366 || minDays > days) throw new Error('Invalid opportunity thresholds');
  const report: OpportunityReport = {
    methodVersion: OPPORTUNITY_METHOD_VERSION, status: 'unavailable',
    period: { start: null, end: periodEnd, previousStart: null, previousEnd: null, days },
    coverage: { currentDays: 0, previousDays: 0, queryImpressions: 0, propertyImpressions: 0, queryCoverage: null, inventoryComplete },
    issues: [], rows: [],
  };
  if (!periodEnd) { report.issues.push('no_finalized_period'); return report; }
  const currentDates = opportunityDates(periodEnd, days);
  const previousEnd = shiftDate(currentDates[0]!, -1);
  const priorDates = opportunityDates(previousEnd, days);
  report.period = { start: currentDates[0]!, end: periodEnd, previousStart: priorDates[0]!, previousEnd, days };
  const byDate = new Map<string, OpportunitySnapshot[]>();
  for (const snapshot of snapshots) byDate.set(snapshot.date, [...(byDate.get(snapshot.date) ?? []), snapshot]);
  const covered = (dates: string[]) => dates.flatMap(date => {
    const matches = byDate.get(date) ?? [];
    // Duplicate dates are ambiguous even when their values happen to be identical.
    return matches.length === 1 && validSnapshot(matches[0]!) ? [matches[0]!] : [];
  });
  const current = covered(currentDates);
  const previous = covered(priorDates);
  report.coverage.currentDays = current.length;
  report.coverage.previousDays = previous.length;
  const age = (Date.parse(asOfDate) - Date.parse(periodEnd)) / 86_400_000;
  report.status = age > maxAge ? 'stale' : current.length === days ? 'ready' : 'incomplete';
  if (report.status !== 'ready') report.issues.push(report.status === 'stale' ? 'stale_data' : 'missing_or_invalid_days');
  if (previous.length !== days) report.issues.push('previous_period_incomplete');
  if (!inventoryComplete) report.issues.push('inventory_incomplete');
  const allCurrent = aggregate(current, normalize);
  const allPrevious = aggregate(previous, normalize);
  report.coverage.queryImpressions = [...allCurrent.values()].reduce((sum, row) => sum + row.impressions, 0);
  report.coverage.propertyImpressions = current.reduce((sum, snapshot) => sum + snapshot.propertyImpressions, 0);
  report.coverage.queryCoverage = report.coverage.propertyImpressions > 0 ? report.coverage.queryImpressions / report.coverage.propertyImpressions : null;
  if (report.coverage.queryImpressions > report.coverage.propertyImpressions) {
    report.status = 'incomplete'; report.issues.push('inconsistent_aggregation_scope');
  }
  const eligible = [...allCurrent].filter(([, value]) => input.options?.includeQuery?.(value.query) ?? true);
  const maxImpressions = eligible.reduce((max, [, row]) => Math.max(max, row.impressions), 1);
  // Page-level impressions locate the owning URL; they are never added to query totals.
  const pagesByQuery = new Map<string, Map<string, number>>();
  for (const snapshot of current) for (const page of snapshot.pages ?? []) {
    if (page.impressions <= 0) continue;
    const key = normalize(page.query); const url = normalizedUrl(page.page)!;
    const pages = pagesByQuery.get(key) ?? new Map<string, number>();
    pages.set(url, (pages.get(url) ?? 0) + page.impressions); pagesByQuery.set(key, pages);
  }
  const peersByBand = new Map<number, { clicks: number; impressions: number; count: number }>();
  for (const entry of eligible) {
    const band = positionBand(metrics(entry[1]).position);
    const peers = peersByBand.get(band) ?? { clicks: 0, impressions: 0, count: 0 };
    peers.clicks += entry[1].clicks; peers.impressions += entry[1].impressions; peers.count++;
    peersByBand.set(band, peers);
  }
  for (const [key, value] of eligible) {
    const currentMetrics = metrics(value);
    const prior = previous.length === days ? allPrevious.get(key) : undefined;
    const previousMetrics = prior ? metrics(prior) : null;
    const peers = peersByBand.get(positionBand(currentMetrics.position))!;
    const peerImpressions = peers.impressions - value.impressions;
    const peerClicks = peers.clicks - value.clicks;
    const peerCount = peers.count - 1;
    const ctrBenchmark = peerCount >= 5 && peerImpressions >= 100
      ? { ctr: peerClicks / peerImpressions, impressions: peerImpressions, queries: peerCount } : null;
    const hasCtrBenchmark = ctrBenchmark !== null && ctrBenchmark.ctr > 0;
    const components: OpportunityComponent[] = [
      { id: 'demand', weight: 50, available: true, points: 50 * Math.log1p(value.impressions) / Math.log1p(maxImpressions) },
      { id: 'position', weight: 30, available: true, points: 30 * positionPotential(currentMetrics.position) },
      { id: 'ctr_gap', weight: 20, available: hasCtrBenchmark,
        points: hasCtrBenchmark ? 20 * Math.max(0, 1 - currentMetrics.ctr / ctrBenchmark!.ctr) : null },
    ];
    const enough = report.status === 'ready' && value.impressions >= minImpressions && value.dates.size >= minDays;
    const availableWeight = components.reduce((sum, c) => sum + (c.available ? c.weight : 0), 0);
    const score = enough ? Math.round(100 * components.reduce((sum, c) => sum + (c.points ?? 0), 0) / availableWeight) : null;
    const rankingPages = [...(pagesByQuery.get(key) ?? [])].map(([url, impressions]) => ({ url, impressions }))
      .sort((a, b) => b.impressions - a.impressions || a.url.localeCompare(b.url));
    const decision = decideAction(key, rankingPages, inventory, inventoryComplete, normalize);
    report.rows.push({ key, query: value.query, ...decision, rankingPages, current: currentMetrics, previous: previousMetrics,
      impressionChange: previousMetrics ? (currentMetrics.impressions - previousMetrics.impressions) / previousMetrics.impressions : null,
      score, priority: score === null ? 'unscored' : score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
      evidence: !enough ? 'insufficient' : value.impressions >= 100 && value.dates.size >= 7 ? 'repeated' : 'limited',
      components, ctrBenchmark });
  }
  report.rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.current.impressions - a.current.impressions || a.key.localeCompare(b.key));
  return report;
}
