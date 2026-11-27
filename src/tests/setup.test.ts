import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repo = fileURLToPath(new URL("../../", import.meta.url));

function site(kind: "next" | "static") {
  const dir = mkdtempSync(join(tmpdir(), "cenkbot-site-"));
  const bot = join(dir, "cenkbot");
  for (const part of ["setup", "content", "config", "public", "assets"]) cpSync(join(repo, part), join(bot, part), { recursive: true });
  if (kind === "next") {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "site", dependencies: { next: "15.0.0", react: "19.0.0" } }));
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true }, include: ["**/*.ts", "**/*.tsx"], exclude: ["node_modules"] }));
    mkdirSync(join(dir, "app"));
    writeFileSync(join(dir, "app/layout.tsx"), "export default function Layout({ children }: { children: React.ReactNode }) {\n  return (\n    <html>\n      <body>{children}</body>\n    </html>\n  );\n}\n");
  } else writeFileSync(join(dir, "index.html"), "<!doctype html><html><body><h1>Hi</h1></body></html>");
  writeFileSync(join(dir, "answers.json"), JSON.stringify({
    language: "tr", owner: "Deniz Kaya", about: "Deniz builds small web tools.", projects: [{ name: "Tiny Atlas", summary: "A map of quiet cafes", url: "https://example.com/atlas" }],
    contact: "hello@example.com", siteUrl: "https://deniz.example", review: false, serviceUrl: "https://chat.deniz.example",
  }));
  return { dir, bot };
}
const run = (bot: string, dir: string) => spawnSync(process.execPath, [join(bot, "setup/cli.mjs"), "--answers", join(dir, "answers.json"), "--skip-install"], { cwd: dir, encoding: "utf8", env: { ...process.env, OPENROUTER_API_KEY: "", TYPESAFE_API_KEY: "" } });

test("setup wires a Next.js app router site on the same origin from an answers file", () => {
  const { dir, bot } = site("next");
  try {
    const result = run(bot, dir);
    assert.equal(result.status, 0, result.stderr);
    const profile = JSON.parse(readFileSync(join(bot, "content/profile.json"), "utf8"));
    assert.equal(profile.name, "Deniz Kaya asistanı");
    assert.equal(profile.style.language, "tr");
    assert.equal(existsSync(join(bot, "content/about.md")) && /fictional/.test(readFileSync(join(bot, "content/about.md"), "utf8")), false);
    assert.match(readFileSync(join(bot, "content/projects.md"), "utf8"), /## Tiny Atlas/);
    assert.match(readFileSync(join(dir, "app/api/cenkbot/route.ts"), "utf8"), /createChatHandler\(\{ root: path\.join\(process\.cwd\(\), "cenkbot"\) \}\)/);
    const layout = readFileSync(join(dir, "app/layout.tsx"), "utf8");
    assert.match(layout, /import Script from "next\/script"/);
    assert.match(layout, /<cenk-bot endpoint="\/api\/cenkbot" lang="tr"/);
    assert.match(layout, /icon="\/cenkbot\/icon\.svg" accent="#5b4bd6"/);
    assert.ok(existsSync(join(dir, "public/cenkbot/icon.svg")));
    const widget = JSON.parse(readFileSync(join(bot, "content/widget.json"), "utf8"));
    assert.equal(widget.icon, "icon.svg");
    const saved = JSON.parse(readFileSync(join(bot, "content/answers.json"), "utf8"));
    assert.deepEqual(saved.projects, [{ name: "Tiny Atlas", summary: "A map of quiet cafes", url: "https://example.com/atlas" }]);
    assert.equal(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies.cenkbot, "file:./cenkbot");
    assert.ok(JSON.parse(readFileSync(join(dir, "tsconfig.json"), "utf8")).exclude.includes("cenkbot"));
    assert.ok(existsSync(join(dir, "public/cenkbot/widget.js")) && existsSync(join(dir, "cenkbot-env.d.ts")));
    const envText = readFileSync(join(dir, ".env.local"), "utf8");
    assert.match(envText, /OPENROUTER_API_KEY=replace-with-your-key/);
    assert.match(envText, /CENKBOT_MODE=basic/);
    assert.match(readFileSync(join(dir, ".gitignore"), "utf8"), /\.env\.local/);
    assert.equal(run(bot, dir).status, 0, "running setup twice stays safe");
    assert.equal(readFileSync(join(dir, "app/layout.tsx"), "utf8").split("<cenk-bot").length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("setup gives any other site a widget snippet for the Cenkbot service", () => {
  const { dir, bot } = site("static");
  try {
    const result = run(bot, dir);
    assert.equal(result.status, 0, result.stderr);
    const html = readFileSync(join(dir, "index.html"), "utf8");
    assert.match(html, /<script src="https:\/\/chat\.deniz\.example\/widget\.js" defer><\/script>/);
    assert.match(html, /endpoint="https:\/\/chat\.deniz\.example\/api\/chat"/);
    assert.match(readFileSync(join(bot, ".env.local"), "utf8"), /CENKBOT_ALLOWED_ORIGINS=https:\/\/deniz\.example/);
    assert.equal(existsSync(join(dir, ".env.local")), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("content-only setup writes appearance without touching the website", () => {
  const { dir, bot } = site("static");
  try {
    const answers = JSON.parse(readFileSync(join(dir, "answers.json"), "utf8"));
    writeFileSync(join(dir, "answers.json"), JSON.stringify({ ...answers, icon: "letter", accent: "#0f8b6e", position: "left" }));
    const result = spawnSync(process.execPath, [join(bot, "setup/cli.mjs"), "--answers", join(dir, "answers.json"), "--skip-install", "--content-only", "--json"], { cwd: dir, encoding: "utf8", env: { ...process.env, OPENROUTER_API_KEY: "" } });
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout.trim());
    assert.equal(summary.kind, "content");
    assert.match(readFileSync(join(bot, "content/icon.svg"), "utf8"), />D</);
    assert.equal(JSON.parse(readFileSync(join(bot, "content/widget.json"), "utf8")).position, "left");
    assert.equal(readFileSync(join(dir, "index.html"), "utf8").includes("cenk-bot"), false);
    assert.ok(existsSync(join(bot, ".env.local")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
