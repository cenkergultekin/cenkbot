import { loadSettings } from "./config.js";
import { createBot } from "./engine.js";
import { openRouter } from "./provider.js";
import { createJev } from "./jev.js";
import { createLocalRetriever } from "./steps/retrieve.js";

/** Ready-to-use server-side portfolio bot; keys never belong in browser code. */
export async function createPortfolioBot(options: { root?: string } = {}) {
  const { config, profile, models, documents } = await loadSettings(options.root);
  if ((config.queryGate || config.responseGate) && !process.env.TYPESAFE_API_KEY) throw new Error("Reviewed mode requires TYPESAFE_API_KEY; use CENKBOT_MODE=basic for one-model RAG");
  return createBot({ config, profile, generator: openRouter(models),
    gate: config.queryGate || config.responseGate ? createJev() : undefined,
    retriever: createLocalRetriever(documents),
  });
}
