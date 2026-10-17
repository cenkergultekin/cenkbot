import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadSettings, json, VERSION, PROMPT_VERSION, POLICY_VERSION, QUERY_VERSION, RESPONSE_VERSION } from "../config.js";
import { createBot } from "../engine.js";
import { openRouter } from "../provider.js";
import { createJev, JEV_MODEL, JEV_PRICING, thresholds, queryQuestions, responseQuestions } from "../jev.js";
import { buildPrompt } from "../prompts.js";
import { grade, finalGrade, EVALUATOR_VERSION } from "./grade.js";
import { summaries, recommend } from "./metrics.js";
import { mockGate, mockGenerator } from "./mock.js";
import { Budget } from "./budget.js";
import type { Run, Suite } from "./schema.js";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1] ?? fallback; };
export async function main() {
  const { config, profile, models } = await loadSettings();
  const suite = await json<Suite>("eval/suite.json");
  const mock = process.argv.includes("--mock");
  const plan = process.argv.includes("--plan");
  const variants = arg("--variants", "baseline,query,guarded,repair").split(",");
  if (variants.some(v => !["baseline", "query", "guarded", "repair", "repair2"].includes(v)) || new Set(variants).size !== variants.length) throw new Error("Invalid variants");
  const repeats = Number(arg("--repeats", "3"));
  const concurrency = Number(arg("--concurrency", "1"));
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error("Offline eval concurrency must be 1–10");
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("Repeats must be 1–20");
  const selected = arg("--models", "all");
  const chosen = selected === "all" ? models : models.filter(m => selected.split(",").includes(m.id));
  if (!chosen.length || (selected !== "all" && chosen.length !== selected.split(",").length)) throw new Error("Unknown model selection");
  const budget = new Budget(Number(arg("--budget-usd", "1")));
  const needsJev = variants.some(v => v !== "baseline");
  const total = suite.cases.length * repeats * chosen.length * variants.length;
  if (plan) { console.log(JSON.stringify({ cases: suite.cases.length, models: chosen.map(m => m.id), repeats, concurrency, variants, turns: total, maxGeneratorRequests: suite.cases.length * repeats * chosen.length * variants.reduce((n, v) => n + (v === "repair2" ? 3 : v === "repair" ? 2 : 1), 0), budgetUsd: budget.maxUsd, jevBilling: needsJev ? JEV_PRICING : "not used", note: "Reservation budget is a conservative guard, not a provider billing guarantee." }, null, 2)); return; }
  if (!mock && !process.env.OPENROUTER_API_KEY) throw new Error("Set OPENROUTER_API_KEY in the process environment; no secret files are read");
  if (!mock && needsJev && !process.env.TYPESAFE_API_KEY) throw new Error("Set TYPESAFE_API_KEY for Jev variants");
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  let commit = "uncommitted", dirty = true;
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); dirty = !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(); } catch { /* local first run */ }
  const evaluatorSource = await readFile(new URL(import.meta.url.endsWith(".ts") ? "./grade.ts" : "./grade.js", import.meta.url), "utf8");
  const run: Run = { schemaVersion: 1, id, kind: mock ? "mock" : "live", startedAt: new Date().toISOString(), version: VERSION, commit, dirty,
    suiteId: suite.id, suiteVersion: suite.version, suiteHash: hash(suite), profileHash: hash(profile),
    promptHash: hash({ version: PROMPT_VERSION, prompt: buildPrompt(profile, profile.style) }), evaluatorHash: hash({ EVALUATOR_VERSION, evaluatorSource }), configHash: hash(config),
    policyHash: hash({ POLICY_VERSION, QUERY_VERSION, RESPONSE_VERSION, JEV_MODEL, JEV_PRICING, thresholds, queryQuestions, responseQuestions }), catalogHash: hash(models), runtime: process.version, platform: process.platform,
    config, models: chosen, variants, repeats, concurrency, suitePublic: suite.public, publicFixture: profile.id === "atlas-public-fixture", status: "partial", rows: [] };
  const root = `eval/runs/${id}`;
  await mkdir(root, { recursive: true });
  const cancellation = new AbortController();
  const stop = () => cancellation.abort();
  process.once("SIGINT", stop); process.once("SIGTERM", stop);
  let saveQueue = Promise.resolve();
  const save = () => saveQueue = saveQueue.then(async () => {
    const summary = summaries(run);
    await writeFile(`${root}/run.json`, JSON.stringify(run, null, 2) + "\n");
    await writeFile(`${root}/summary.json`, JSON.stringify({ runId: id, kind: run.kind, status: run.status, budgetReservedUsd: budget.committedUsd, summary, recommendation: recommend(summary) }, null, 2) + "\n");
  });
  const generator = mock ? mockGenerator : budget.wrap(openRouter(models), models);
  const originalGate = mock ? mockGate : needsJev ? createJev() : undefined;
  const reserveJev = (input: unknown, questions: unknown) => { if (!mock) budget.reserve((Buffer.byteLength(JSON.stringify(input)) + Buffer.byteLength(JSON.stringify(questions)) + 2048) * JEV_PRICING.inputUsdPerMillion / 1e6); };
  const gate = originalGate && { query: async (input: Parameters<typeof originalGate.query>[0]) => { reserveJev(input, queryQuestions); return originalGate.query(input); }, judge: async (input: Parameters<typeof originalGate.judge>[0]) => { reserveJev(input, responseQuestions); return originalGate.judge(input); } };
  const jobs: { repeat: number; caseIndex: number; model: typeof chosen[number]; variant: string }[] = [];
  // Every scheduled call is a scored experiment; none competes to serve the same live answer.
  for (let repeat = 0; repeat < repeats; repeat++) for (let caseIndex = 0; caseIndex < suite.cases.length; caseIndex++) {
    const offset = (repeat + caseIndex) % chosen.length;
    for (const model of [...chosen.slice(offset), ...chosen.slice(0, offset)]) for (const variant of variants) jobs.push({ repeat, caseIndex, model, variant });
  }
  let nextJob = 0;
  let failure: Error | null = null;
  const worker = async () => {
    while (nextJob < jobs.length && !failure) {
      const { repeat, caseIndex, model: m, variant } = jobs[nextJob++]!;
      const c = suite.cases[caseIndex]!;
      try {
        if (cancellation.signal.aborted) throw new Error("Eval interrupted; partial run saved");
        if (!mock && budget.committedUsd >= budget.maxUsd) throw new Error("Eval budget exhausted");
        const experimentConfig = { ...config, model: m.id, reasoningModel: undefined, queryGate: variant !== "baseline", responseGate: ["guarded", "repair", "repair2"].includes(variant), maxRepairs: variant === "repair2" ? 2 : variant === "repair" ? 1 : 0 };
        const bot = createBot({ generator, gate, profile, config: experimentConfig });
        const result = await bot.answer({ turns: c.turns, style: c.style, signal: cancellation.signal });
        run.rows.push({ id: `${id}:${m.id}:${variant}:${repeat}:${c.id}`, caseId: c.id, category: c.category, model: m.id, repeat, variant, result, finalGrade: finalGrade(c, result.text, result.status), attemptGrades: result.attempts.map(a => grade(c, a.text)) });
        if (budget.exhausted) throw new Error("Eval budget exhausted; partial run saved");
        if (cancellation.signal.aborted) throw new Error("Eval interrupted; partial run saved");
        if (run.rows.length % Math.max(10, Math.ceil(total / 20)) === 0) { await save(); console.log(`${run.rows.length}/${total} turns saved`); }
      } catch (error) { failure = error instanceof Error ? error : new Error("Eval worker failed"); }
    }
  };
  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (failure) throw failure;
    run.status = "complete";
  } finally { run.finishedAt = new Date().toISOString(); await save(); process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop); }
  console.log(`${run.kind.toUpperCase()} run saved: ${root}; ${run.rows.length} turns. ${mock ? "Not publishable; no model quality measured." : "Human review required before model promotion."}`);
}
if (process.argv[1]?.endsWith("cli.ts") || process.argv[1]?.endsWith("cli.js")) main().catch(error => { console.error(error instanceof Error ? error.message : "Eval failed"); process.exitCode = 1; });
