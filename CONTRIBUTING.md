# Contributing to seo-auto

Thanks for helping improve `seo-auto`. Contributions should be evidence-backed, reproducible, and safe to run without production credentials.

## Beginner path

1. Open a fixture issue using the repository template.
2. Describe the observed behavior, source, observation date, and expected result.
3. Add the smallest failing test that represents the case.
4. Change only the module responsible for that behavior.
5. Run `npm run check`.
6. Open a pull request and leave publishing or deployment to a maintainer.

You do not need to design a new abstraction for a first contribution. A high-quality failing fixture is useful by itself.

## Scope

- Reusable orchestration belongs in `src/pipeline`.
- Pure validation belongs in `src/audit` or `src/technical`.
- Search metric math belongs in `src/metrics`.
- Provider, CMS, or channel examples belong in `examples` until a stable adapter contract exists.
- Domain keyword lists, regulated-content rules, private prompts, and brand data do not belong in the core.

## Pull request requirements

- No secrets, tokens, private URLs, customer data, or proprietary source documents.
- No automatic public publishing or external account mutation.
- Add or update tests for behavior changes.
- Preserve the draft-first `review_required` boundary.
- Explain input, expected output, actual output before the change, and risk.
- Separate local validation from commit, push, deployment, publishing, and live search results.

## Local checks

```bash
npm install
npm run check
npm run example
```

## Commit style

Use a short imperative subject, for example:

```text
feat: add canonical URL audit
fix: reject unsupported metadata numbers
test: add multilingual normalization fixture
docs: explain channel adapter boundaries
```
