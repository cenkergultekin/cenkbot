# Changelog

## 0.1.3 · 2026-10-17

- `policy@2`: a style-only concision miss may request a repair, but cannot suppress an otherwise usable answer after the configured repair limit. Grounding, language, context, non-answer and privacy failures remain blocking.
- Preserve `acceptedStyleOnly` in the trace instead of misrepresenting an exception as a clean judge pass.
- Regression cases cover soft-only acceptance and mixed hard/style rejection. Re-evaluate the same 36-case suite against 0.1.2 to measure the effect.

## 0.1.2 · 2026-10-17

- Preserve provider-reported billing for empty/truncated completions instead of losing it when marking the request failed.
- Add dated Jev list-price estimates from the official TypeSafe site; reserve budget before every query/judge call. Missing usage and error billing remain unknown.
- Keep human attempt-level scores on correction curves and clarify cost-per-passing-answer units.


## 0.1.1 · 2026-10-17

- Bounded offline experiment concurrency (`--concurrency 1–10`) with one shared reservation budget and serialized checkpoints. Each result is evaluated; no request races to answer a live user.
- Record concurrency as an experimental condition. Default remains one; latency comparisons require matching concurrency.
- Initial interrupted 0.1.0 live probe remains a private partial record, not a published benchmark.

## 0.1.0 · 2026-10-17

- Independent TypeScript chatbot core and authenticated HTTP service, derived from cenker.dev's engineering approach.
- One selected model after Jev routing; no provider race, speculative draft or automatic model/provider fallback.
- Configurable knowledge/scope and allowlisted tone, detail, language and capitalization preferences.
- Jev query and response gates with one sequential live repair; two-repair offline experiment.
- Ten catalog-verified model candidates, 36 public synthetic test cases, repeatable experiment variants and budget reservations.
- Versioned run metadata, objective grading, failure-inclusive latency/pass metrics, correction recovery/regression and human review import.
- Immutable public result preparation and benchmark filters for model, variant and previous compatible run.
- `/cenkbot` introduction and `/cenkbot/benchmark` pages with honest empty states.
- Offline CI, tests, operating limits and contribution documentation.

No real model benchmark has been run. No optimal default has been selected. RAG, retrieval indexes and tool-using agents are not implemented in this release.
