// Place in app/api/chat/route.ts; adapt the import to your server-side Cenkbot build.
import { createPortfolioBot, TrafficGuard } from "../dist/index.js";
const bot = createPortfolioBot();
const traffic = new TrafficGuard();

export async function POST(request: Request) {
  // A shared visitor budget for a low-traffic, single-instance portfolio.
  if (!traffic.take("portfolio")) return Response.json({ error: "rate_limited" }, { status: 429 });
  try {
    const body = await request.json();
    const result = await (await bot).answer({ turns: body.turns, style: body.style, signal: request.signal });
    return Response.json({ text: result.text, status: result.status }, { status: result.status === "unavailable" ? 503 : 200 });
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
}
