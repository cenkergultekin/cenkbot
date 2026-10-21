#!/usr/bin/env node
/* Cenkbot setup: put this folder inside your website, answer a few questions, and Cenkbot is wired into the site.
 * Interactive:      npm run setup
 * From an answers file (for coding agents and CI):  npm run setup -- --answers cenkbot.answers.json [--skip-install] [--dry-run]
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
const fail = message => { console.error(`\ncenkbot setup: ${message}`); exit(1); };

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
function writeContent(a) {
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
  }
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
function mergeEnv(file, values) {
  const existing = existsSync(file) ? read(file) : "";
  const lines = existing ? existing.split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const index = lines.findIndex(line => line.startsWith(`${key}=`));
    if (index >= 0) { if (!lines[index].includes("replace-with")) continue; lines[index] = `${key}=${value}`; }
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
  const result = spawnSync(command, list, { cwd, stdio: "inherit", shell: platform === "win32" });
  if (result.status !== 0) fail(`${command} ${list.join(" ")} failed in ${cwd}`);
}

const greeting = a => a.language === "tr" ? `Merhaba! ${a.owner} hakkında, projeleri ve deneyimi üzerine sorabilirsin.` : `Hi! Ask me about ${a.owner}'s projects and experience.`;

/* ---------- Next.js, same origin ---------- */
function wireNext(site, info, a) {
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

  for (const [from, to] of [["public/widget.js", "public/cenkbot/widget.js"], ["assets/cenkbot.svg", "public/cenkbot/cenkbot.svg"]]) {
    written.push(to);
    if (!dry) { mkdirSync(dirname(join(site, to)), { recursive: true }); copyFileSync(join(bot, from), join(site, to)); }
  }

  const element = `<cenk-bot endpoint="/api/cenkbot" lang="${a.language}" name=${JSON.stringify(a.botName)} greeting=${JSON.stringify(greeting(a))}></cenk-bot>`;
  const layout = ["layout.tsx", "layout.jsx", "layout.js", "layout.ts"].map(name => join(info.appDir, name)).find(file => existsSync(file));
  let patched = false;
  if (layout) {
    let text = read(layout);
    if (text.includes("<cenk-bot")) patched = true;
    else if (text.includes("</body>")) {
      if (!/from ["']next\/script["']/.test(text)) text = `import Script from "next/script";\n${text}`;
      const at = text.indexOf("</body>");
      const lineStart = text.lastIndexOf("\n", at) + 1;
      const indent = /^[ \t]*/.exec(text.slice(lineStart))[0];
      const inner = `${indent}  `;
      const lead = text.slice(lineStart, at).trim() ? `\n${inner}` : "  ";
      text = `${text.slice(0, at)}${lead}<Script src="/cenkbot/widget.js" strategy="lazyOnload" />\n${inner}${element}\n${indent}${text.slice(at)}`;
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
    '      "cenk-bot": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { endpoint?: string; name?: string; greeting?: string; placeholder?: string };',
    "    }",
    "  }",
    "}",
    "",
  ].join("\n"));
  if (!patched) notes.push(`Add to your root layout before </body>: <Script src="/cenkbot/widget.js" strategy="lazyOnload" /> and ${element}`);
  notes.push(`Deploying on Vercel or another serverless host: in next.config add outputFileTracingIncludes: { "/api/cenkbot": ["./${folder}/content/**", "./${folder}/config/**"] } so the content files ship with the route.`);
}

/* ---------- any other website: Cenkbot runs as its own small service ---------- */
function wireService(site, info, a) {
  const service = (a.serviceUrl || "http://localhost:3400").replace(/\/$/, "");
  const snippet = `<script src="${service}/widget.js" defer></script>\n<cenk-bot endpoint="${service}/api/chat" lang="${a.language}" name=${JSON.stringify(a.botName)} greeting=${JSON.stringify(greeting(a))}></cenk-bot>\n`;
  write(join(bot, "site-snippet.html"), snippet);
  if (info.html) {
    const text = read(info.html);
    if (!text.includes("<cenk-bot") && text.includes("</body>")) write(info.html, text.replace("</body>", `${snippet}</body>`));
    else if (!text.includes("<cenk-bot")) notes.push(`Paste ${posix(relative(site, join(bot, "site-snippet.html")))} into your page before </body>.`);
  } else notes.push(`Paste ${posix(relative(site, join(bot, "site-snippet.html")))} into every page (or your shared layout) before </body>.`);
  notes.push(`Run the service with "npm start" inside ${posix(relative(site, bot)) || "."} on a Node.js 22 host (HOST=0.0.0.0, behind HTTPS) at ${service}.`);
  if (info.hasNext && !info.appDir) notes.push("Next.js pages router detected: Cenkbot uses its own service. The app router gets a same-origin route automatically.");
}

/* ---------- main ---------- */
const answers = await collect();
const site = resolve(bot, String(answers.site ?? args.get("site") ?? ".."));
if (!existsSync(site)) fail(`website folder not found: ${site}`);
const info = inspect(site);
const kind = answers.integration && answers.integration !== "auto" ? answers.integration : info.kind;
if (kind === "next" && !info.appDir) fail("integration \"next\" needs a Next.js app router (app/ or src/app/)");
console.log(`\nWebsite: ${site}\nIntegration: ${kind === "next" ? "Next.js route on the same origin" : "separate Cenkbot service + widget"}\n`);

writeContent(answers);
const review = answers.review === "yes";
const openrouter = await secret("OPENROUTER_API_KEY", "OpenRouter API key");
const jev = review ? await secret("TYPESAFE_API_KEY", "Jev (Typesafe) API key") : null;
const envFile = kind === "next" ? join(site, ".env.local") : join(bot, ".env.local");
const origin = answers.siteUrl ? new URL(answers.siteUrl).origin : undefined;
mergeEnv(envFile, {
  OPENROUTER_API_KEY: openrouter ?? "replace-with-your-key",
  ...(review ? { TYPESAFE_API_KEY: jev ?? "replace-with-your-key" } : { CENKBOT_MODE: "basic" }),
  CENKBOT_MODEL: answers.model,
  ...(kind === "service" && origin ? { CENKBOT_ALLOWED_ORIGINS: origin } : {}),
});
ignoreEnv(kind === "next" ? site : bot);
if (!openrouter) notes.push(`Add your OpenRouter key to ${posix(relative(site, envFile))} (OPENROUTER_API_KEY). Get one at https://openrouter.ai/keys.`);
if (review && !jev) notes.push(`Add your Jev key to ${posix(relative(site, envFile))} (TYPESAFE_API_KEY), or set CENKBOT_MODE=basic.`);

if (!args.has("skip-install")) {
  run("npm", ["install"], bot);
  run("npm", ["run", "build"], bot);
}
if (kind === "next") {
  wireNext(site, info, answers);
  if (!args.has("skip-install")) run(info.manager, ["install"], site);
} else wireService(site, info, answers);

if (!dry && !args.has("skip-install")) {
  try {
    const { loadSettings } = await import(new URL("../dist/config.js", import.meta.url).href);
    const { documents } = await loadSettings(bot);
    console.log(`\nContent check passed: ${documents.length} document(s) indexed.`);
  } catch (error) { fail(`content check failed: ${error.message}`); }
}

console.log("\nChanged files:");
for (const file of [...new Set(written)]) console.log(`  ${file}`);
if (notes.length) { console.log("\nNext:"); for (const note of notes) console.log(`  - ${note}`); }
console.log(`\nDone. ${kind === "next" ? "Start your site and open the chat bubble." : "Start the Cenkbot service, then open your site."}\n`);
