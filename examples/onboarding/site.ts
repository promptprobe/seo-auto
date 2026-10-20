import { buildArticleJsonLd, buildSeoMetadata, serializeJsonLd } from '../../src/index.js';
import type { SiteConfig } from './config.js';
import { escapeHtml } from './outputs.js';
import { publicArticles } from './site-content.js';

interface PublicArticle {
  slug: string; locale: string; status: string; title: string; description: string; paragraphs: readonly string[];
}
export function buildDemoSite(config: SiteConfig, articles: readonly PublicArticle[] = publicArticles) {
  const files: Record<string, string> = {};
  const published = articles.filter(article => article.status === 'published');
  const style = 'body{max-width:48rem;margin:4rem auto;padding:0 1.5rem;font:18px/1.7 system-ui;color:#16251f}a{color:#176c49}h1{line-height:1.15}aside{padding:1rem;background:#eef5f0;border-radius:.5rem}footer{margin-top:3rem;font-size:.85rem}';
  function page(title: string, description: string, path: string, locale: string, body: string, schema?: object) {
    const metadata = buildSeoMetadata({ siteName: 'SEO starter example', title, description,
      canonicalUrl: new URL(path, config.siteUrl).href, locale: locale.replaceAll('-', '_'),
      type: schema ? 'article' : 'website', index: config.indexable });
    return `<!doctype html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(metadata.canonical)}"><meta name="robots" content="${metadata.robots.index ? 'index,follow' : 'noindex,follow'}">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${metadata.openGraph.type}"><meta property="og:url" content="${escapeHtml(metadata.canonical)}">
${schema ? `<script type="application/ld+json">${serializeJsonLd(schema)}</script>` : ''}<style>${style}</style></head>
<body><aside>Public fixture demonstration. No Search Console data or CMS drafts are displayed.</aside>${body}
<footer>Built with the seo-auto starter. Replace the demonstration copy before enabling indexing.</footer></body></html>`;
  }
  const urls = [config.siteUrl];
  for (const article of published) {
    if (!/^[a-z0-9-]+$/.test(article.slug) || files[`${article.slug}/index.html`]) throw new Error('Invalid or duplicate public article slug.');
    const canonical = new URL(`${article.slug}/`, config.siteUrl).href;
    urls.push(canonical);
    files[`${article.slug}/index.html`] = page(article.title, article.description, `${article.slug}/`, article.locale,
      `<a href="../">Home</a><article><h1>${escapeHtml(article.title)}</h1>${article.paragraphs.map(text => `<p>${escapeHtml(text)}</p>`).join('')}</article>`,
      buildArticleJsonLd({ headline: article.title, description: article.description, canonicalUrl: canonical,
        datePublished: '2026-01-01', authorName: 'Example editor', publisherName: 'Example publisher' }));
  }
  files['index.html'] = page('SEO starter deployment example', 'A public fixture site for practicing a reviewed SEO deployment.',
    '', 'en', `<h1>Your starter site is running</h1><p>This page demonstrates a deployable static output. Run the private data workflow on your own computer.</p><ul>${published.map(article =>
      `<li><a href="./${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></li>`).join('')}</ul>`);
  files['robots.txt'] = `User-agent: *\nAllow: /\n${config.indexable ? `Sitemap: ${new URL('sitemap.xml', config.siteUrl).href}\n` : ''}`;
  if (config.indexable) files['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${escapeHtml(url)}</loc></url>`).join('')}</urlset>`;
  return files;
}
