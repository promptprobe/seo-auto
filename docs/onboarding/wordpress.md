# Configure WordPress and hand off a draft

The reference adapter supports WordPress 5.6+ REST API posts and pages over HTTPS. It reads content and builds a local outline; it never sends a CMS write request.

## 1. Prepare the CMS

If you already have a WordPress site, use a staging copy while learning. If you are starting from scratch, install WordPress through a host you choose, configure HTTPS and a canonical domain, then sign in to its dashboard. Hosting purchases and account creation are outside the example.

1. Check **Settings → General** for the intended site URLs.
2. Choose stable permalinks under **Settings → Permalinks** before importing content.
3. Open `https://example.com/wp-json/wp/v2/posts` in a browser, replacing the domain. Expect a JSON list (an empty list is fine).
4. Use **Settings → Reading → Discourage search engines** for a staging site. Revisit it before a public launch.

This recipe targets the standard WordPress REST API. A hosted service or security plugin may require different authentication or a particular plan. If Application Passwords are unavailable, follow that host's supported API route rather than substituting your ordinary login password.

References: [WordPress installation](https://developer.wordpress.org/advanced-administration/before-install/howto-install/), [REST authentication](https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/).

## 2. Create an Application Password

Use a dedicated integration user. To inspect all built-in posts/pages and other authors' drafts, the reference completeness check needs `edit_others_posts`, `read_private_posts`, `edit_others_pages` and `read_private_pages`; an Editor usually has these capabilities. A lower-privilege account cannot establish a complete inventory.

Open that user's profile, find **Application Passwords**, enter a name such as `seo-local-reader`, and create one. Save the displayed value directly in `.env.local`:

```dotenv
WORDPRESS_URL=https://example.com/
WORDPRESS_USER=integration-user
WORDPRESS_APPLICATION_PASSWORD="replace in your local editor"
WORDPRESS_INVENTORY_COMPLETE=false
```

Use the actual installation base URL. For WordPress installed under `/blog/`, use `https://example.com/blog/`; the adapter appends `wp-json/wp/v2/`. Use the canonical URL that does not redirect.

An Application Password inherits the user's capabilities and may allow writes, even though this example only uses GET requests. Revoke it from the user's profile when no longer needed.

## 3. Read the inventory

After configuring GSC:

```bash
npm run onboarding:doctor
```

The adapter checks the authenticated identity, paginates both posts and pages, and retains published, draft, pending, scheduled and private items. Non-public states become `draft` in the core inventory. Missing/changing pagination headers or failed requests abort the read.

Leave `WORDPRESS_INVENTORY_COMPLETE=false` until you have checked all of these:

- All relevant content for this GSC property lives in this WordPress installation's built-in posts/pages.
- There are no additional custom post types, storefronts, other CMSs or subdomains with content outside the returned inventory.
- The integration user can read other authors' and private content.
- Posts are articles; the adapter treats pages as `other`. Review any page that is actually an article or already owns a query before allowing a new-article recommendation.

Then you may set `WORDPRESS_INVENTORY_COMPLETE=true` and rerun the sync. Without confirmation, existing matches can still be reviewed, but new-article recommendations stay blocked.

URLs provide automatic attribution for published articles. WordPress does not provide an editorial query-ownership field by default, so the reader initially sets `queries: []`. Do not assume that similar titles prove ownership.

After the first successful sync, inspect `.seo-auto/live/inventory.json` for content IDs. To connect a draft to a query, classify a landing page, or map a headless frontend URL, create a local `.seo-auto/ownership.json`:

```json
{
  "posts:123": {
    "queries": ["webhook retries"],
    "aliases": ["https://example.com/guides/retries/"]
  },
  "pages:456": {
    "queries": [],
    "kind": "hub"
  }
}
```

Replace the example IDs/URLs/queries with entries you actually reviewed, then set `WORDPRESS_OWNERSHIP_FILE=.seo-auto/ownership.json` in `.env.local` and rerun the sync. Unknown IDs and attempts to change publication status are rejected. These editorial mappings remain local; never commit production mappings as example data.

References: [posts and statuses](https://developer.wordpress.org/rest-api/reference/posts/), [pagination headers](https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/).

## Save a reviewed outline as a draft

After `npm run onboarding:sync`, open:

```text
.seo-auto/live/review-briefs.json
.seo-auto/live/wordpress-draft.json
```

If the draft file is `null`, there is no scored new-article candidate. Improve an existing article or resolve the report's missing evidence instead of forcing a new one.

For an eligible new candidate:

1. Review its query, date range, source evidence and existing content.
2. In WordPress, choose **Posts → Add New**.
3. Copy the local payload's `title`. Use a Custom HTML block for its `content`, or write your own outline in normal editor blocks. Do not paste the entire JSON object.
4. Choose **Save draft**, then open **Preview**.
5. Verify that the post remains Draft in the posts list. Write and review the full article, sources, metadata, links and images before deciding to publish.

The supplied outline contains a TODO; it is not publication-ready content. For `improve`, open and edit the existing post rather than creating a duplicate. No example command approves or publishes either action.

The payload uses WordPress's `draft` status. The local workflow retains `review_required` separately; these are not interchangeable with “approved.”

## Another CMS or a headless frontend

Keep `src/` unchanged and replace the example CMS reader:

| CMS concept | `OpportunityContent` field |
| --- | --- |
| Stable content ID | `id` |
| Public canonical frontend URL, not the CMS editing URL | `url` |
| Redirected/legacy public URLs | `aliases` |
| Published vs any unapproved state | `status` |
| Article / hub / other landing page | `kind` |
| Explicit editorial ownership | `queries` |

Read all pages and drafts, keep scope consistent with GSC, and set completeness only after successful pagination and coverage checks. Headless WordPress may require rewriting backend links to the actual frontend canonical URLs. Unknown landing URLs should remain `investigate`, not become automatic new articles.

For generation/storage, implement the exported `ContentGenerator` and `DraftStore` interfaces as shown in [the basic example](../../examples/basic.ts). A `DraftStore` must retain `review_required`; a production publisher is a separate, reviewed integration.
