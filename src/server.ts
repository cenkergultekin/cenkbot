import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { loadSettings, parseStyle, parseTurns, VERSION } from "./config.js";
import { createPortfolioBot } from "./portfolio.js";
import { TrafficGuard } from "./limits.js";

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
  const { config, profile } = await loadSettings();
  const bot = await createPortfolioBot();
  const host = process.env.HOST ?? "127.0.0.1", port = Number(process.env.PORT ?? "3400");
  const token = process.env.CENKBOT_SERVICE_TOKEN;
  if (token && token.length < 24) throw new Error("CENKBOT_SERVICE_TOKEN must contain at least 24 characters");
  const publicChat = process.env.CENKBOT_PUBLIC_CHAT !== "false";
  const origins = new Set((process.env.CENKBOT_ALLOWED_ORIGINS ?? "").split(",").filter(Boolean));
  for (const origin of origins) if (new URL(origin).origin !== origin || !/^https?:/.test(origin)) throw new Error("Allowed origins must be exact HTTP(S) origins");
  const traffic = new TrafficGuard();
  const configured = !!process.env.OPENROUTER_API_KEY && (!(config.queryGate || config.responseGate) || !!process.env.TYPESAFE_API_KEY);
  let active = 0;
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const origin = req.headers.origin;
    const allowed = !!origin && (origins.has(origin) || origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`);
    if (allowed) { res.setHeader("Access-Control-Allow-Origin", origin!); res.setHeader("Vary", "Origin"); }
    try {
      if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok:true, version:VERSION, mode:config.responseGate?"reviewed":"basic", chatConfigured:configured });
      const files: Record<string, [string,string]> = {
        "/": ["public/index.html", "text/html; charset=utf-8"],
        "/widget.js": ["public/widget.js", "text/javascript; charset=utf-8"],
        "/cenkbot.svg": ["assets/cenkbot.svg", "image/svg+xml"],
      };
      if (req.method === "GET" && path === "/icon") {
        // The icon chosen in setup (content/icon.*), or the default Cenkbot icon.
        const content = new URL("../content/", import.meta.url);
        const name = (await readdir(content)).find(file => /^icon\.(svg|png|jpe?g|webp)$/i.test(file));
        const types: Record<string,string> = { svg:"image/svg+xml", png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp" };
        res.writeHead(200, { "Content-Type": name ? types[name.split(".").pop()!.toLowerCase()]! : "image/svg+xml", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" });
        return res.end(await readFile(name ? new URL(name, content) : new URL("../assets/cenkbot.svg", import.meta.url)));
      }
      if (req.method === "GET" && files[path]) {
        const [file, type] = files[path]!;
        res.writeHead(200, {"Content-Type":type});
        return res.end(await readFile(new URL(`../${file}`,import.meta.url)));
      }
      if (req.method === "OPTIONS" && path === "/api/chat") {
        if (!publicChat || !allowed) return send(res,403,{error:"origin_not_allowed"});
        res.writeHead(204,{"Access-Control-Allow-Methods":"POST", "Access-Control-Allow-Headers":"Content-Type"});return res.end();
      }
      if (req.method === "POST" && ["/api/chat", "/v1/chat"].includes(path)) {
        const isPublic = path === "/api/chat";
        if (isPublic ? !publicChat || !allowed : !authorized(req.headers.authorization,token)) return send(res,isPublic?403:401,{error:isPublic?"origin_not_allowed":"unauthorized"});
        if (!configured) return send(res,503,{error:"chat_unconfigured"});
        if (active >= 2) return send(res,429,{error:"busy"});
        let turns,style;
        try {const body=await readBody(req);turns=parseTurns(body.turns);style=parseStyle(body.style,profile.style);} catch{return send(res,400,{error:"invalid_request"});}
        if (isPublic && !traffic.take(req.socket.remoteAddress??"unknown")) return send(res,429,{error:"rate_limited"});
        active++;
        try {
          const disconnect=new AbortController();
          req.once("aborted",()=>disconnect.abort());
          res.once("close",()=>{if(!res.writableEnded)disconnect.abort();});
          const result=await bot.answer({turns,style,signal:AbortSignal.any([disconnect.signal,AbortSignal.timeout(45000)])});
          return send(res,result.status==="unavailable"?503:200,{text:result.text,status:result.status,version:VERSION,sources:result.sources.map(({id,title,url})=>({id,title,url}))});
        } finally {active--;}
      }
      return send(res,404,{error:"not_found"});
    } catch {if(!res.headersSent)send(res,500,{error:"internal_error"});else res.end();}
  });
  server.requestTimeout=50000;server.headersTimeout=10000;
  server.listen(port,host,()=>console.log(`Cenkbot ${VERSION}: http://${host}:${port}; ${config.responseGate?"reviewed":"basic"} mode; chat ${configured?"configured":"unconfigured"}`));
  return server;
}
if(process.argv[1]?.endsWith("server.ts")||process.argv[1]?.endsWith("server.js"))startServer().catch(error=>{console.error(error.message);process.exitCode=1;});
