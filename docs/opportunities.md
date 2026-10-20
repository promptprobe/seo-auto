# Observed-search content priorities

This module answers: which measured queries deserve editorial attention, and which existing content should receive it? It uses only supplied observations. Search-provider access, credentials, pagination, inventory retrieval and publishing belong in adapters.

## Input and evidence boundaries

- Use one site/property, country/device scope and search type throughout an input. Never combine worldwide and country-filtered data.
- Supply daily, finalized snapshots. The default window is 28 days ending on the provider's finalized date; the preceding 28 days supply comparisons. Days must be unique. Missing query/page dimensions, invalid metrics and duplicate dates make that day unusable.
- `queries` contains **property-level query totals**. `pages` contains query/page rows used only to locate landing pages. Summing page rows into query totals double-counts demand.
- `propertyImpressions` provides the denominator for query coverage. Search providers may omit anonymized queries and limit returned rows. Full date coverage does not imply exhaustive query coverage.
- An empty query result is unobserved, not evidence of zero market demand. An absent prior query remains `null`, even if the preceding date window is complete.
- Inventory includes drafts as well as published articles. List each canonical URL and any known aliases. Explicit `queries` are editorial ownership mappings, not guessed semantic matches. The caller may supply a language-specific `normalizeQuery` function; apply it consistently.
- Set `inventoryComplete` only after successful pagination. The core cannot verify this assertion. New-content recommendations are blocked otherwise.

For Google Search Console, use finalized Search Analytics data, keep `byProperty` query totals separate from `byPage` attribution, preserve the Pacific-time date boundary, and report API/privacy limits. See [Google's Search Analytics API contract](https://developers.google.com/webmaster-tools/v1/searchanalytics/query).

## Action rules

| Evidence | Action |
| --- | --- |
| One existing article owns the query explicitly or already receives its impressions | `improve` |
| Multiple published owners | `review_overlap` (a review candidate, not proof of cannibalization) |
| Existing draft owns the query | `review_draft` |
| Only known non-article landing pages; no known owner; complete inventory | `create` (review a new-article brief) |
| Attribution missing, unknown URL, or incomplete inventory | `investigate` |

An explicitly mapped hub is already an owner and receives `improve`. URL query parameters are preserved because they may identify distinct pages. No action automatically edits, merges, redirects, generates, approves or publishes anything.

## Score: observed-search-v1

A numeric score requires a full, fresh current window, at least 20 impressions and at least 3 distinct observed days. The default maximum finalized-data age is 7 days. These are configurable operating thresholds, not statistical significance claims.

| Component | Maximum weight | Computation |
| --- | ---: | --- |
| Observed demand | 50 | `log(1 + query impressions) / log(1 + largest eligible query impressions)` |
| Ranking window | 30 | Position 1–3: 0.2; >3–10: 1; >10–20: 0.8; >20–40: 0.4; >40: 0.1 |
| CTR gap | 20 | `max(0, 1 - query CTR / peer CTR)` |

Peer CTR is the impression-weighted CTR of **other queries** in the same position band, on this site and within this input scope. It requires at least 5 peers and 100 peer impressions. A zero peer CTR or inadequate peer sample leaves this component unavailable; it is not replaced with an industry benchmark. Available component points are divided by their available weights and scaled to 0–100. All component values and benchmark denominators are returned.

The formula prioritizes observed opportunities; it is not a search-engine metric. Scores are relative to this input population and are not comparable across properties or differently filtered reports. Position bands do not control for device, brand, intent or SERP features; use a coherent input scope and treat CTR gaps as review signals. `repeated` evidence means at least 100 impressions and 7 observed days, not a confidence interval. Below the minimum sample, stale data or an incomplete current window yields `score: null`.

Priority labels: high ≥70, medium ≥40, low <40, unscored when null. Compare current/prior impressions only when both date windows are complete and the query was observed in both. Changes are descriptive and do not establish the effect of a particular edit.

## Safe integration

Render the period, geography, last-sync time, coverage and score components. Present separate existing-content and new-content queues, retain draft/overlap/investigation states, and make candidate links open a reviewable editor/brief. Preserve the existing `review_required` pipeline contract. Synthetic fixtures and examples require no accounts and perform no external writes.
