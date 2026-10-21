# Changelog

## 0.3.0 · 2026-10-21

- Add `npm run setup`: put Cenkbot in a `cenkbot/` folder of a website, answer a few questions and it writes your content, builds, and wires the site. Next.js app router sites get a same-origin route and the widget in the root layout; other sites get the service and a widget snippet. An answers file lets coding agents run it without prompts; keys are never part of it.
- Add `setup/AGENT.md`, a step-by-step guide for coding agents that set Cenkbot up for a user.
- Add `createChatHandler`, a Fetch API chat route with the same validation and visitor limits as the service.
- `createPortfolioBot` and `loadSettings` accept a content root. The default root no longer uses a bundler-sensitive URL, so Next.js webpack builds can import Cenkbot.
- The widget takes `name`, `greeting` and `placeholder` attributes.

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
