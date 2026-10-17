import { writeFile } from "node:fs/promises";
import { loadSettings } from "../config.js";
export async function refreshCatalog() {
  const { models } = await loadSettings();
  const response = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const body = await response.json() as { data: { id: string; pricing: { prompt: string; completion: string }; context_length: number }[] };
  const updated = models.map(m => {
    const live = body.data.find(v => v.id === m.id);
    if (!live) throw new Error(`Selected model missing: ${m.id}`);
    return { ...m, inputUsdPerMillion: Number(live.pricing.prompt) * 1e6, outputUsdPerMillion: Number(live.pricing.completion) * 1e6, contextLength: live.context_length };
  });
  await writeFile("eval/models.json", JSON.stringify({ checkedAt: new Date().toISOString(), source: "https://openrouter.ai/api/v1/models", selectionStatus: "unmeasured", models: updated }, null, 2) + "\n");
  console.log(`Refreshed ${updated.length} model prices; this does not measure speed or quality.`);
}
if (process.argv[1]?.endsWith("catalog.ts") || process.argv[1]?.endsWith("catalog.js")) refreshCatalog().catch(() => { console.error("Catalog refresh failed; snapshot unchanged."); process.exitCode = 1; });
