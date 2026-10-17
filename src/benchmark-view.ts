import type { PublicIndex } from "./eval/publish.js";
import { quantile } from "./eval/metrics.js";

/** Presentation data only. The immutable experiment export stays in eval/public.json. */
export function benchmarkView(index: PublicIndex) {
  return {
    schemaVersion: 2,
    humanReviewed: index.runs.some(run => run.summary.some(s => s.human.reviewed > 0)),
    runs: index.runs.map(run => ({
      id: run.id, version: run.version, startedAt: run.startedAt,
      kind: run.kind, status: run.status,
      comparisonKey: `${run.suiteHash}:${run.evaluatorHash}:${run.kind}`,
      questions: new Set(run.cases.map(c => c.caseId)).size,
      repeats: run.repeats,
      blocked: Object.keys(run.errorSummary).some(code => /HTTP (401|402|403)/.test(code)),
      hasAccessErrors: Object.keys(run.errorSummary).some(code => /HTTP (401|402|403|429)/.test(code)),
      summary: run.summary.map(s => {
        const rows = run.cases.filter(c => c.model === s.model && c.variant === s.variant);
        const answers = rows.filter(c => c.status === "ok" && c.attempts.length > 0);
        const drafts = rows.filter(c => c.attempts.length > 0);
        const stages = Math.max(0, ...drafts.map(c => c.attempts.length));
        return {
          model: s.model, variant: s.variant, n: s.n, passRate: s.passRate,
          latencyMs: quantile(answers.map(c => c.totalMs), .95),
          answerN: answers.length, costPerPassUsd: s.costPerPassUsd,
          correction: {
            n: drafts.length,
            stages: Array.from({ length: stages }, (_, i) =>
              drafts.filter(c => c.attempts[Math.min(i, c.attempts.length - 1)]?.pass).length / drafts.length),
            sentRate: drafts.length ? drafts.filter(c => c.pass).length / drafts.length : null,
          },
        };
      }),
    })),
  };
}
