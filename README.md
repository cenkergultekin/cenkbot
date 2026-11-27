<p align="center">
  <img src="assets/cenkbot.png" width="240" alt="Cenkbot, a soft cream-and-lavender character" />
</p>

<h1 align="center">cenkbot</h1>

<p align="center"><strong>A small chatbot that knows your work.</strong></p>

<p align="center">
  <a href="#add-it-to-your-website">Get started</a> ·
  <a href="docs/integration.md">Add it to your website</a> ·
  <a href="docs/setup.md">Make it yours</a>
</p>

Let visitors ask about your projects, experience and services. Cenkbot finds the relevant parts of your content and answers in your voice.

Built for personal websites, portfolios and small project pages. Bring your own content, choose a free or inexpensive model, and keep the experience on your own site.

## Small by design

**Your knowledge.** Add Markdown documents about your work. Local RAG finds relevant passages without an embedding service or vector database.

**Your voice.** Set the name, scope, language and conversation style. Keep replies warm, formal or neutral; brief or more detailed.

**Your budget.** Start with a single OpenRouter model. Enable Jev when you want routing, response checks and one bounded rewrite.

**Your website.** Use the drop-in widget, call the HTTP API, or bring the core into your own backend. API keys stay on the server.

## Add it to your website

Node.js 22 or newer. From your website's folder:

```sh
git clone https://github.com/cenkergultekin/cenkbot.git
cd cenkbot
npm run setup
```

A setup page opens in your browser. Pick an icon (or upload your own), a name, a color and the first message, describe yourself and your projects, add your [OpenRouter key](https://openrouter.ai/keys), and watch the real widget update next to the form. Ask it a question right there. Then press **Add to my site**:

- **Next.js (app router):** a chat route on your own domain, the widget in your root layout and keys in `.env.local`. Nothing else to host.
- **Any other site:** Cenkbot runs as a small Node service and the widget code goes into your page.

Prefer the terminal? `npm run setup:cli` asks the same questions. Running either again is safe.

**Using a coding agent?** Ask it: *"Set up Cenkbot on this site by following `cenkbot/setup/AGENT.md`."* It asks the questions, runs the setup and checks the result.

## Where things live

Everything the setup writes is a plain file you can edit by hand and commit (except keys).

| Folder or file | What it holds |
| --- | --- |
| `content/profile.json` | Name, scope, tone, answer length, language, status messages |
| `content/*.md` | What the bot knows. Add or edit Markdown files; restart to re-index |
| `content/widget.json` | Widget name, first message, input hint, color, position, icon file |
| `content/icon.*` | The widget icon chosen in setup |
| `config/bot.json` | Model limits: tokens, timeout, temperature |
| `.env.local` | Keys and model choice. Never commit it |
| `public/widget.js` | The widget itself, one dependency-free file |
| `src/` | The chatbot: retrieval, model reply, optional Jev review, HTTP service and route handler |
| `setup/` | The setup page, the terminal setup and the guide for coding agents |

## Try it on its own

```sh
npm install
cp .env.example .env.local
npm start
```

Add your keys to `.env.local` and visit **http://localhost:3400**. The included fictional portfolio answers through local retrieval and one model reply, plus Jev routing and review when a Jev key is present. The setup replaces this example content with yours.

## Make it yours

| Change | Where |
| --- | --- |
| Name, scope and conversation style | `content/profile.json` |
| Your work and experience | `content/*.md` |
| Model | `CENKBOT_MODEL` |
| Jev review | `CENKBOT_MODE=reviewed` and `TYPESAFE_API_KEY` |

Basic mode uses local RAG and one model response. Reviewed mode adds Jev routing and reply checks, with at most one sequential rewrite. Free models have provider limits; Jev has separate usage costs. [Choose your setup](docs/setup.md).

## Bring it to your website by hand

```html
<script src="https://YOUR_CHAT_SERVICE/widget.js" defer></script>
<cenk-bot endpoint="https://YOUR_CHAT_SERVICE/api/chat" lang="en" name="Ada's assistant" greeting="Hi! Ask me about my projects."></cenk-bot>
```

Allow your website's exact origin in `CENKBOT_ALLOWED_ORIGINS`. Use `lang="tr"` for Turkish. On a framework with Fetch API routes, `createChatHandler` gives you the same chat on your own domain. [Use the core, handler or API](docs/integration.md).

## Contribute

Useful contributions make Cenkbot easier to install, integrate or talk to. Bug fixes, accessibility improvements and small examples are welcome. [Contribution guide](CONTRIBUTING.md).

MIT licensed. Made by [Cenker Gültekin](https://github.com/cenkergultekin).
