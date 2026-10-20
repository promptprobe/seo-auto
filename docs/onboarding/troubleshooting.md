# Troubleshooting

Start with the command's exit status and the timestamp in the last output. An old report file can remain after a failed sync. Errors omit raw service responses and credentials by design.

| Symptom | Check / recovery |
| --- | --- |
| `npm` or `node` not found | Install Node.js, reopen the terminal, and check `node --version` and `npm --version` |
| Missing settings | Copy `.env.example` to `.env.local` in the repository root; run commands from that root |
| Unexpected settings after editing the file | Existing process environment variables override `.env.local`; remove the conflicting override |
| Google authentication failed | Confirm the credential file exists, is readable and belongs to the intended service account; create/download keys through your own Cloud Console |
| GSC HTTP 403 | Enable Search Console API in the credential's project; add the service-account email to the exact GSC property; check permission propagation |
| GSC HTTP 401 | Check the credential/key status and local clock; rotate a revoked key through Cloud Console |
| Property mismatch | Match domain vs URL-prefix identifiers exactly, including protocol, `www` and path |
| No finalized observations | Confirm the property and filters, then inspect its Performance report. A new or low-traffic site may have no data yet |
| Report `incomplete` | Some dates or metrics were not returned/valid. Do not fill missing days with invented zeroes |
| Report `stale` | The last observed finalized date is too old for the default freshness threshold; confirm the data source and recent traffic |
| All scores are null | Inspect freshness, date coverage, per-query impressions and observed days; the default is 20 impressions across three days |
| Low query coverage | The API omits some rows and anonymized queries. Returned query impressions need not equal property totals |
| HTTP 429 / rate limits | Wait before retrying. Avoid repeated full-window syncs; add caching before scheduling |
| WordPress HTTP 401 | Use an Application Password, not your normal sign-in password; check the username and whether the host forwards Authorization headers |
| WordPress HTTP 403 | Confirm the user's capabilities and whether a security plugin blocks REST reads; do not disable all security plugins to diagnose one request |
| WordPress HTML instead of JSON | Check the `/wp-json/` route, HTTPS domain and installation subdirectory; a host login or proxy may be intercepting it |
| Redirect error | Use the final canonical HTTPS URL directly. Credentials intentionally are not forwarded across redirects |
| Inventory remains incomplete | Confirm all posts/pages and non-public states are accessible; custom types or additional sites require an extended adapter |
| Draft not matched to its query | Configure the local `WORDPRESS_OWNERSHIP_FILE`; similar titles are not reliable matches |
| Every row says `investigate` | Compare GSC landing URLs with inventory canonical URLs, including headless frontend aliases |
| `wordpress-draft.json` is null | No scored new-article candidate exists. Check improvements and review queues instead |
| Preview port 8080 is in use | Stop the other local preview process before starting this one |
| Hosting shows library files / 404 | Build with `npm run onboarding:site` and publish only `site-dist` |
| Canonical points to example.com | Set the intended `SITE_URL` in the hosting environment and rebuild |
| Sitemap missing | It is deliberately absent while `SITE_INDEXABLE=false` |
| Published but not indexed | Inspect the real URL in Search Console; verify canonical/noindex/robots and allow time for crawling |

## Share a reproducible problem

Use invented fixtures and include:

- Node/npm versions, command and exit status;
- the short redacted error;
- expected vs actual behavior;
- whether the issue occurred in `demo`, `doctor`, `sync` or the public site build.

Do not attach `.env.local`, credential JSON, request headers, real query exports or private draft text to a public issue. Reproduce with reserved example domains and synthetic content instead.

Tests use fake HTTP responses. Passing tests proves the example contracts, not access to your own Google account, CMS or hosting project.
