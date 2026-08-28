import assert from 'node:assert/strict';
import test from 'node:test';
import { auditHtml } from '../src/index.js';

const canonical = 'https://example.com/guides/webhook-retries';
const validHtml = `<!doctype html>
<html lang="en">
<head>
  <title>Webhook retry patterns</title>
  <meta name="description" content="A practical guide to webhook retries.">
  <meta property="og:title" content="Webhook retry patterns">
  <meta property="og:description" content="A practical guide to webhook retries.">
  <meta property="og:url" content="${canonical}">
  <link href="${canonical}" rel="canonical">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting"}</script>
</head>
<body><h1>Webhook retry patterns</h1></body>
</html>`;

test('HTML audit validates canonical, indexability, Open Graph, H1, and JSON-LD', () => {
  const result = auditHtml(validHtml, {
    expectedCanonical: canonical,
    requireOpenGraph: true,
    requiredJsonLdTypes: ['BlogPosting'],
  });

  assert.equal(result.passed, true);
  assert.equal(result.extracted.canonical, canonical);
  assert.deepEqual(result.extracted.jsonLdTypes, ['BlogPosting']);
});

test('HTML audit reports noindex and a mismatched canonical independently', () => {
  const result = auditHtml(
    validHtml.replace('</head>', '<meta name="robots" content="noindex,follow"></head>'),
    { expectedCanonical: 'https://example.com/different' },
  );

  assert.equal(result.passed, false);
  assert.equal(result.checks.find((item) => item.id === 'indexable')?.passed, false);
  assert.equal(result.checks.find((item) => item.id === 'canonical_match')?.passed, false);
});
