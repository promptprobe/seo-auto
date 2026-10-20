# Deploy the right artifact

There are two different routes. A WordPress site already has a CMS and public renderer. The static exercise demonstrates deploying an independent public website. The private GSC reader is a local command, not a public dashboard or server.

## Route A: WordPress is your website

1. Finish installation and HTTPS at your chosen host.
2. Create and preview a draft using the [CMS guide](wordpress.md).
3. Review the complete article in the CMS. When ready, a human chooses **Publish**.
4. Open its canonical URL in a signed-out browser. Verify the article, title, description, links, images and mobile layout.
5. Check the page's canonical URL, robots meta tag and HTTP status. Remove staging-only noindex settings when this specific production site is ready.
6. Inspect the site's actual sitemap (WordPress commonly serves `/wp-sitemap.xml`; an SEO plugin may supply another URL). Use the sitemap the installation really provides.
7. Submit the production sitemap in Search Console and inspect a representative URL. Submission is an acknowledgement, not proof of indexing.

Use [WordPress's SEO guidance](https://wordpress.org/documentation/article/search-engine-optimization/) and [Google's sitemap guide](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) for the host-specific checks.

You do not need to deploy this toolkit to Vercel to operate a WordPress site. Run the read-only sync locally when needed. A scheduler can be added later with a private credential store and incremental reads.

## Route B: deploy the public fixture site

First run:

```bash
npm ci
npm run check
npm run onboarding:site
npm run onboarding:serve
```

Inspect http://127.0.0.1:8080 and the sample article. Stop the local server with Ctrl+C. This site uses explicit public fixtures; it does not display GSC queries, CMS drafts or authenticated reports.

### Create your own hosting project

Fork the repository into your account, or push your reviewed copy to a repository you control. In Vercel, import that repository as a **new project** in the intended account/team.

Set these build options:

| Setting | Value |
| --- | --- |
| Framework Preset | Other |
| Root Directory | Repository root |
| Install Command | `npm ci` |
| Build Command | `npm run onboarding:site` |
| Output Directory | `site-dist` |
| Node.js | A supported version compatible with the repository |

Only add public build settings:

```dotenv
SITE_URL=https://your-intended-public-domain.example/
SITE_INDEXABLE=false
```

Replace the URL with the actual intended canonical origin. If you do not have a custom domain yet, use the project's assigned public domain after it is known and rebuild. Keep preview deployments noindex.

**Do not add GSC keys, WordPress passwords or `.seo-auto/` exports to this project.** They are not needed by this static build. `.vercelignore` excludes local credential/export files, and the builder reads only explicit public content for its output.

The normal `npm run build` compiles the library into `dist/`; it does not create a website. Deploy `site-dist/`, not `dist/`, the repository root or a private report folder.

Reference: [Vercel build settings](https://vercel.com/docs/builds/configure-a-build).

### Verify a preview

After a successful build, open the preview URL. Sign in to the hosting service if its deployment protection requires it.

Check:

- Homepage and article links work, including a direct reload of the article URL.
- The unfinished sample draft does not have a public page.
- Page source contains a canonical URL, title, description, Open Graph tags and article JSON-LD.
- The robots meta tag says `noindex,follow`.
- `/robots.txt` responds. `/sitemap.xml` is absent while the sample is noindex.
- `.env.local` and `.seo-auto/live/report.json` are not downloadable.

Allowing crawling while using the noindex meta tag lets a crawler read that directive. A robots.txt Disallow rule is not a substitute for authentication or a guarantee that a URL will disappear from search.

### Make your own content public

Before enabling indexing:

1. Replace the fixture copy, author/publisher names, dates and demo notices in `examples/onboarding/site-content.ts` / `site.ts`.
2. Set each public article's actual language; translate its copy too. Keep unapproved entries in `draft`.
3. Connect your production domain, set `SITE_URL` to that canonical URL, and verify HTTPS.
4. Set `SITE_INDEXABLE=true` for **Production only**. Keep it false for Preview.
5. Deploy the reviewed commit through your hosting dashboard. If Git deployments are enabled, pushes to the configured production branch can trigger a release.
6. Verify the production domain again. Check that approved URLs are in `/sitemap.xml`, drafts are absent, and canonical URLs agree with the public domain.

The builder escapes public text and emits only entries explicitly marked `published`. It does not read WordPress posts, synchronize a CMS, run a language model or schedule jobs. Connect a CMS to a frontend only after implementing and reviewing an adapter that exposes approved public content.

This repository does not create a hosting project or deploy when tests/examples run. The hosting dashboard action is a separate decision you make.

## Confirm search reflection later

Open the live URL in Search Console URL Inspection. Check the reported canonical, crawl/indexing state and any blocking reasons. A passing HTML audit, successful deployment or accepted sitemap does not establish that the page is indexed or receiving impressions.

Keep the actual deployed commit and URL with your verification notes. If the deployment is wrong, restore a known-good deployment in the hosting dashboard and recheck the public domain.
