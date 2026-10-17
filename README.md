# cenkbot

Small chatbots. Measurable improvements.

Cenkbot is a TypeScript chatbot service with versioned experiments for answer quality, latency and cost. It grew out of the assistant on [cenker.dev](https://cenker.dev). Configure a knowledge profile and speaking style, choose a model, then measure every change against a fixed evaluation suite.

**Status:** development foundation, `0.1.3`. Ten model candidates are selected from a dated OpenRouter catalog snapshot. No optimal-model claim has been published. The default model is provisional. RAG and tool-using agents are future work.

## Run locally

Node.js 22 or later:

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

Visit `http://127.0.0.1:3400/cenkbot` and `/cenkbot/benchmark`. Pages work without credentials and explicitly show when measurements are missing. The benchmark presents three focused comparisons: models, response review, and releases; one chart is visible per section.

Chat requires `OPENROUTER_API_KEY`, `TYPESAFE_API_KEY` and `CENKBOT_SERVICE_TOKEN` in the process environment. The server never reads secret files. Keep credentials on the server. Use a random service token of at least 24 characters. Requests use `Authorization: Bearer <service-token>`.

```http
POST /v1/chat
Authorization: Bearer <service-token>
Content-Type: application/json

{"turns":[{"role":"user","content":"Atlas hangi şehirde?"}],"style":{"tone":"formal","detail":"brief","language":"tr"}}
```

The public fixture is an explicitly fictional bicycle workshop. No biography, production messages or database from cenker.dev is included.

## One request at a time

Whole-message greetings use a configured reply. Other messages go through the Jev query gate before a single selected model generates a draft. The response gate can ask for one sequential repair. A failed model does not start a second model or provider. There is no speculative generation or provider race. OpenRouter provider fallback is disabled.

The optional `reasoningModel` is chosen before generation, only for high-confidence reasoning requests. It is unset by default. Runtime routing decisions and offline model comparisons are separate.

## Measure a change

```sh
# No API calls, inspect workload first.
npm run eval -- --plan

# Offline pipeline smoke test, never a publishable benchmark.
npm run eval -- --mock --models openai/gpt-6-luna --repeats 1

# Real comparison across ten models, no Jev calls in this baseline.
npm run eval -- --variants baseline --repeats 3 --budget-usd 1

# Full system: Jev list-price estimates are included in the reservation budget.
npm run eval -- --variants baseline,query,guarded,repair --repeats 3 --budget-usd 1

# Prepare public results after inspecting the synthetic fixture run.
npm run benchmark:publish -- eval/runs/<id>/run.json

# Compare matching suites and evaluators across versions.
npm run benchmark:compare -- eval/runs/<old>/run.json eval/runs/<new>/run.json
```

On PowerShell systems whose `npm.ps1` wrapper consumes CLI arguments, use `npm.cmd run eval -- ...` or `node node_modules/tsx/dist/cli.mjs src/eval/cli.ts ...`.

Live model calls are sequential. Offline eval can use `--concurrency 1–10` to process independent scored experiments; the default is one. This never races redundant calls to serve a user. Concurrency is recorded and must match for latency comparisons. Interrupted/budget-limited runs remain partial and cannot masquerade as complete benchmarks. Raw run files are ignored by Git; reviewed public experiments are append-only in `eval/public.json` (schema 1). The benchmark browser receives an aggregate-only projection through `/cenkbot/data.json` (presentation schema 2), without response texts or request traces; no live inference is involved.

## Customize

- `eval/profile.json`: knowledge, scope, fixed replies and default tone/detail/language.
- `eval/config.json`: selected model, gate policy, token/time limits and repair budget.
- `eval/models.json`: ten candidates, optional pinned provider and dated token-price snapshot. `npm run models` refreshes prices without selecting a winner.
- `eval/suite.json`: public regression questions, conversation history and objective checks.

Speaking preferences are allowlisted. They cannot replace system instructions or knowledge. API clients cannot choose arbitrary models, repair budgets or prompts.

## Documentation

- [Design, prompts, Jev and speaking style](docs/design.md)
- [Evaluation, correction curves and versioning](docs/evaluation.md)
- [Initial real experiments and known limitations](docs/first-results.md)
- [Deployment and cenker.dev integration](docs/operations.md)
- [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [MIT license](LICENSE)

Preliminary real results include a ten-model baseline and three-model Jev/repair experiments. The 0.1.3 rerun encountered OpenRouter access/quota failures and cannot establish the correction's live quality gain. Next: a dedicated evaluation key, repeated runs and independent human review. Retrieval will later be evaluated independently from answer generation.
