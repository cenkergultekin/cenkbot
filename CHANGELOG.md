# Changelog

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
