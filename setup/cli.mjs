#!/usr/bin/env node
/* Cenkbot setup: put this folder inside your website, answer a few questions, and Cenkbot is wired into the site.
 * Interactive:      npm run setup
 * From an answers file (for coding agents and CI):  npm run setup -- --answers cenkbot.answers.json [--skip-install] [--dry-run]
 * Other flags: --content-only (write content and appearance, do not touch the website), --json (one JSON summary on stdout; used by the setup studio).
 * The visual setup studio (npm run setup) calls this script with --answers --json.
 * API keys are never asked for in the answers file. They come from the environment, an interactive hidden prompt, or are left as placeholders.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout, env, argv, exit, platform } from "node:process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const bot = resolve(here, "..");
const args = new Map();
for (let i = 2; i < argv.length; i += 1) {
  const key = argv[i];
  if (!key.startsWith("--")) continue;
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) { args.set(key.slice(2), next); i += 1; } else args.set(key.slice(2), true);
}
const dry = args.has("dry-run");
const written = [];
const notes = [];

const read = file => readFileSync(file, "utf8");
const json = file => JSON.parse(read(file));
const write = (file, text) => {
  written.push(relative(process.cwd(), file) || file);
  if (dry) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const posix = path => path.split(sep).join("/");
const quiet = args.has("json");
const say = (...parts) => { if (!quiet) console.log(...parts); };
const fail = message => { console.error(`\ncenkbot setup: ${message}`); exit(1); };

/* ---------- appearance ---------- */
const ICONS = ["cenkbot", "bubble", "spark", "letter"];
const IMAGE = /\.(svg|png|jpe?g|webp)$/i;
function appearance(given, a) {
  const look = {
    icon: String(given.icon ?? "cenkbot"),
    accent: String(given.accent ?? "#5b4bd6"),
    position: String(given.position ?? "right"),
    greeting: String(given.greeting ?? "").trim(),
    placeholder: String(given.placeholder ?? "").trim(),
  };
  if (!ICONS.includes(look.icon) && !(IMAGE.test(look.icon) && existsSync(resolve(look.icon)))) fail(`icon must be one of ${ICONS.join(", ")} or an existing image file`);
  if (!/^#[0-9a-f]{6}$/i.test(look.accent)) fail("accent must be a #rrggbb color");
  if (!["left", "right"].includes(look.position)) fail("position must be left or right");
  if (look.greeting.length > 400 || look.placeholder.length > 80) fail("greeting or placeholder is too long");
  look.greeting ||= a.language === "tr" ? `Merhaba! ${a.owner} hakkında, projeleri ve deneyimi üzerine sorabilirsin.` : `Hi! Ask me about ${a.owner}'s projects and experience.`;
  return look;
}
const escapeXml = text => text.replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]);
function writeIcon(look, a) {
  const content = join(bot, "content");
  if (!dry) for (const name of existsSync(content) ? readdirSync(content) : []) if (/^icon\./.test(name)) rmSync(join(content, name));
  if (look.icon === "letter") {
    const letter = escapeXml((a.owner.trim()[0] || "C").toLocaleUpperCase(a.language === "tr" ? "tr-TR" : "en"));
    write(join(content, "icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${look.accent}"/><text x="32" y="43" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="30" font-weight="600" fill="#fff">${letter}</text></svg>\n`);
    return "icon.svg";
  }
  const from = ICONS.includes(look.icon) ? join(bot, "assets/icons", `${look.icon}.svg`) : resolve(look.icon);
  const name = `icon${from.slice(from.lastIndexOf(".")).toLowerCase()}`;
  written.push(`content/${name}`);
  if (!dry) { mkdirSync(content, { recursive: true }); copyFileSync(from, join(content, name)); }
  return name;
}
// Entity-escaped attribute values are valid in HTML and in JSX string attributes alike.
const attr = value => `"${escapeXml(String(value))}"`;
function element(widget, a, endpoint, icon) {
  const parts = [`endpoint="${endpoint}"`, `lang="${a.language}"`, `name=${attr(widget.name)}`, `greeting=${attr(widget.greeting)}`, `icon="${icon}"`, `accent="${widget.accent}"`];
  if (widget.position !== "right") parts.push(`position="${widget.position}"`);
  if (widget.placeholder) parts.push(`placeholder=${attr(widget.placeholder)}`);
  return `<cenk-bot ${parts.join(" ")}></cenk-bot>`;
}

/* ---------- answers ---------- */
const QUESTIONS = [
  ["language", "Reply language (tr or en)", "en", v => ["tr", "en"].includes(v)],
  ["owner", "Whose website is this? (your name or brand)", "", v => v.length > 0 && v.length <= 80],
  ["botName", "Assistant name shown in the widget", "", v => v.length > 0 && v.length <= 60],
  ["about", "One or two sentences about you and your work", "", v => v.length > 0 && v.length <= 2000],
  ["projects", "Projects, separated by ; (name: short description)", "", v => v.length <= 4000],
  ["contact", "Public contact (email or link), or leave empty", "", v => v.length <= 300],
  ["tone", "Tone (warm, formal, neutral)", "warm", v => ["warm", "formal", "neutral"].includes(v)],
  ["detail", "Answer length (brief, balanced)", "brief", v => ["brief", "balanced"].includes(v)],
  ["siteUrl", "Your website address (https://...), or leave empty", "", v => !v || /^https?:\/\/[^\s/]+/.test(v)],
  ["model", "OpenRouter model", "openrouter/free", v => /^[\w./:-]{3,128}$/.test(v)],
  ["review", "Turn on Jev review? Needs a Jev key (yes or no)", "no", v => ["yes", "no"].includes(v)],
];

async function collect() {
  if (args.has("answers")) {
    const file = resolve(String(args.get("answers")));
    if (!existsSync(file)) fail(`answers file not found: ${file}`);
    const given = json(file);
    const answers = { ...given };
    for (const [key, , fallback, valid] of QUESTIONS) {
      let value = given[key];
      if (key === "projects" && Array.isArray(value)) value = value.map(p => typeof p === "string" ? p : [p.name, p.summary].filter(Boolean).join(": ") + (p.url ? ` (${p.url})` : "")).join("; ");
      if (key === "review" && typeof value === "boolean") value = value ? "yes" : "no";
      value = value === undefined || value === null ? fallback : String(value).trim();
      if (key === "botName" && !value && given.owner) value = given.language === "tr" ? `${given.owner} asistanı` : `${given.owner}'s assistant`;
      if (!valid(value)) fail(`answer "${key}" is missing or invalid`);
      answers[key] = value;
    }
    return answers;
  }
  if (!stdin.isTTY) fail("no terminal for questions; run with --answers <file>");
  const rl = createInterface({ input: stdin, output: stdout });
  const answers = {};
  console.log("\nCenkbot setup. Press enter to keep the value in brackets.\n");
  for (const [key, label, fallback, valid] of QUESTIONS) {
    let suggestion = fallback;
    if (key === "botName" && answers.owner) suggestion = answers.language === "tr" ? `${answers.owner} asistanı` : `${answers.owner}'s assistant`;
    for (;;) {
      const value = (await rl.question(`${label}${suggestion ? ` [${suggestion}]` : ""}: `)).trim() || suggestion;
      if (valid(value)) { answers[key] = value; break; }
      console.log("  Please try again.");
    }
  }
  rl.close();
  return answers;
}

async function secret(name, label) {
  if (env[name]) return env[name];
  if (args.has("answers") || !stdin.isTTY) return null;
  stdout.write(`${label} (hidden, leave empty to add later): `);
  stdin.setRawMode?.(true);
  let value = "";
  for await (const chunk of stdin) {
    const text = String(chunk);
    if (text === "\r" || text === "\n" || text === "\r\n") break;
    if (text === "\u0003") { stdin.setRawMode?.(false); exit(1); }
    if (text === "\u007f" || text === "\b") value = value.slice(0, -1); else value += text;
  }
  stdin.setRawMode?.(false);
  stdin.pause();
  stdout.write("\n");
  return value.trim() || null;
}

/* ---------- the website ---------- */
function inspect(site) {
  const pkgFile = join(site, "package.json");
  const pkg = existsSync(pkgFile) ? json(pkgFile) : null;
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const appDir = ["app", "src/app"].map(dir => join(site, dir)).find(dir => existsSync(dir));
  const manager = existsSync(join(site, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(site, "yarn.lock")) ? "yarn" : existsSync(join(site, "bun.lockb")) || existsSync(join(site, "bun.lock")) ? "bun" : "npm";
  const typescript = existsSync(join(site, "tsconfig.json"));
  const html = ["index.html", "public/index.html", "src/index.html"].map(file => join(site, file)).find(file => existsSync(file));
  const kind = deps.next && appDir ? "next" : "service";
  return { pkg, pkgFile, appDir, manager, typescript, html, kind, hasNext: !!deps.next };
}

/* ---------- content ---------- */
function writeContent(a, look) {
  const tr = a.language === "tr";
  const profileFile = join(bot, "content/profile.json");
  const profile = json(profileFile);
  profile.id = (a.owner.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "site").slice(0, 60);
  profile.name = a.botName;
  profile.scope = tr
    ? `${a.owner} adlı kişinin ya da markanın herkese açık işleri, projeleri, deneyimi ve iletişim bilgisi. Selamlaşma ve sıradan sohbet de olur.`
    : `${a.owner}'s public work, projects, experience and contact. Ordinary greetings and social conversation are welcome.`;
  profile.knowledge = "Only the owner profile and retrieved public documents may support factual claims. Unknown facts stay unknown.";
  profile.style = { tone: a.tone, detail: a.detail, language: a.language, lowercase: false };
  profile.greeting = {
    tr: `Merhaba! ${a.owner} hakkında, projeleri ve deneyimi üzerine konuşabiliriz.`,
    en: `Hi! Ask me about ${a.owner}'s projects and experience.`,
  };
  profile.refusal = {
    tr: `${a.owner} ile ilgili işler ve deneyim hakkında yardımcı olabilirim.`,
    en: `I can help with ${a.owner}'s work and experience.`,
  };
  write(profileFile, JSON.stringify(profile, null, 2) + "\n");

  const content = join(bot, "content");
  const example = existsSync(join(content, "about.md")) && /fictional/i.test(read(join(content, "about.md")));
  if (example && !dry) for (const name of readdirSync(content)) if (name.endsWith(".md")) rmSync(join(content, name));
  const about = [`# ${tr ? "Hakkında" : "About"} ${a.owner}`, "", a.about];
  if (a.contact) about.push("", `${tr ? "İletişim" : "Contact"}: ${a.contact}`);
  write(join(content, "about.md"), about.join("\n") + "\n");
  const projects = a.projects.split(";").map(part => part.trim()).filter(Boolean);
  if (projects.length) {
    const lines = [`# ${tr ? "Projeler" : "Projects"}`, ""];
    for (const project of projects) {
      const [name, ...rest] = project.split(":");
      lines.push(`## ${name.trim()}`, "", rest.join(":").trim() || name.trim(), "");
    }
    write(join(content, "projects.md"), lines.join("\n"));
  } else if (existsSync(join(content, "projects.md")) && !dry) rmSync(join(content, "projects.md"));
  const widget = { name: a.botName, greeting: look.greeting, placeholder: look.placeholder, accent: look.accent, position: look.position, icon: writeIcon(look, a) };
  write(join(content, "widget.json"), JSON.stringify(widget, null, 2) + "\n");
  // The answers without keys, so the studio and a later run can start from them.
  const saved = { language: a.language, owner: a.owner, botName: a.botName, about: a.about, contact: a.contact, tone: a.tone, detail: a.detail, siteUrl: a.siteUrl, serviceUrl: a.serviceUrl ?? "", model: a.model, review: a.review === "yes",
    projects: projects.map(project => { const [name, ...rest] = project.split(":"); const summary = rest.join(":").trim(); const url = /\((https?:[^)\s]+)\)\s*$/.exec(summary)?.[1] ?? ""; return { name: name.trim(), summary: url ? summary.slice(0, summary.lastIndexOf("(")).trim() : summary, url }; }),
    icon: ICONS.includes(look.icon) ? look.icon : "custom", accent: look.accent, position: look.position, greeting: look.greeting, placeholder: look.placeholder };
  write(join(content, "answers.json"), JSON.stringify(saved, null, 2) + "\n");
  if (a.contentDir) {
    const from = resolve(String(a.contentDir));
    if (!existsSync(from)) fail(`contentDir not found: ${from}`);
    for (const name of readdirSync(from).filter(n => n.endsWith(".md")).slice(0, 60)) {
      written.push(`content/${name}`);
      if (!dry) copyFileSync(join(from, name), join(content, name));
    }
  }
}

/* ---------- keys and environment ---------- */
// Settings are always updated; a null value removes the line. A key in `keep` that already holds a real value is left alone.
function mergeEnv(file, values, keep = new Set()) {
  const existing = existsSync(file) ? read(file) : "";
  let lines = existing ? existing.split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const index = lines.findIndex(line => line.startsWith(`${key}=`));
    if (value === null) { if (index >= 0) lines = lines.filter((_, i) => i !== index); continue; }
    if (index >= 0) { if (keep.has(key) && !lines[index].includes("replace-with")) continue; lines[index] = `${key}=${value}`; }
    else lines.push(`${key}=${value}`);
  }
  write(file, lines.filter((line, i) => line || i < lines.length - 1).join("\n") + "\n");
}
function ignoreEnv(site) {
  const file = join(site, ".gitignore");
  const text = existsSync(file) ? read(file) : "";
  if (/^\.env\*|^\.env\.local$/m.test(text)) return;
  write(file, text + (text && !text.endsWith("\n") ? "\n" : "") + ".env.local\n");
}

/* ---------- commands ---------- */
function run(command, list, cwd) {
  if (dry) { notes.push(`would run: ${command} ${list.join(" ")} (in ${relative(process.cwd(), cwd) || "."})`); return; }
  const result = spawnSync(command, list, { cwd, stdio: quiet ? ["ignore", "ignore", "pipe"] : "inherit", shell: platform === "win32", encoding: "utf8" });
  if (result.status !== 0) fail(`${command} ${list.join(" ")} failed in ${cwd}${result.stderr ? `: ${result.stderr.trim().split("\n").slice(-3).join(" ")}` : ""}`);
}

/* ---------- Next.js, same origin ---------- */
function wireNext(site, info, a, widget) {
  const folder = posix(relative(site, bot));
  const pkg = info.pkg;
  pkg.dependencies = { ...pkg.dependencies, cenkbot: `file:./${folder}` };
  write(info.pkgFile, JSON.stringify(pkg, null, 2) + "\n");

  const ext = info.typescript ? "ts" : "js";
  write(join(info.appDir, "api/cenkbot", `route.${ext}`), [
    "// Cenkbot chat route. Answers stay on your server; keys come from .env.local.",
    'import path from "node:path";',
    'import { createChatHandler } from "cenkbot";',
    "",
    'export const runtime = "nodejs";',
    'export const dynamic = "force-dynamic";',
    `export const POST = createChatHandler({ root: path.join(process.cwd(), ${JSON.stringify(folder)}) });`,
    "",
  ].join("\n"));

  const publicDir = join(site, "public/cenkbot");
  if (!dry && existsSync(publicDir)) for (const name of readdirSync(publicDir)) if (/^icon\./.test(name)) rmSync(join(publicDir, name));
  for (const [from, to] of [["public/widget.js", "public/cenkbot/widget.js"], ["assets/cenkbot.svg", "public/cenkbot/cenkbot.svg"], [`content/${widget.icon}`, `public/cenkbot/${widget.icon}`]]) {
    written.push(to);
    if (!dry) { mkdirSync(dirname(join(site, to)), { recursive: true }); copyFileSync(join(bot, from), join(site, to)); }
  }

  const tag = element(widget, a, "/api/cenkbot", `/cenkbot/${widget.icon}`);
  const layout = ["layout.tsx", "layout.jsx", "layout.js", "layout.ts"].map(name => join(info.appDir, name)).find(file => existsSync(file));
  let patched = false;
  if (layout) {
    let text = read(layout);
    if (text.includes("<cenk-bot")) {
      const updated = text.replace(/<cenk-bot\b[^>]*><\/cenk-bot>/, tag);
      if (updated !== text) write(layout, updated);
      patched = true;
    } else if (text.includes("</body>")) {
      if (!/from ["']next\/script["']/.test(text)) text = `import Script from "next/script";\n${text}`;
      const at = text.indexOf("</body>");
      const lineStart = text.lastIndexOf("\n", at) + 1;
      const indent = /^[ \t]*/.exec(text.slice(lineStart))[0];
      const inner = `${indent}  `;
      const lead = text.slice(lineStart, at).trim() ? `\n${inner}` : "  ";
      text = `${text.slice(0, at)}${lead}<Script src="/cenkbot/widget.js" strategy="lazyOnload" />\n${inner}${tag}\n${indent}${text.slice(at)}`;
      write(layout, text);
      patched = true;
    }
  }
  if (info.typescript) {
    // Keep the site's type check and lint away from Cenkbot's own sources; the site uses the built package.
    const tsconfig = join(site, "tsconfig.json");
    try {
      const config = json(tsconfig);
      config.exclude = [...new Set([...(config.exclude ?? ["node_modules"]), folder])];
      write(tsconfig, JSON.stringify(config, null, 2) + "\n");
    } catch { notes.push(`Add "${folder}" to "exclude" in tsconfig.json.`); }
  }
  if (info.typescript) write(join(site, "cenkbot-env.d.ts"), [
    "// Lets TypeScript accept the <cenk-bot> element in JSX.",
    'import type { DetailedHTMLProps, HTMLAttributes } from "react";',
    "",
    'declare module "react" {',
    "  namespace JSX {",
    "    interface IntrinsicElements {",
    '      "cenk-bot": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { endpoint?: string; name?: string; greeting?: string; placeholder?: string; icon?: string; accent?: string; position?: "left" | "right" };',
    "    }",
    "  }",
    "}",
    "",
  ].join("\n"));
  if (!patched) notes.push(`Add to your root layout before </body>: <Script src="/cenkbot/widget.js" strategy="lazyOnload" /> and ${tag}`);
  notes.push(`Deploying on Vercel or another serverless host: in next.config add outputFileTracingIncludes: { "/api/cenkbot": ["./${folder}/content/**", "./${folder}/config/**"] } so the content files ship with the route.`);
}

/* ---------- any other website: Cenkbot runs as its own small service ---------- */
function wireService(site, info, a, widget) {
  const service = (a.serviceUrl || "http://localhost:3400").replace(/\/$/, "");
  const tag = element(widget, a, `${service}/api/chat`, `${service}/icon`);
  const snippet = `<script src="${service}/widget.js" defer></script>\n${tag}\n`;
  write(join(bot, "site-snippet.html"), snippet);
  if (info.html) {
    const text = read(info.html);
    if (text.includes("<cenk-bot")) { const updated = text.replace(/<cenk-bot\b[^>]*><\/cenk-bot>/, tag); if (updated !== text) write(info.html, updated); }
    else if (text.includes("</body>")) write(info.html, text.replace("</body>", `${snippet}</body>`));
    else notes.push(`Paste ${posix(relative(site, join(bot, "site-snippet.html")))} into your page before </body>.`);
  } else notes.push(`Paste ${posix(relative(site, join(bot, "site-snippet.html")))} into every page (or your shared layout) before </body>.`);
  notes.push(`Run the service with "npm start" inside ${posix(relative(site, bot)) || "."} on a Node.js 22 host (HOST=0.0.0.0, behind HTTPS) at ${service}.`);
  if (info.hasNext && !info.appDir) notes.push("Next.js pages router detected: Cenkbot uses its own service. The app router gets a same-origin route automatically.");
}

/* ---------- main ---------- */
const answers = await collect();
const given = args.has("answers") ? json(resolve(String(args.get("answers")))) : {};
const look = appearance(given, answers);
const contentOnly = args.has("content-only");
const site = resolve(bot, String(answers.site ?? args.get("site") ?? ".."));
if (!contentOnly && !existsSync(site)) fail(`website folder not found: ${site}`);
const info = contentOnly ? null : inspect(site);
const kind = contentOnly ? "content" : answers.integration && answers.integration !== "auto" ? answers.integration : info.kind;
if (kind === "next" && !info.appDir) fail("integration \"next\" needs a Next.js app router (app/ or src/app/)");
if (!contentOnly) say(`
Website: ${site}
Integration: ${kind === "next" ? "Next.js route on the same origin" : "separate Cenkbot service + widget"}
`);

writeContent(answers, look);
const widget = json(join(bot, "content/widget.json"));
const review = answers.review === "yes";
const openrouter = await secret("OPENROUTER_API_KEY", "OpenRouter API key");
const jev = review ? await secret("TYPESAFE_API_KEY", "Jev (Typesafe) API key") : null;
const envFile = kind === "next" ? join(site, ".env.local") : join(bot, ".env.local");
const origin = answers.siteUrl ? new URL(answers.siteUrl).origin : undefined;
const keep = args.has("replace-keys") ? new Set() : new Set(["OPENROUTER_API_KEY", "TYPESAFE_API_KEY"]);
mergeEnv(envFile, {
  OPENROUTER_API_KEY: openrouter ?? "replace-with-your-key",
  ...(review ? { TYPESAFE_API_KEY: jev ?? "replace-with-your-key", CENKBOT_MODE: null } : { CENKBOT_MODE: "basic" }),
  CENKBOT_MODEL: answers.model,
  ...(kind === "service" && origin ? { CENKBOT_ALLOWED_ORIGINS: origin } : {}),
}, keep);
ignoreEnv(kind === "next" ? site : bot);
const envName = posix(relative(contentOnly ? bot : site, envFile));
if (!openrouter) notes.push(`Add your OpenRouter key to ${envName} (OPENROUTER_API_KEY). Get one at https://openrouter.ai/keys.`);
if (review && !jev) notes.push(`Add your Jev key to ${envName} (TYPESAFE_API_KEY), or set CENKBOT_MODE=basic.`);

if (!args.has("skip-install") && !args.has("skip-build")) {
  run("npm", ["install"], bot);
  run("npm", ["run", "build"], bot);
}
if (kind === "next") {
  wireNext(site, info, answers, widget);
  if (!args.has("skip-install")) run(info.manager, ["install"], site);
} else if (kind === "service") wireService(site, info, answers, widget);

let documents = null;
if (!dry && existsSync(join(bot, "dist/config.js"))) {
  try {
    const { loadSettings } = await import(new URL("../dist/config.js", import.meta.url).href);
    documents = (await loadSettings(bot)).documents.length;
    say(`
Content check passed: ${documents} document(s) indexed.`);
  } catch (error) { fail(`content check failed: ${error.message}`); }
}

const changed = [...new Set(written)];
if (quiet) {
  console.log(JSON.stringify({ ok: true, kind, site, changed, notes, documents }));
} else {
  say("\nChanged files:");
  for (const file of changed) say(`  ${file}`);
  if (notes.length) { say("\nNext:"); for (const note of notes) say(`  - ${note}`); }
  say(`
Done. ${kind === "next" ? "Start your site and open the chat bubble." : kind === "service" ? "Start the Cenkbot service, then open your site." : "Content saved."}
`);
}
