import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { auditHtml, buildContentOpportunities } from '../src/index.js';
import { connectionConfig, siteConfig, pacificDate } from '../examples/onboarding/config.js';
import { demoInput } from '../examples/onboarding/fixtures.js';
import { readGsc, checkGsc } from '../examples/onboarding/gsc.js';
import { readWordPress, applyOwnership } from '../examples/onboarding/wordpress.js';
import { requestJson, type Http } from '../examples/onboarding/http.js';
import { reviewOutputs } from '../examples/onboarding/outputs.js';
import { buildDemoSite } from '../examples/onboarding/site.js';

const env = {
  SITE_URL: 'https://example.com/', GSC_PROPERTY: 'sc-domain:example.com', SITE_LOCALE: 'ja',
  GOOGLE_APPLICATION_CREDENTIALS: '.secrets/fixture.json', WORDPRESS_URL: 'https://cms.example.com/blog/',
  WORDPRESS_USER: 'fixture-user', WORDPRESS_APPLICATION_PASSWORD: 'fixture-password',
};
const json = (data: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { headers });
const metric = (keys: string[], impressions = 10) => ({ keys, impressions, clicks: 1, position: 8 });

test('onboarding: worldwide defaults, independent language, and explicit geography', () => {
  const config = connectionConfig(env);
  assert.equal(config.country, undefined);
  assert.equal(config.device, undefined);
  assert.equal(config.locale, 'ja');
  assert.equal(config.inventoryConfirmed, false);
  assert.equal(connectionConfig({ ...env, GSC_COUNTRY: 'ESP' }).country, 'esp');
  assert.equal(connectionConfig({ ...env, SITE_LOCALE: 'ar' }).locale, 'ar');
  assert.throws(() => connectionConfig({ ...env, GSC_PROPERTY: 'sc-domain:another.example' }), /domain/);
  assert.throws(() => connectionConfig({ ...env, WORDPRESS_URL: 'http://example.com/' }), /HTTPS/);
  assert.throws(() => connectionConfig({ ...env, WORDPRESS_URL: 'https://user:pass@example.com/' }), /credentials/);
  assert.throws(() => connectionConfig({ ...env, GSC_COUNTRY: 'US' }), /three-letter/);
  assert.throws(() => siteConfig({ SITE_LOCALE: 'not_a_locale' }), /language tag/);
  assert.throws(() => siteConfig({ SITE_INDEXABLE: 'true' }), /own SITE_URL/);
  assert.equal(pacificDate(new Date('2026-01-01T01:00:00Z')), '2025-12-31');
});

test('onboarding: multilingual demo routes improvement, creation and an existing draft', () => {
  const report = buildContentOpportunities(demoInput());
  assert.equal(report.status, 'ready');
  assert.deepEqual(new Set(report.rows.map(row => row.action)), new Set(['improve', 'create', 'review_draft']));
  assert.ok(report.rows.every(row => row.score !== null));
  const output = reviewOutputs(report, 'es');
  assert.ok(output.briefs.every(brief => brief.status === 'review_required' && brief.locale === 'es'));
  assert.equal(output.wordpressDraft?.status, 'draft');
  assert.equal(output.wordpressDraft?.title, 'firmar webhooks');
  const incomplete = buildContentOpportunities({ ...demoInput(), snapshots: [] });
  assert.equal(reviewOutputs(incomplete, 'en').wordpressDraft, null);
});

test('GSC: exact property authorization and missing access', async () => {
  await checkGsc({ property: 'sc-domain:example.com' }, 'fixture-token', async (url, init) => {
    assert.equal(url, 'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com');
    assert.equal(init.redirect, 'error');
    return json({ permissionLevel: 'siteRestrictedUser' });
  });
  await assert.rejects(checkGsc({ property: 'sc-domain:example.com' }, 'fixture-token',
    async () => json({ permissionLevel: 'siteUnverifiedUser' })), /not verified/);
});

test('GSC: final dates, same filters, property denominators and separate page attribution', async () => {
  const requests: Record<string, unknown>[] = [];
  const http: Http = async (_url, init) => {
    assert.equal(init.method, 'POST');
    const body = JSON.parse(String(init.body));
    requests.push(body);
    if (body.dimensions[0] === 'date') return json({ rows: [metric(['2026-09-25'], 100), metric(['2026-09-23'], 100)], responseAggregationType: 'byProperty' });
    return json({ rows: [metric(body.dimensions.length === 1 ? ['再試行'] : ['再試行', 'https://example.com/retries/'])],
      responseAggregationType: body.aggregationType });
  };
  const result = await readGsc({ property: 'sc-domain:example.com', country: 'jpn', device: 'mobile' }, 'fixture-token', '2026-09-28', http);
  assert.equal(result.periodEnd, '2026-09-25');
  assert.deepEqual(result.snapshots.map(day => day.date), ['2026-09-23', '2026-09-25']);
  assert.equal(result.snapshots[0]!.propertyImpressions, 100);
  assert.equal(result.snapshots[0]!.queries![0]!.impressions, 10);
  assert.ok(requests.every(body => body.dataState === 'final' && body.type === 'web'));
  assert.ok(requests.every(body => JSON.stringify(body.dimensionFilterGroups) === JSON.stringify(requests[0]!.dimensionFilterGroups)));
  const report = buildContentOpportunities({ ...demoInput(), ...result });
  assert.equal(report.status, 'incomplete'); // missing dates were not fabricated as zeroes
  assert.ok(report.rows.every(row => row.score === null));
});

test('GSC: paginate 25,000 rows without inflating property query totals with page rows', async () => {
  const offsets: number[] = [];
  const result = await readGsc({ property: 'https://example.com/' }, 'fixture-token', '2026-09-28', async (_url, init) => {
    const body = JSON.parse(String(init.body));
    assert.equal(body.dimensionFilterGroups, undefined);
    if (body.dimensions[0] === 'date') return json({ rows: [metric(['2026-09-25'], 30_000)], responseAggregationType: 'byProperty' });
    if (body.dimensions.length === 2) return json({ rows: [], responseAggregationType: 'byPage' });
    offsets.push(body.startRow);
    return json({ rows: body.startRow === 0
      ? Array.from({ length: 25_000 }, (_, i) => metric([`query ${i}`], 1)) : [metric(['last query'], 1)], responseAggregationType: 'byProperty' });
  });
  assert.deepEqual(offsets, [0, 25_000]);
  assert.equal(result.snapshots[0]!.queries!.length, 25_001);
  assert.equal(result.snapshots[0]!.propertyImpressions, 30_000);
});

test('GSC: no observations stays unavailable; partial/invalid requests fail closed', async () => {
  const empty = await readGsc({ property: 'sc-domain:example.com' }, 'fixture-token', '2026-09-28',
    async () => json({}));
  assert.equal(empty.periodEnd, null);
  assert.deepEqual(empty.snapshots, []);
  await assert.rejects(readGsc({ property: 'sc-domain:example.com' }, 'fixture-token', '2026-09-28',
    async () => json({ responseAggregationType: 'byPage' })), /aggregation/);
  await assert.rejects(readGsc({ property: 'sc-domain:example.com' }, 'fixture-token', '2026-09-28',
    async (_url, init) => {
      const body = JSON.parse(String(init.body));
      return body.dimensions[0] === 'date'
        ? json({ rows: [metric(['2026-09-25'])], responseAggregationType: 'byProperty' })
        : new Response('private response must not be logged', { status: 429 });
    }), /HTTP 429/);
});

test('GSC: duplicate query rows are rejected instead of raising the opportunity score', async () => {
  await assert.rejects(readGsc({ property: 'sc-domain:example.com' }, 'fixture-token', '2026-09-28',
    async (_url, init) => {
      const body = JSON.parse(String(init.body));
      return json({ rows: body.dimensions[0] === 'date'
        ? [metric(['2026-09-25'])]
        : [metric(['duplicate']), metric(['duplicate'])], responseAggregationType: 'byProperty' });
    }), /repeated a row/);
});

const capabilities = { edit_others_posts: true, read_private_posts: true, edit_others_pages: true, read_private_pages: true };
const post = (id: number, status = 'publish') => ({ id, status, link: `https://example.com/?p=${id}`, title: { raw: `Article ${id}` } });
function wordpressHttp(override?: (url: URL) => Response | undefined): Http {
  return async (raw, init) => {
    assert.equal(init.method, 'GET'); // no CMS mutation is allowed, even in an example
    assert.equal(init.redirect, 'error');
    const url = new URL(raw);
    assert.ok(url.pathname.startsWith('/blog/wp-json/wp/v2/'));
    const response = override?.(url);
    if (response) return response;
    if (url.pathname.endsWith('/users/me')) return json({ id: 1, capabilities });
    assert.equal(url.searchParams.get('context'), 'edit');
    assert.equal(url.searchParams.get('status'), 'publish,draft,pending,future,private');
    if (url.pathname.endsWith('/pages')) return json([], { 'x-wp-totalpages': '0', 'x-wp-total': '0' });
    return url.searchParams.get('page') === '1'
      ? json(Array.from({ length: 100 }, (_, i) => post(i + 1)), { 'x-wp-totalpages': '2', 'x-wp-total': '101' })
      : json([post(101, 'draft')], { 'x-wp-totalpages': '2', 'x-wp-total': '101' });
  };
}

test('WordPress: all pages and drafts retained; completeness needs capability and explicit confirmation', async () => {
  const config = connectionConfig(env);
  const unconfirmed = await readWordPress(config, wordpressHttp());
  assert.equal(unconfirmed.inventory.length, 101);
  assert.equal(unconfirmed.inventory.at(-1)!.status, 'draft');
  assert.equal(unconfirmed.inventoryComplete, false);
  const confirmed = await readWordPress({ ...config, inventoryConfirmed: true }, wordpressHttp());
  assert.equal(confirmed.inventoryComplete, true);
  const restricted = await readWordPress({ ...config, inventoryConfirmed: true }, wordpressHttp(url =>
    url.pathname.endsWith('/users/me') ? json({ id: 1, capabilities: {} }) : undefined));
  assert.equal(restricted.inventoryComplete, false);
});

test('WordPress: missing pagination, changing inventories, duplicates and authentication fail safely', async () => {
  const config = connectionConfig(env);
  await assert.rejects(readWordPress(config, wordpressHttp(url => url.pathname.endsWith('/posts') ? json([post(1)]) : undefined)), /pagination/);
  await assert.rejects(readWordPress(config, wordpressHttp(url =>
    url.searchParams.get('page') === '2' ? json([post(101)], { 'x-wp-totalpages': '2', 'x-wp-total': '102' }) : undefined)), /changed/);
  await assert.rejects(readWordPress(config, wordpressHttp(url =>
    url.searchParams.get('page') === '2' ? json([post(1)], { 'x-wp-totalpages': '2', 'x-wp-total': '101' }) : undefined)), /duplicate/);
  await assert.rejects(readWordPress(config, async () => new Response('secret must not escape', { status: 401 })), /WordPress: HTTP 401/);
});

test('HTTP failures never include token-bearing bodies, headers or exceptions', async () => {
  for (const http of [
    async () => { throw new Error('Bearer private-canary'); },
    async () => new Response('private-canary', { status: 403 }),
    async () => new Response('<html>private-canary</html>'),
  ]) {
    await assert.rejects(requestJson(http, 'https://example.com/', {}, 'Fixture'),
      error => error instanceof Error && !error.message.includes('private-canary'));
  }
});

test('local CMS mappings preserve draft ownership and frontend aliases without inventing content IDs', () => {
  const input = demoInput();
  const inventory = applyOwnership(input.inventory.map(item => ({ ...item, queries: [] })), {
    'posts:3': { queries: ['ウェブフック 再試行'], aliases: ['https://example.com/retry-ja/'] },
    'pages:2': { queries: [], kind: 'hub' },
  });
  const report = buildContentOpportunities({ ...input, inventory });
  assert.equal(report.rows.find(row => row.query === 'ウェブフック 再試行')!.action, 'review_draft');
  assert.deepEqual(inventory.find(item => item.id === 'posts:3')!.aliases, ['https://example.com/retry-ja/']);
  assert.throws(() => applyOwnership(inventory, { 'posts:unknown': { queries: [] } }), /not present/);
  assert.throws(() => applyOwnership(inventory, { 'posts:3': { queries: [], status: 'published' } }), /Ownership entries/);
});

test('public build excludes drafts, defaults to noindex, and emits valid metadata for approved content', () => {
  const files = buildDemoSite(siteConfig({}));
  assert.equal(files['unfinished-example/index.html'], undefined);
  assert.equal(files['sitemap.xml'], undefined);
  assert.match(files['index.html']!, /noindex,follow/);
  const html = files['reliable-webhooks/index.html']!;
  assert.ok(auditHtml(html, { expectedCanonical: 'https://example.com/reliable-webhooks/',
    requireIndexable: false, requireOpenGraph: true, requiredJsonLdTypes: ['BlogPosting'] }).passed);
  const indexed = buildDemoSite(siteConfig({ SITE_URL: 'https://docs.example.test/', SITE_INDEXABLE: 'true' }));
  assert.match(indexed['sitemap.xml']!, /https:\/\/docs.example.test\/reliable-webhooks\//);
  assert.ok(!indexed['sitemap.xml']!.includes('unfinished'));
  const localized = buildDemoSite(siteConfig({}), [{ slug: 'arabic', locale: 'ar', status: 'published',
    title: 'دليل <script>alert(1)</script>', description: 'نص تجريبي', paragraphs: ['<script>unsafe()</script>'] }]);
  assert.match(localized['arabic/index.html']!, /lang="ar"/);
  assert.ok(!localized['arabic/index.html']!.includes('<script>unsafe()'));
});

test('CLI public build cannot copy private reports or credentials; a rebuild removes stale public files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'seo-auto-onboarding-'));
  try {
    mkdirSync(join(directory, '.seo-auto'));
    writeFileSync(join(directory, '.seo-auto', 'report.json'), '{"query":"private-report-canary"}');
    writeFileSync(join(directory, '.env.local'), 'WORDPRESS_APPLICATION_PASSWORD=credential-canary\nSITE_INDEXABLE=false\n');
    mkdirSync(join(directory, 'site-dist'));
    writeFileSync(join(directory, 'site-dist', 'stale-draft.html'), 'stale-content-canary');
    execFileSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), resolve('examples/onboarding/cli.ts'), 'site'], {
      cwd: directory, env: { ...process.env, SITE_URL: 'https://example.com/', SITE_INDEXABLE: 'false' },
    });
    const files = readdirSync(join(directory, 'site-dist'), { recursive: true, withFileTypes: true });
    assert.ok(!files.some(file => file.name === 'stale-draft.html'));
    for (const file of files.filter(item => item.isFile())) {
      const content = readFileSync(join(file.parentPath ?? file.path, file.name), 'utf8');
      assert.ok(!/private-report-canary|credential-canary|stale-content-canary/.test(content));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
