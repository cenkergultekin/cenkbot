# Set up Cenkbot on a website (for coding agents)

You are adding Cenkbot, a small portfolio chatbot, to the website in the current workspace. People setting it up by hand use the visual setup (`npm run setup` in `cenkbot/`); you use the same setup script with an answers file. Follow these steps in order. Talk to the user in their language. Keep it short: one message with questions, one run, one report.

## Rules

- Never ask the user to paste an API key into the chat, never print a key, and never write one into a file the user did not ask for. Keys go only into the env file the setup names, and the user adds them there themselves unless they are already in your environment.
- Do not change unrelated code. The setup edits a fixed list of files and prints it; report that list.
- If the site already has a chat widget, ask before adding a second one.
- Running the setup twice is safe. It does not duplicate the widget.

## 1. Put Cenkbot in the site

Cenkbot lives in a `cenkbot/` folder at the website root. If it is not there yet:

```sh
git clone https://github.com/cenkergultekin/cenkbot.git cenkbot
```

Node.js 22 or newer is required (`node -v`).

## 2. Look at the site

The setup chooses the integration itself:

| The site | What the setup does |
| --- | --- |
| Next.js with the app router (`app/` or `src/app/`) | Adds `cenkbot` as a local dependency, creates `app/api/cenkbot/route`, copies the widget to `public/cenkbot/`, adds the widget to the root layout, writes keys to the site's `.env.local`. Same origin, nothing else to host. |
| Anything else (static HTML, other frameworks, Next.js pages router) | Cenkbot runs as its own small Node service. The setup writes the widget snippet into `index.html` when it finds one, otherwise into `cenkbot/site-snippet.html`, and writes keys to `cenkbot/.env.local`. |

Read the site's existing about page, README or project list. You will use it to suggest answers.

## 3. Ask the user

Ask everything in one message. Offer the suggestions you drafted from the site so the user can simply confirm.

| Answer | Meaning | Default |
| --- | --- | --- |
| `language` | Reply language: `tr` or `en` | the site's language |
| `owner` | Whose site this is (name or brand) | required |
| `botName` | Name shown in the widget | "{owner}'s assistant" / "{owner} asistanı" |
| `about` | One or two sentences about the owner and their work | required |
| `projects` | List of `{ "name", "summary", "url"? }` | empty |
| `contact` | Public email or link | empty |
| `tone` | `warm`, `formal` or `neutral` | `warm` |
| `detail` | `brief` or `balanced` | `brief` |
| `siteUrl` | Public site address, used to allow the widget's origin | empty |
| `serviceUrl` | Only for the service integration: where Cenkbot will be hosted | `http://localhost:3400` |
| `model` | OpenRouter model ID | `openrouter/free` |
| `review` | Jev reply review on or off (needs a Jev key) | `false` |
| `contentDir` | Optional folder of Markdown files with more public information | none |
| `icon` | `cenkbot`, `bubble`, `spark`, `letter` (first letter of the owner) or a path to a PNG, JPEG, SVG or WebP under 512 KB | `cenkbot` |
| `accent` | Widget color, `#rrggbb` | `#5b4bd6` |
| `position` | `right` or `left` | `right` |
| `greeting` | First message in the chat | a short hello in the chosen language |

Also ask whether they already have an OpenRouter key (https://openrouter.ai/keys). Do not ask for its value.

Only public information belongs in these answers. Anything the chatbot knows, any visitor can read.

## 4. Write the answers and run the setup

Write `cenkbot.answers.json` at the site root, without keys:

```json
{
  "language": "en",
  "owner": "Deniz Kaya",
  "about": "Deniz builds small, accessible web tools.",
  "projects": [{ "name": "Tiny Atlas", "summary": "A map of quiet cafes", "url": "https://example.com/atlas" }],
  "contact": "hello@example.com",
  "siteUrl": "https://deniz.example",
  "review": false
}
```

Preview, then run:

```sh
node cenkbot/setup/cli.mjs --answers cenkbot.answers.json --dry-run --skip-install
node cenkbot/setup/cli.mjs --answers cenkbot.answers.json
```

The run installs and builds Cenkbot, wires the site, checks the content and prints the changed files and any remaining step. If it stops with an error, fix the cause it names and run it again. Delete `cenkbot.answers.json` afterwards.

## 5. Keys

The setup leaves `OPENROUTER_API_KEY=replace-with-your-key` in the env file it names when no key was in the environment. Tell the user exactly which file and line to edit. Check that the line no longer contains `replace-with`, without printing the value. With `review: true`, the same applies to `TYPESAFE_API_KEY`.

## 6. Check it works

Next.js:

```sh
npm run dev
curl -s -X POST http://localhost:3000/api/cenkbot -H "Content-Type: application/json" -d '{"turns":[{"role":"user","content":"What are your projects?"}]}'
```

Expect `200` with a `text` answer. `503 chat_unconfigured` means the key is missing. Open the site: a chat bubble sits at the bottom right and greets the visitor.

Service:

```sh
cd cenkbot && npm start
curl -s http://localhost:3400/api/health
```

Expect `"chatConfigured": true`. Open the site; the bubble talks to the service. A `403` from `/api/chat` means the site's exact origin is missing from `CENKBOT_ALLOWED_ORIGINS` in `cenkbot/.env.local`.

## 7. Before publishing

- Next.js on Vercel or another serverless host: add the `outputFileTracingIncludes` line the setup printed to `next.config`, so `cenkbot/content` and `cenkbot/config` ship with the route. Add the same keys to the host's environment settings.
- Service: deploy `cenkbot/` to any Node.js 22 host with `HOST=0.0.0.0` behind HTTPS, set the keys and `CENKBOT_ALLOWED_ORIGINS` there, and make sure `serviceUrl` matches.
- Set a spending limit on the OpenRouter account.

## 8. Report

Tell the user, briefly: which integration was used, the changed files, whether the key is in place, the result of the check, and anything left for publishing. To change answers later, edit `cenkbot/content/` or run the setup again.
