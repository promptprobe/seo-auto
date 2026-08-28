export interface HtmlAuditOptions {
  expectedCanonical?: string;
  requireIndexable?: boolean;
  requireOpenGraph?: boolean;
  requiredJsonLdTypes?: readonly string[];
}

export interface HtmlAuditCheck {
  id: string;
  passed: boolean;
  message: string;
}

export interface HtmlAuditReport {
  passed: boolean;
  checks: readonly HtmlAuditCheck[];
  extracted: {
    title: string | null;
    description: string | null;
    canonical: string | null;
    robots: string | null;
    h1Count: number;
    jsonLdTypes: readonly string[];
    jsonLdParseErrors: number;
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

function attributes(tag: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    result.set(match[1]!.toLowerCase(), decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return result;
}

function metaContent(html: string, key: string): string | null {
  const normalized = key.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    if ((attrs.get('name') ?? attrs.get('property') ?? '').toLowerCase() === normalized) {
      return attrs.get('content') ?? null;
    }
  }
  return null;
}

function canonicalHref(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = attributes(tag);
    const rel = (attrs.get('rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return attrs.get('href') ?? null;
  }
  return null;
}

function documentTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([^]*?)<\/title>/i);
  return match ? decodeEntities(match[1]!.replace(/<[^>]+>/g, '').trim()) : null;
}

function collectJsonLdTypes(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonLdTypes(item, output));
    return;
  }
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  const type = record['@type'];
  if (typeof type === 'string') output.add(type);
  if (Array.isArray(type)) type.filter((item): item is string => typeof item === 'string').forEach((item) => output.add(item));
  if (record['@graph']) collectJsonLdTypes(record['@graph'], output);
}

function parseJsonLd(html: string): { types: string[]; errors: number } {
  const types = new Set<string>();
  let errors = 0;
  const scripts = html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi,
  );
  for (const script of scripts) {
    try {
      collectJsonLdTypes(JSON.parse(script[1]!.trim()), types);
    } catch {
      errors += 1;
    }
  }
  return { types: [...types], errors };
}

function check(id: string, passed: boolean, success: string, failure: string): HtmlAuditCheck {
  return { id, passed, message: passed ? success : failure };
}

export function auditHtml(html: string, options: HtmlAuditOptions = {}): HtmlAuditReport {
  const title = documentTitle(html);
  const description = metaContent(html, 'description');
  const canonical = canonicalHref(html);
  const robots = metaContent(html, 'robots');
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  const jsonLd = parseJsonLd(html);
  const requiredTypes = options.requiredJsonLdTypes ?? [];
  const checks: HtmlAuditCheck[] = [
    check('title', Boolean(title), 'Document title is present.', 'Document title is missing.'),
    check('description', Boolean(description), 'Meta description is present.', 'Meta description is missing.'),
    check('canonical', Boolean(canonical), 'Canonical link is present.', 'Canonical link is missing.'),
    check('single_h1', h1Count === 1, 'Document has one H1.', `Expected one H1 but found ${h1Count}.`),
    check('json_ld_parse', jsonLd.errors === 0, 'JSON-LD parses successfully.', `${jsonLd.errors} JSON-LD blocks failed to parse.`),
  ];

  if (options.expectedCanonical) {
    checks.push(check(
      'canonical_match',
      canonical === options.expectedCanonical,
      'Canonical URL matches the expected URL.',
      `Expected canonical ${options.expectedCanonical} but found ${canonical ?? 'none'}.`,
    ));
  }
  if (options.requireIndexable ?? true) {
    const noindex = /(?:^|[,\s])noindex(?:[,\s]|$)/i.test(robots ?? '');
    checks.push(check('indexable', !noindex, 'Page is indexable.', 'Robots metadata contains noindex.'));
  }
  if (options.requireOpenGraph) {
    const fields = ['og:title', 'og:description', 'og:url'];
    for (const field of fields) {
      checks.push(check(
        `open_graph_${field.slice(3)}`,
        Boolean(metaContent(html, field)),
        `${field} is present.`,
        `${field} is missing.`,
      ));
    }
  }
  for (const type of requiredTypes) {
    checks.push(check(
      `json_ld_${type}`,
      jsonLd.types.includes(type),
      `JSON-LD type ${type} is present.`,
      `JSON-LD type ${type} is missing.`,
    ));
  }

  return {
    passed: checks.every((item) => item.passed),
    checks,
    extracted: {
      title,
      description,
      canonical,
      robots,
      h1Count,
      jsonLdTypes: jsonLd.types,
      jsonLdParseErrors: jsonLd.errors,
    },
  };
}
