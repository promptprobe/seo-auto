import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, serializeJsonLd } from '../src/index.js';

test('JSON-LD builders create framework-neutral article, FAQ, and breadcrumb schemas', () => {
  const article = buildArticleJsonLd({
    headline: 'Webhook retries',
    description: 'A guide',
    canonicalUrl: 'https://example.com/retries',
    datePublished: '2026-08-28T00:00:00.000Z',
    authorName: 'Editorial team',
    publisherName: 'Example',
  });
  const faq = buildFaqJsonLd([{ question: 'Why retry?', answer: 'To recover from transient failures.' }]);
  const breadcrumbs = buildBreadcrumbJsonLd([
    { name: 'Home', url: 'https://example.com' },
    { name: 'Retries', url: 'https://example.com/retries' },
  ]);

  assert.equal(article['@type'], 'BlogPosting');
  assert.equal(faq.mainEntity.length, 1);
  assert.equal(breadcrumbs.itemListElement[1]?.position, 2);
});

test('JSON-LD serialization prevents user content from terminating a script tag', () => {
  const serialized = serializeJsonLd({ value: '</script><script>alert(1)</script>' });
  assert.equal(serialized.includes('</script>'), false);
  assert.equal(serialized.includes('\\u003c/script>'), true);
});
