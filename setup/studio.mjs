#!/usr/bin/env node
/* Cenkbot setup studio: a local page to choose the look, write what the bot knows, add keys and wire the website.
 * npm run setup        opens it in the browser (127.0.0.1 only, one-time token in the URL).
 * Everything it saves lands in plain files (content/, .env.local), so a developer can keep managing them by hand.
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { argv, env, platform, exit } from "node:process";

const here = dirname(fileURLToPath(import.meta.url));
const bot = resolve(here, "..");
const site = resolve(bot, "..");
const token = randomBytes(18).toString("hex");
const say = message => console.log(`cenkbot setup: ${message}`);

/* ---------- make sure Cenkbot is installed and built ---------- */
function npm(args) {
  const result = spawnSync("npm", args, { cwd: bot, stdio: "inherit", shell: platform === "win32" });
  if (result.status !== 0) { console.error(`npm ${args.join(" ")} failed`); exit(1); }
}
const newest = dir => readdirSync(dir, { withFileTypes: true }).reduce((latest, entry) => Math.max(latest, entry.isDirectory() ? newest(join(dir, entry.name)) : statSync(join(dir, entry.name)).mtimeMs), 0);
if (!existsSync(join(bot, "node_modules"))) { say("installing (first run)…"); npm(["install"]); }
if (!existsSync(join(bot, "dist/index.js")) || newest(join(bot, "src")) > statSync(join(bot, "dist/index.js")).mtimeMs) { say("building…"); npm(["run", "build"]); }
const { createChatHandler } = await import(pathToFileURL(join(bot, "dist/index.js")).href);

/* ---------- local state ---------- */
const read = file => readFileSync(file, "utf8");
const KEYS = { openrouter: "OPENROUTER_API_KEY", jev: "TYPESAFE_API_KEY" };
function loadEnv() {
  const file = join(bot, ".env.local");
  if (!existsSync(file)) return;
  for (const line of read(file).split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !match[2].includes("replace-with")) env[match[1]] = match[2];
    else if (match && match[2].includes("replace-with")) delete env[match[1]];
  }
}
loadEnv();
let handler = createChatHandler({ root: bot });

function detectSite() {
  const pkg = existsSync(join(site, "package.json")) ? JSON.parse(read(join(site, "package.json"))) : null;
  const deps = { ...pkg?.dependencies, ...pkg?.devDependencies };
  const appDir = ["app", "src/app"].some(dir => existsSync(join(site, dir)));
  const html = ["index.html", "public/index.html", "src/index.html"].find(file => existsSync(join(site, file))) ?? null;
  const kind = deps.next && appDir ? "next" : "service";
  return { path: site, name: pkg?.name ?? site.split(/[\\/]/).pop(), kind, html, isSite: !!pkg || !!html };
}
function state() {
  const file = join(bot, "content/answers.json");
  const profile = JSON.parse(read(join(bot, "content/profile.json")));
  const answers = existsSync(file) ? JSON.parse(read(file)) : {
    language: profile.style.language, owner: "", botName: "", about: "", projects: [], contact: "", tone: profile.style.tone, detail: profile.style.detail,
    siteUrl: "", serviceUrl: "", model: env.CENKBOT_MODEL || "openrouter/free", review: false, icon: "cenkbot", accent: "#5b4bd6", position: "right", greeting: "", placeholder: "",
  };
  const docs = readdirSync(join(bot, "content")).filter(name => name.endsWith(".md"));
  return { answers, keys: { openrouter: !!env.OPENROUTER_API_KEY, jev: !!env.TYPESAFE_API_KEY }, site: detectSite(), docs, fresh: !existsSync(file), folder: relative(site, bot) || "." };
}

/* ---------- run the setup script with the studio's answers ---------- */
function runSetup(answers, extra, keys) {
  const dir = mkdtempSync(join(tmpdir(), "cenkbot-studio-"));
  try {
    const clean = { ...answers };
    if (clean.icon === "custom") {
      if (!clean.iconUpload) {
        const current = readdirSync(join(bot, "content")).find(name => /^icon\.(svg|png|jpe?g|webp)$/i.test(name));
        if (!current) throw new Error("Choose an image file for the custom icon.");
        const copy = join(dir, `custom${current.slice(current.lastIndexOf("."))}`);
        writeFileSync(copy, readFileSync(join(bot, "content", current)));
        clean.icon = copy;
      } else {
        const match = /^data:image\/(svg\+xml|png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(clean.iconUpload);
        if (!match) throw new Error("The icon must be an SVG, PNG, JPEG or WebP image.");
        const bytes = Buffer.from(match[2], "base64");
        if (bytes.length > 512 * 1024) throw new Error("The icon must be smaller than 512 KB.");
        const ext = { "svg+xml": "svg", png: "png", jpeg: "jpg", webp: "webp" }[match[1]];
        const upload = join(dir, `upload.${ext}`);
        writeFileSync(upload, bytes);
        clean.icon = upload;
      }
    }
    delete clean.iconUpload;
    const file = join(dir, "answers.json");
    writeFileSync(file, JSON.stringify(clean));
    const childEnv = { ...env };
    for (const [name, variable] of Object.entries(KEYS)) if (keys?.[name]) childEnv[variable] = keys[name];
    const flags = ["--answers", file, "--json", ...extra, ...(keys && Object.values(keys).some(Boolean) ? ["--replace-keys"] : [])];
    return new Promise(done => {
      const child = spawn(process.execPath, [join(here, "cli.mjs"), ...flags], { cwd: site, env: childEnv });
      let out = "", err = "";
      child.stdout.on("data", chunk => { out += chunk; });
      child.stderr.on("data", chunk => { err += chunk; });
      child.on("close", code => {
        rmSync(dir, { recursive: true, force: true });
        if (code !== 0) return done({ ok: false, error: err.replace(/^\s*cenkbot setup:\s*/m, "").trim() || "Setup failed." });
        try { done(JSON.parse(out.trim().split("\n").pop())); } catch { done({ ok: false, error: "Setup returned no result." }); }
      });
    });
  } catch (error) { rmSync(dir, { recursive: true, force: true }); return Promise.resolve({ ok: false, error: error.message }); }
}

/* ---------- http ---------- */
const types = { html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const fileFor = path => {
  if (path === "/" ) return join(here, "studio/index.html");
  if (path === "/studio.css" || path === "/studio.js") return join(here, "studio", path.slice(1));
  if (path === "/widget.js") return join(bot, "public/widget.js");
  if (path === "/cenkbot.svg") return join(bot, "assets/cenkbot.svg");
  const builtIn = /^\/icons\/(cenkbot|bubble|spark)\.svg$/.exec(path);
  if (builtIn) return join(bot, "assets/icons", `${builtIn[1]}.svg`);
  if (path === "/icon") {
    const current = readdirSync(join(bot, "content")).find(name => /^icon\.(svg|png|jpe?g|webp)$/i.test(name));
    return current ? join(bot, "content", current) : join(bot, "assets/cenkbot.svg");
  }
  return null;
};
const sameToken = value => { const a = Buffer.from(String(value ?? "")), b = Buffer.from(token); return a.length === b.length && timingSafeEqual(a, b); };
const send = (res, status, body) => { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 1_200_000) throw new Error("too large"); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

let port = Number(env.CENKBOT_SETUP_PORT ?? 4310);
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const host = req.headers.host ?? "";
  // Only this machine, and only pages served by this studio.
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || (req.headers.origin && req.headers.origin !== `http://${host}`)) return send(res, 403, { error: "forbidden" });
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    if (req.method === "GET") {
      const file = fileFor(url.pathname);
      if (!file || !existsSync(file)) return send(res, 404, { error: "not_found" });
      res.writeHead(200, { "Content-Type": types[file.split(".").pop().toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-store", ...(url.pathname === "/" ? { "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; script-src 'self'; frame-ancestors 'none'" } : {}) });
      return res.end(readFileSync(file));
    }
    if (req.method !== "POST" || !sameToken(req.headers["x-setup-token"] ?? url.searchParams.get("t"))) return send(res, 403, { error: "forbidden" });
    if (url.pathname === "/api/chat") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await handler(new Request("http://127.0.0.1/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: Buffer.concat(chunks) }));
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(await response.text());
    }
    if (url.pathname === "/api/state") return send(res, 200, state());
    if (url.pathname === "/api/save" || url.pathname === "/api/connect") {
      const input = await body(req);
      const connect = url.pathname === "/api/connect";
      const result = await runSetup(input.answers ?? {}, connect ? ["--skip-build"] : ["--content-only", "--skip-install"], input.keys);
      loadEnv();
      for (const [name, variable] of Object.entries(KEYS)) if (input.keys?.[name]) env[variable] = input.keys[name];
      handler = createChatHandler({ root: bot });
      return send(res, result.ok ? 200 : 400, { ...result, state: state() });
    }
    return send(res, 404, { error: "not_found" });
  } catch (error) { return send(res, 500, { error: error.message ?? "internal_error" }); }
});
server.on("error", error => {
  if (error.code === "EADDRINUSE" && port < 4330) { port += 1; server.listen(port, "127.0.0.1"); }
  else { console.error(error.message); exit(1); }
});
server.on("listening", () => {
  const link = `http://127.0.0.1:${port}/?t=${token}`;
  say(`open ${link}`);
  say("press Ctrl+C to stop.");
  if (!argv.includes("--no-open")) {
    const opener = platform === "win32" ? ["cmd", ["/c", "start", "", link]] : platform === "darwin" ? ["open", [link]] : ["xdg-open", [link]];
    try { spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref(); } catch {}
  }
});
server.listen(port, "127.0.0.1");
