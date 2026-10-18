# Changelog

## 0.2.2 · 2026-10-18

- Run retrieval, Jev routing, one reply and one review when both API keys are present. Basic mode remains available without a Jev key or with `CENKBOT_MODE=basic`.

## 0.2.1 · 2026-10-18

- Keep a usable draft when its only defect is style and the single rewrite request fails. A hard defect is still withheld. No extra model is called.

## 0.2.0 · 2026-10-18

- Reframe Cenkbot as a reusable portfolio chatbot rather than a personal evaluation project.
- Add local document retrieval, an explicit four-step pipeline and a drop-in Cenkbot widget.
- Offer basic single-model RAG and optional Jev-reviewed replies with one bounded rewrite.
- Add server-side keys, exact-origin access, small-instance traffic limits and integration examples.
- Introduce the original Cenkbot icon as a transparent 3D README illustration.
- Move personal benchmarks and result presentation outside this repository. Maintainer `.github` and agent setup remain local and ignored.

Earlier 0.1.x experiments remain recoverable in Git history and in the maintainer’s separate research archive.
