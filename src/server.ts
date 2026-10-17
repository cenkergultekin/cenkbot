import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { loadSettings, parseStyle, parseTurns, VERSION } from "./config.js";
import { createBot } from "./engine.js";
import { openRouter } from "./provider.js";
import { createJev } from "./jev.js";
import { benchmarkView } from "./benchmark-view.js";
import type { PublicIndex } from "./eval/publish.js";

export function authorized(header: string | undefined, token: string | undefined) {
  if (!token || !header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7)), expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
};
export async function readBody(req: IncomingMessage) {
  let bytes = 0; const chunks: Buffer[] = [];
  for await (const chunk of req) { const b = Buffer.from(chunk); bytes += b.length; if (bytes > 20000) throw new Error("Request too large"); chunks.push(b); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}
export async function startServer() {
  const { config, profile, models } = await loadSettings();
  if (config.maxRepairs > 1) throw new Error("Live repair limit is at most one; repair2 is eval-only");
  const host = process.env.HOST ?? "127.0.0.1", port = Number(process.env.PORT ?? "3400");
  const token = process.env.CENKBOT_SERVICE_TOKEN;
  if (host !== "127.0.0.1" && host !== "localhost" && (!token || token.length < 24)) throw new Error("Public binding requires CENKBOT_SERVICE_TOKEN with at least 24 characters");
  const gate = process.env.TYPESAFE_API_KEY ? createJev() : undefined;
  const bot = createBot({ config, profile, generator: openRouter(models), gate });
  let active = 0;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok: true, version: VERSION, chatConfigured: !!process.env.OPENROUTER_API_KEY && (!(config.queryGate || config.responseGate) || !!gate), benchmark: "eval/public.json" });
      if (req.method === "GET" && path === "/cenkbot/data.json") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60" });
        const published = JSON.parse(await readFile(new URL("../eval/public.json", import.meta.url), "utf8")) as PublicIndex;
        return res.end(JSON.stringify(benchmarkView(published)));
      }
      if (req.method === "GET" && ["/", "/cenkbot", "/cenkbot/", "/cenkbot/benchmark", "/cenkbot/benchmark/"].includes(path)) {
        const file = path.includes("benchmark") ? "benchmark.html" : "index.html";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(await readFile(new URL(`../src/web/${file}`, import.meta.url), "utf8"));
      }
      if (req.method === "GET" && ["/cenkbot/assets/style.css", "/cenkbot/assets/app.js"].includes(path)) {
        const file = path.endsWith("style.css") ? "style.css" : "app.js";
        res.writeHead(200, { "Content-Type": file.endsWith("css") ? "text/css; charset=utf-8" : "text/javascript; charset=utf-8" });
        return res.end(await readFile(new URL(`../src/web/${file}`, import.meta.url), "utf8"));
      }
      if (req.method === "POST" && path === "/v1/chat") {
        if (!authorized(req.headers.authorization, token)) return send(res, 401, { error: "unauthorized" });
        if (!process.env.OPENROUTER_API_KEY || ((config.queryGate || config.responseGate) && !gate)) return send(res, 503, { error: "chat_unconfigured" });
        if (active >= 4) return send(res, 429, { error: "busy" });
        active++;
        try {
          let turns, style;
          try { const body = await readBody(req); turns = parseTurns(body.turns); style = parseStyle(body.style, profile.style); }
          catch { return send(res, 400, { error: "invalid_request" }); }
          const disconnect = new AbortController();
          req.once("aborted", () => disconnect.abort());
          res.once("close", () => { if (!res.writableEnded) disconnect.abort(); });
          const result = await bot.answer({ turns, style, signal: AbortSignal.any([disconnect.signal, AbortSignal.timeout(45000)]) });
          // Detailed traces are eval-only; never send private drafts or gate signals to a visitor.
          return send(res, result.status === "unavailable" ? 503 : 200, { text: result.text, status: result.status, version: VERSION, model: result.selectedModel, totalMs: result.totalMs, costUsd: result.costUsd });
        } finally { active--; }
      }
      send(res, 404, { error: "not_found" });
    } catch { if (!res.headersSent) send(res, 500, { error: "internal_error" }); else res.end(); }
  });
  server.requestTimeout = 50000;
  server.headersTimeout = 10000;
  server.listen(port, host, () => console.log(`Cenkbot ${VERSION}: http://${host}:${port}/cenkbot; chat ${process.env.OPENROUTER_API_KEY && gate ? "configured" : "unconfigured"}`));
  return server;
}
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) startServer().catch(e => { console.error(e.message); process.exitCode = 1; });
