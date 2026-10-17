import { writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { json } from "../config.js";
import { summaries, recommend } from "./metrics.js";
import type { HumanReview, Run } from "./schema.js";
export function publicRun(run: Run, reviews: HumanReview[] = []) {
  if (run.kind !== "live") throw new Error("Mock results cannot be published");
  if (!run.suitePublic || !run.publicFixture) throw new Error("Only synthetic public fixture runs may be published");
  if (run.dirty || run.commit === "uncommitted") throw new Error("Commit code and configuration before a publishable run");
  if (run.status !== "complete") throw new Error("Partial runs cannot be published as a benchmark");
  const summary = summaries(run, reviews);
  const { rows, ...metadata } = run;
  const errors = rows.flatMap(r => r.result.requests).filter(r => r.status === "error");
  const errorSummary = Object.fromEntries([...Map.groupBy(errors, r => r.error ?? "request failed")].map(([code, requests]) => [code, requests.length]));
  return { ...metadata, errorSummary, reviewHash: createHash("sha256").update(JSON.stringify(reviews)).digest("hex"), summary, recommendation: recommend(summary),
    cases: rows.map(r => ({ caseId: r.caseId, category: r.category, model: r.model, variant: r.variant, repeat: r.repeat, status: r.result.status, pass: r.finalGrade.pass,
      checks: r.finalGrade.checks, totalMs: r.result.totalMs, costUsd: r.result.costUsd,
      requests: r.result.requests.map(req => ({ purpose: req.purpose, model: req.model, provider: req.provider, status: req.status, ms: req.ms, costUsd: req.costUsd, costSource: req.costSource, error: req.error })),
      finalText: r.result.text, attempts: r.result.attempts.map((a, i) => ({ index: a.index, text: a.text, verdict: a.verdict, reasons: a.reasons, acceptedStyleOnly: a.acceptedStyleOnly, pass: r.attemptGrades[i]?.pass })) })),
  };
}
export type PublicRun = ReturnType<typeof publicRun>;
export type PublicIndex = { schemaVersion: 1; runs: PublicRun[] };
if (process.argv[1]?.endsWith("publish.ts") || process.argv[1]?.endsWith("publish.js")) {
  const [path, reviewPath] = process.argv.slice(2);
  if (!path) { console.error("Usage: npm run benchmark:publish -- eval/runs/ID/run.json [eval/reviews/ID.json]"); process.exitCode = 1; }
  else (async () => {
    const run = await json<Run>(path);
    const reviews = reviewPath ? await json<HumanReview[]>(reviewPath) : [];
    const entry = publicRun(run, reviews);
    const index = await json<PublicIndex>("eval/public.json");
    if (index.runs.some(r => r.id === entry.id)) throw new Error("Immutable run already published; reviews require a new explicitly versioned report");
    index.runs.unshift(entry);
    await writeFile("eval/public.json", JSON.stringify(index, null, 2) + "\n");
    console.log("Prepared eval/public.json locally. Review the diff before publication.");
  })().catch(e => { console.error(e.message); process.exitCode = 1; });
}
