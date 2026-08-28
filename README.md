# seo-auto

[![CI](https://github.com/promptprobe/seo-auto/actions/workflows/ci.yml/badge.svg)](https://github.com/promptprobe/seo-auto/actions/workflows/ci.yml)

A framework-neutral, draft-first TypeScript toolkit for building auditable SEO content workflows.

`seo-auto` separates reusable content orchestration from domain prompts, search-engine integrations, CMS APIs, and production credentials. It gives you a small core for selecting briefs, generating structured drafts, applying deterministic gates, optionally running a second quality review, checking rendered HTML, building JSON-LD, and calculating search metrics.

> Status: early public foundation. The API is intentionally small and may change before `1.0.0`.

## Why this exists

Most content automation projects mix five different concerns in one route or script:

1. domain research and editorial rules;
2. LLM and image providers;
3. content quality gates;
4. CMS storage and publishing;
5. technical SEO and performance measurement.

That makes the workflow hard to test, reuse, and review. `seo-auto` keeps the reusable decisions in pure TypeScript and pushes provider-specific behavior behind interfaces.

## What is included

- **Draft-first pipeline** — topic context, generation, deterministic audit, optional quality review, and draft storage.
- **Configurable content profiles** — lengths, required sections, forbidden claims, source counts, internal links, FAQs, and review thresholds.
- **Duplicate protection** — normalized brief selection and exact normalized-title conflicts.
- **Technical SEO checks** — title, description, canonical, indexability, single H1, Open Graph, and JSON-LD parsing/type checks.
- **Framework-neutral metadata and JSON-LD builders** — `BlogPosting`, `FAQPage`, and `BreadcrumbList`.
- **Search metric math** — explicit CTR denominators, impression-weighted position, comparisons, and visibility buckets.
- **No runtime dependencies** — adapters can use any LLM, database, CMS, framework, or scheduler.

## What is deliberately not included

- a Google, Naver, LinkedIn, Tistory, or CMS publishing client;
- automatic public publishing;
- private prompts, source documents, credentials, or production URLs;
- claims that technical SEO guarantees crawling, indexing, ranking, or traffic;
- a hidden or reverse-engineered search ranking algorithm.

The core always saves a `review_required` draft. A production publisher should be a separate, explicitly approved adapter.

## Architecture

```text
ContentBrief
    |
    v
ContentGenerator adapter  --->  title / body / FAQ / metadata
    |
    v
Deterministic audit       --->  reject unsupported structure or policy violations
    |
    v
Optional quality review   --->  reject low score, unsupported claims, or high overlap
    |
    v
DraftStore adapter        --->  review_required draft only

Rendered page             --->  HTML audit / JSON-LD checks
Search data               --->  metric aggregation and comparison
```

The intended customization boundary is:

```text
seo-auto core
├─ profile: editorial rules for one domain
├─ generator: Anthropic, OpenAI, local model, or deterministic fixtures
├─ store: database, filesystem, CMS draft API, or in-memory test store
└─ channel adapter: web site, blog platform, newsletter, or social draft
```

## Quick start

Requires Node.js 20 or newer.

```bash
npm install
npm run check
npm run example
```

The example uses a deterministic in-memory generator and does not require API keys.

## Minimal pipeline

The npm package is not published yet. The import below documents the intended package API; use the repository example while the public API is still pre-`1.0.0`.

```ts
import {
  createContentPipeline,
  defineContentProfile,
  type ContentGenerator,
  type DraftStore,
} from '@promptprobe/seo-auto';

const profile = defineContentProfile({
  name: 'product-education',
  requiredPatterns: [
    { name: 'checklist', pattern: /^## Practical checklist$/m },
  ],
  forbiddenPatterns: [
    { name: 'guaranteed ranking claim', pattern: /guaranteed ranking/i },
  ],
});

const generator: ContentGenerator = {
  generateTitle: async (context) => yourModel.title(context),
  generateBody: async (context) => yourModel.body(context),
  generateFaq: async (context) => yourModel.faq(context),
  generateMetadata: async (context) => yourModel.metadata(context),
  reviewDraft: async (context) => yourReviewer.review(context),
};

const store: DraftStore = {
  listExistingContent: async () => database.listPublishedSummaries(),
  saveDraft: async (draft) => database.saveDraft(draft),
};

const pipeline = createContentPipeline({ generator, store, profile });

await pipeline.run({
  id: 'brief-001',
  topic: 'Reliable webhook retries',
  keyword: 'webhook retry strategy',
  audience: 'API developers',
  intent: 'learn how to retry failed webhooks safely',
  sources: [
    { title: 'HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' },
  ],
  internalLinks: ['/guides/idempotency'],
});
```

If a deterministic or quality gate fails, the pipeline throws `PipelineGateError` and does not call `saveDraft`.

## Content profiles

Profiles hold domain policy outside the core:

```ts
const profile = defineContentProfile({
  name: 'travel-guides',
  bodyMinChars: 1_800,
  minH2Count: 4,
  minFaqCount: 3,
  minSources: 2,
  qualityThreshold: 90,
  requiredPatterns: [
    { name: 'limitations section', pattern: /^## Limitations$/m },
  ],
  forbiddenPatterns: [
    { name: 'unverifiable superlative', pattern: /the best in the world/i },
  ],
});
```

Keep keyword maps, source registries, regulated-content restrictions, brand voice, and platform rules in profiles or adapters rather than in `src/pipeline`.

## Technical SEO audit

`auditHtml` accepts rendered HTML, so it works with Next.js, Astro, Remix, static HTML, or any CMS export.

```ts
import { auditHtml } from '@promptprobe/seo-auto';

const report = auditHtml(renderedHtml, {
  expectedCanonical: 'https://example.com/guides/webhook-retries',
  requireOpenGraph: true,
  requiredJsonLdTypes: ['BlogPosting', 'FAQPage'],
});

if (!report.passed) {
  console.error(report.checks.filter((check) => !check.passed));
}
```

This validates what a server rendered. It does not prove that a search engine crawled, indexed, or ranked the URL.

## Search metric math

```ts
import { aggregateSearchMetrics, compareSearchMetrics } from '@promptprobe/seo-auto';

const totals = aggregateSearchMetrics([
  { clicks: 5, impressions: 100, position: 4 },
  { clicks: 1, impressions: 20, position: 10 },
]);

// CTR = 6 / 120, position = impression-weighted average of 5.0
```

Connectors should transform provider data into this explicit row contract. Authentication, API pagination, reporting lag, and data completeness remain adapter responsibilities.

## Multi-channel use

Treat discovery strategy and publishing channel as separate dimensions:

```text
strategy: google | naver | geo | social
channel:  owned-site | hosted-blog | newsletter | professional-network
```

Share briefs, evidence, lineage, and approval state. Keep HTML renderers, platform APIs, credentials, and channel-specific rules isolated. Do not copy one generated body unchanged to every channel.

## Repository layout

```text
src/
├─ audit/       deterministic content gates
├─ metrics/     search performance math
├─ pipeline/    draft-first orchestration
└─ technical/   metadata, JSON-LD, and rendered HTML checks
test/           executable behavior and regression fixtures
examples/       API-key-free examples
```

## Contributing

Beginners are welcome. The safest first contribution is a failing fixture or test that demonstrates an observed problem and its expected result.

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and follow the repository instructions in [AGENTS.md](./AGENTS.md). Every behavior change must include a test. Pull requests must not contain credentials, private source material, production customer data, or automatic publishing side effects.

## Security and publishing boundary

- Keep API keys in the consuming application, never in profiles or fixtures.
- Use least-privilege credentials per channel.
- Treat generation, approval, publishing, deployment, and live search reflection as separate states.
- Prefer preview or draft endpoints before enabling any external write.
- Report security concerns through GitHub's private security advisory flow.

## License

No license has been selected yet. Public visibility alone does not grant permission to copy, modify, or redistribute the code. Add an explicit license before publishing this package for general reuse.
