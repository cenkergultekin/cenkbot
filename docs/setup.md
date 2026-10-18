# Make Cenkbot yours

## Add your content

Edit `content/profile.json`: the assistant’s name, scope, default style and short status messages. Put public project descriptions, your experience and contact details in `content/*.md`. The included Ada portfolio is fictional.

Documents are indexed locally at startup. Restart after editing them. Use short, factual headings and the words visitors would naturally ask about. The default retriever searches words with a small BM25-style index; it is not semantic embedding search. Unknown facts should remain unknown.

Only public content belongs here. Markdown is source data, not executable instructions. Retrieval does not itself guarantee factual answers.

## Choose a model

Set `CENKBOT_MODEL` to an available OpenRouter model ID. The default `openrouter/free` selects an available free model through OpenRouter; pin a specific model for more predictable behavior. See [OpenRouter’s model catalog](https://openrouter.ai/models).

There is one selected generation request. No speculative drafts, provider race or automatic fallback. Limits and free-model availability belong to the provider and can change. Set account-level spending limits with your provider.

## Choose review

With `OPENROUTER_API_KEY` and `TYPESAFE_API_KEY` set, Cenkbot runs retrieval, Jev routing, one model reply, Jev review and at most one rewrite. Missing or unavailable Jev fails closed. Grounding, language, context and privacy defects block the reply. A concision-only defect may be accepted when the rewrite cannot improve it. Jev checks are probabilistic, not a correctness guarantee.

Set `CENKBOT_MODE=basic` for retrieval and one reply only. That is also the automatic mode when the Jev key is absent.

## Conversation style

`content/profile.json` supports `tone` (`warm`, `formal`, `neutral`), `detail` (`brief`, `balanced`), `language` (`tr`, `en`) and `lowercase`. Per-request style preferences use the same allowlist; they cannot replace the system prompt or knowledge.

## Deploy a small service

Run `npm start` with environment variables on a Node.js 22 host. Set `HOST=0.0.0.0` when your host requires public binding and serve it behind HTTPS. For a widget on another domain, set `CENKBOT_ALLOWED_ORIGINS` to exact comma-separated HTTP(S) origins. Keys remain server-side.

The public `/api/chat` route permits six requests per minute per direct connection IP and 100 requests per UTC day across the process, with two concurrent answers. Limits reset when the process restarts and are not distributed. Behind a proxy, visitors may share its connection IP. Use your host’s trusted rate limiter when you scale or run multiple instances. Set `CENKBOT_PUBLIC_CHAT=false` to disable this route.

`/v1/chat` is for a trusted backend and requires `CENKBOT_SERVICE_TOKEN` with at least 24 random characters. It shares the concurrency limit; enforce visitor budgets in your integrating backend. `/api/health` exposes readiness without keys or conversation content.

No conversation persistence is enabled. The browser widget keeps its history in memory until the page is closed or refreshed.
