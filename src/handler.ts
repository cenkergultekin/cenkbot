import { loadSettings, parseStyle, parseTurns, VERSION } from "./config.js";
import { createPortfolioBot } from "./portfolio.js";
import { TrafficGuard } from "./limits.js";

type Options = { root?: string; limits?: { perMinute: number; perDay: number }; concurrency?: number };

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/**
 * A same-origin chat route for any framework that speaks the Fetch API (Next.js route handlers, Astro, SvelteKit, Hono, Remix).
 * Keys are read from the server environment. The bot loads lazily, so importing this file never needs keys.
 */
export function createChatHandler(options: Options = {}) {
  const traffic = new TrafficGuard(options.limits);
  const concurrency = options.concurrency ?? 2;
  let active = 0;
  let ready: ReturnType<typeof prepare> | undefined;
  async function prepare() {
    const { profile, config } = await loadSettings(options.root);
    const reviewed = config.queryGate || config.responseGate;
    const configured = !!process.env.OPENROUTER_API_KEY && (!reviewed || !!process.env.TYPESAFE_API_KEY);
    return { profile, configured, bot: configured ? await createPortfolioBot({ root: options.root }) : null };
  }
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
    ready ??= prepare();
    let state;
    try { state = await ready; } catch { ready = undefined; return reply(500, { error: "invalid_setup" }); }
    if (!state.configured || !state.bot) return reply(503, { error: "chat_unconfigured" });
    let turns, style;
    try {
      const raw = await request.text();
      if (raw.length > 20000) throw new Error("Request too large");
      const body = JSON.parse(raw) as Record<string, unknown>;
      turns = parseTurns(body.turns);
      style = parseStyle(body.style, state.profile.style);
    } catch { return reply(400, { error: "invalid_request" }); }
    const visitor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "visitor";
    if (!traffic.take(visitor)) return reply(429, { error: "rate_limited" });
    if (active >= concurrency) return reply(429, { error: "busy" });
    active++;
    try {
      const result = await state.bot.answer({ turns, style, signal: AbortSignal.any([request.signal, AbortSignal.timeout(45000)]) });
      return reply(result.status === "unavailable" ? 503 : 200, { text: result.text, status: result.status, version: VERSION, sources: result.sources.map(({ id, title, url }) => ({ id, title, url })) });
    } catch {
      return reply(500, { error: "internal_error" });
    } finally { active--; }
  };
}
