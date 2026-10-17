import { json } from "../config.js";
import { summaries } from "./metrics.js";
import type { Run } from "./schema.js";
export function compare(a: Run, b: Run) {
  if (a.kind !== b.kind || a.suiteHash !== b.suiteHash || a.evaluatorHash !== b.evaluatorHash) throw new Error("Incompatible runs: kind, dataset and evaluator must match; rerun both versions on the same suite");
  const left = summaries(a), right = summaries(b);
  const timingComparable = (a.concurrency ?? 1) === (b.concurrency ?? 1) && a.runtime === b.runtime && a.platform === b.platform;
  return right.map(r => {
    const prior = left.find(p => p.model === r.model && p.variant === r.variant);
    const cases = b.rows.filter(row => row.model === r.model && row.variant === r.variant).flatMap(row => {
      const old = a.rows.find(old => old.caseId === row.caseId && old.repeat === row.repeat && old.model === row.model && old.variant === row.variant);
      return old && old.finalGrade.pass !== row.finalGrade.pass ? [{ caseId: row.caseId, repeat: row.repeat, change: row.finalGrade.pass ? "improved" : "regressed" }] : [];
    });
    return { model: r.model, variant: r.variant, passDelta: prior ? r.passRate - prior.passRate : null, timingComparable, p95DeltaMs: timingComparable && prior?.p95Ms !== null && prior?.p95Ms !== undefined && r.p95Ms !== null ? r.p95Ms - prior.p95Ms : null, costPerPassDeltaUsd: prior?.costPerPassUsd !== null && prior?.costPerPassUsd !== undefined && r.costPerPassUsd !== null ? r.costPerPassUsd - prior.costPerPassUsd : null, sampleCounts: { before: prior?.n ?? 0, after: r.n }, changedCases: cases };
  });
}
if (process.argv[1]?.endsWith("compare.ts") || process.argv[1]?.endsWith("compare.js")) {
  const [a, b] = process.argv.slice(2);
  if (!a || !b) { console.error("Usage: npm run benchmark:compare -- path/to/old/run.json path/to/new/run.json"); process.exitCode = 1; }
  else Promise.all([json<Run>(a), json<Run>(b)]).then(([a, b]) => console.log(JSON.stringify(compare(a, b), null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
}
