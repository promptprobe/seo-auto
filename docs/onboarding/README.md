# Start here: connect, review, and deploy

This walkthrough takes you from a clean clone to a working demo, a read-only Google Search Console (GSC) connection, a WordPress content inventory, and a deployment you can inspect.

The toolkit works with any language or country. WordPress is the reference CMS, not a core requirement. The default search scope is worldwide web search across all devices. Examples use invented software-documentation topics.

## Choose your route

| Your starting point | Follow |
| --- | --- |
| No accounts or website yet | Steps 1–2, then the [static deployment exercise](deployment.md#route-b-deploy-the-public-fixture-site) |
| Existing WordPress site | Steps 1–5, then [WordPress production checks](deployment.md#route-a-wordpress-is-your-website) |
| Another CMS or a headless site | Try the demo, then use the [adapter checklist](wordpress.md#another-cms-or-a-headless-frontend) |

Creating a GSC property does not create search traffic. A new site may return no observations or no scores; that is a useful result, not a failed installation.

## 1. Get a working local copy

Install Git and Node.js 20 or newer (a supported LTS version is recommended). Open a terminal:

```bash
git clone https://github.com/promptprobe/seo-auto.git
cd seo-auto
npm ci
npm run check
npm run onboarding:demo
```

**Expected:** checks pass, then the demo reports `status: ready`, three scored queries and three actions: `improve`, `create`, and `review_draft`.

Open these files in your editor:

| File | What it contains |
| --- | --- |
| `.seo-auto/demo/report.json` | Synthetic observations, reporting period, scope and calculated priorities |
| `.seo-auto/demo/inventory.json` | Content IDs, publication states, public URLs and query ownership |
| `.seo-auto/demo/review-briefs.json` | Work items marked `review_required` |
| `.seo-auto/demo/wordpress-draft.json` | A local WordPress-shaped outline with `status: draft`; nothing has been sent |

The example does not call an LLM. It creates review briefs and an outline, not a finished article. The [basic pipeline example](../../examples/basic.ts) demonstrates generation and quality gates separately.

## 2. Preview the public sample

```bash
npm run onboarding:site
npm run onboarding:serve
```

Open **http://127.0.0.1:8080**. Follow the sample article link and return home. Stop the preview with Ctrl+C.

**Expected:** a public fixture homepage and one article. The sample draft is absent. Pages contain `noindex,follow` by default; no sitemap is emitted until indexing is explicitly enabled.

`site-dist/` is the only deployable output. It is built from [site-content.ts](../../examples/onboarding/site-content.ts), never from private reports. Running the build replaces this generated directory.

## 3. Connect your GSC property

Copy `.env.example` to `.env.local` using your editor, or:

```bash
cp .env.example .env.local
```

On Windows, copying and renaming the file in your editor works too. Fill the settings using a text editor; do not put passwords in shell commands.

Follow [GSC connection](gsc.md) to verify a property, enable the API, create a service account, grant property access and save its credential file locally.

## 4. Connect the CMS and check both connections

Follow [WordPress setup](wordpress.md) to create an Application Password and configure its HTTPS installation URL.

```bash
npm run onboarding:doctor
```

**Expected:** `gsc.connected: true` and `wordpress.connected: true`. `inventoryComplete: false` is the default; the guide explains when it is safe to confirm the inventory.

This command reads the property permission and all supported CMS pages. It does not check search volume, create a draft, publish an article, or change the account.

## 5. Read real observations and choose work

```bash
npm run onboarding:sync
```

This can take a few minutes: up to 56 observed days are read and each day's query/page data is paginated. The script uses the latest date actually returned as finalized, not today's date.

Open `.seo-auto/live/report.json` and `.seo-auto/live/review-briefs.json`. The live and synthetic directories are separate. Check the source, time of sync, date range, coverage, issues and notices before using the rows.

| Result | What to do |
| --- | --- |
| `improve` with a numeric score | Open the existing target URL; review and improve that article |
| `create` with a numeric score | Review intent and sources, then create a CMS draft |
| `review_draft` / `review_overlap` | Resolve ownership or an existing draft first |
| `investigate` | Complete inventory or page evidence before creating another article |
| `score: null` | Collect more observations or resolve incomplete/stale data |
| `unavailable` / zero queries | Confirm the connection; a new site may have no finalized search observations |

Default numeric scores need a full 28-day current window, at least 20 impressions and three observed days for the query. These are operating thresholds, not statistical significance tests. See [the scoring contract](../opportunities.md).

The optional `.seo-auto/live/wordpress-draft.json` is an outline for the first scored new-article candidate. It is `null` when no eligible candidate exists. Follow the [manual draft handoff](wordpress.md#save-a-reviewed-outline-as-a-draft) instead of uploading all work items automatically.

## 6. Deploy and verify the public result

Follow [deployment](deployment.md). Choose WordPress as the public website, or use the separate static exercise to learn hosting. There is no background automation server in this repository to deploy.

| State | Evidence you should see |
| --- | --- |
| Connected | Doctor succeeds |
| Measured | Live report has real dates, source and coverage |
| Draft saved | A draft exists in the CMS; its preview works |
| Deployed | Intended hosting build and domain respond |
| Published | Approved article has a public URL with the expected content |
| Discovered/indexed | Search Console later reports the URL's actual state |

Deployment, publishing and indexing are separate. The example commands never perform the last three actions for you.

## Language, geography and privacy

- `SITE_LOCALE` is the intended brief language, such as `en`, `es-MX`, `ja` or `ar`. It does not translate copy or filter GSC.
- Leave `GSC_COUNTRY` empty for worldwide data, or use a three-letter country code. Leave `GSC_DEVICE` empty for all devices.
- Keep one property, country, device and search type per report. Do not combine differently filtered exports.
- Public articles carry their own `locale`. Change the text and locale together when translating the sample.
- Keep `.env.local`, `.secrets/` and `.seo-auto/` local. They are ignored by Git and Vercel uploads. Never commit your exports as fixtures.
- The public site build needs only public content and `SITE_URL`/`SITE_INDEXABLE`; it does not need GSC or CMS credentials.

If something fails, use [troubleshooting](troubleshooting.md). Commands return a non-zero exit status on connection failures and do not overwrite the previous live report. Check its timestamp before treating an old file as a successful new sync.
