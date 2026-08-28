# Repository instructions

## Safety

- Never commit credentials, private source documents, production data, or internal URLs.
- Never publish content, deploy an application, submit an indexing request, or mutate an external account from tests or examples.
- The core pipeline must save `review_required` drafts only.
- Treat generation, human approval, publishing, deployment, and live search reflection as separate states.

## Architecture

- Keep `src/pipeline`, `src/audit`, `src/technical`, and `src/metrics` framework-neutral and free of runtime dependencies.
- Put domain rules in `ContentProfile` values, not hard-coded core branches.
- Put LLM, database, CMS, search-console, and social-network behavior behind adapters.
- Do not add platform checks to shared code using `if provider === ...`; prefer an adapter or profile.
- Preserve explicit metric denominators and use impression-weighted average position.

## Contributions

- Start by classifying a change as pipeline, audit, technical, metrics, adapter, example, or unknown.
- If the scope is unknown, do not edit files; report the missing information.
- Every behavior change requires a fixture or test.
- Run `npm run check` before reporting completion.
- Final reports must separately state implementation, validation, commit, push, deployment, publishing, and live reflection.
