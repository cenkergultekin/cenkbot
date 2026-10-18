<p align="center">
  <img src="assets/cenkbot.png" width="240" alt="Cenkbot, a soft cream-and-lavender character" />
</p>

<h1 align="center">cenkbot</h1>

<p align="center"><strong>A small chatbot that knows your work.</strong></p>

<p align="center">
  <a href="#get-started">Get started</a> ·
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

## Get started

Node.js 22 or newer.

```sh
git clone https://github.com/cenkergultekin/cenkbot.git
cd cenkbot
npm install
cp .env.example .env.local
```

Add your OpenRouter and Jev keys to `.env.local`, then:

```sh
npm start
```

Visit **http://localhost:3400**. The included fictional portfolio answers through local retrieval, Jev routing, one model reply and one reviewed rewrite. Without a Jev key, Cenkbot stays on retrieval and a single reply. Replace `content/` before publishing your own information.

## Make it yours

| Change | Where |
| --- | --- |
| Name, scope and conversation style | `content/profile.json` |
| Your work and experience | `content/*.md` |
| Model | `CENKBOT_MODEL` |
| Jev review | `CENKBOT_MODE=reviewed` and `TYPESAFE_API_KEY` |

Basic mode uses local RAG and one model response. Reviewed mode adds Jev routing and reply checks, with at most one sequential rewrite. Free models have provider limits; Jev has separate usage costs. [Choose your setup](docs/setup.md).

## Bring it to your website

```html
<script src="https://YOUR_CHAT_SERVICE/widget.js" defer></script>
<cenk-bot endpoint="https://YOUR_CHAT_SERVICE/api/chat" lang="en"></cenk-bot>
```

Allow your website’s exact origin in `CENKBOT_ALLOWED_ORIGINS`. Use `lang="tr"` for Turkish. The included service has request limits for a small, single-instance deployment.

Prefer your own interface? [Use the core or API](docs/integration.md).

## Contribute

Useful contributions make Cenkbot easier to install, integrate or talk to. Bug fixes, accessibility improvements and small examples are welcome. [Contribution guide](CONTRIBUTING.md).

MIT licensed. Made by [Cenker Gültekin](https://github.com/cenkergultekin).
