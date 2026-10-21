# Add Cenkbot to your site

The quickest way is `npm run setup` inside the `cenkbot/` folder of your website, or let a coding agent follow [`setup/AGENT.md`](../setup/AGENT.md). This page explains the pieces the setup uses.

## Same-origin route

`createChatHandler` returns a `(request: Request) => Promise<Response>` handler for any framework with Fetch API routes. It loads your content lazily, validates turns and style, limits visitors (six requests per minute per forwarded IP, 100 per day, two at a time) and returns only `text`, `status`, `version` and source titles.

```ts
// app/api/cenkbot/route.ts (Next.js app router)
import path from "node:path";
import { createChatHandler } from "cenkbot";

export const runtime = "nodejs";
export const POST = createChatHandler({ root: path.join(process.cwd(), "cenkbot") });
```

Add `cenkbot` as a local dependency (`"cenkbot": "file:./cenkbot"`) after building it. Point the widget at the route: `<cenk-bot endpoint="/api/cenkbot">`. Limits live in memory, so they are per server instance.

## Widget

Host the included service, then add the script and element from the README. The widget uses the same original Cenkbot icon as cenker.dev. It isolates its styles, renders replies as plain text, supports keyboard closing, and keeps API keys out of the browser.

The `endpoint` attribute can point to your own same-origin route or the service’s public `/api/chat` route. `name` sets the title, `greeting` the first message and `placeholder` the input hint. A cross-domain service must allow your website’s exact origin. The `lang` attribute selects English or Turkish UI and reply preference.

## Inside your backend

After cloning and building, import the core into a server-side JavaScript or TypeScript project:

```ts
import { createPortfolioBot } from './dist/index.js';

const bot = await createPortfolioBot();
const answer = await bot.answer({
  turns: [{ role: 'user', content: 'What is Pocket Garden?' }],
  style: { language: 'en', tone: 'warm' },
});

console.log(answer.text);
```

Set `CENKBOT_ROOT` to your content/config directory when integrating outside this checkout. The package has not been published to npm; use the source checkout or your own build. The example [server-side route](../examples/next-route.ts) shows a same-origin API bridge.

## Bring your own retrieval

`createBot` accepts a `Retriever` with an async `retrieve({ message, history, signal })` method. Return `{ id, title, text, url? }` sources. The pipeline takes at most three snippets and bounds the context; only HTTP(S) source URLs are kept. Replace the local retriever with a database or semantic index without replacing the chatbot engine.

```ts
import { createLocalRetriever } from './dist/index.js';

const retriever = createLocalRetriever([
  { id: 'project', title: 'Pocket Garden', text: 'Pocket Garden tracks plant care.' },
]);
// Pass retriever, your config/profile and generator to createBot.
```

## Small, explicit steps

| Step | Responsibility |
| --- | --- |
| `src/steps/route.ts` | Optional Jev scope/routing decision |
| `src/steps/retrieve.ts` | Find and bound relevant portfolio passages |
| `src/steps/respond.ts` | Generate one answer with the selected model |
| `src/steps/review.ts` | Optional Jev reply check |

`src/engine.ts` connects these steps and permits one explicit sequential rewrite. `src/server.ts` handles HTTP, origins, request limits and visitor-safe responses. `src/provider.ts` is the OpenRouter adapter. Personal benchmarks and analysis tools live outside this product repository.

## HTTP

POST `{ turns, style? }` to `/api/chat` or authenticated `/v1/chat`. The response includes `text`, `status`, `version` and metadata for the retrieved `sources`. Sources describe passages supplied to the model, not verified citations or proof that every claim used them. Drafts, source text, gate signals and keys are not returned to visitors.
