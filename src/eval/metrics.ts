import type { HumanReview, Row, Run, Summary } from "./schema.js";
export function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!;
}
export function wilson(passed: number, n: number): [number, number] {
  if (!n) return [0, 1];
  const z = 1.96, p = passed / n, d = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / d;
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}
export function validateReviews(reviews: HumanReview[], rows: Row[]) {
  const seen = new Set<string>();
  for (const r of reviews) {
    const row = rows.find(row => row.id === r.rowId);
    const key = `${r.rowId}:${r.attempt}:${r.reviewer}`;
    if (!row || !r.reviewer?.trim() || (r.attempt !== "final" && (!Number.isInteger(r.attempt) || !row.result.attempts[r.attempt])) || seen.has(key)) throw new Error("Unknown or duplicate review target");
    for (const key of ["language", "relevance", "factuality", "tone"] as const) if (!Number.isFinite(r[key]) || r[key] < 0 || r[key] > 4) throw new Error("Human scores must be 0–4");
    seen.add(key);
  }
}
export function summaries(run: Run, reviews: HumanReview[] = []): Summary[] {
  validateReviews(reviews, run.rows);
  const groups = Map.groupBy(run.rows, r => `${r.model}:${r.variant}`);
  return [...groups.values()].map(rows => {
    const n = rows.length, passed = rows.filter(r => r.finalGrade.pass).length;
    const repaired = rows.filter(r => r.result.attempts.length > 1);
    const firstBad = repaired.filter(r => !r.attemptGrades[0]?.pass);
    const firstGood = repaired.filter(r => r.attemptGrades[0]?.pass);
    const known = rows.reduce((s, r) => s + r.result.knownCostUsd, 0);
    const unknown = rows.reduce((s, r) => s + r.result.unknownCostRequests, 0);
    const rowReviews = rows.map(row => {
      const entries = reviews.filter(r => r.rowId === row.id && r.attempt === "final");
      if (!entries.length) return null;
      return Object.fromEntries((["language", "relevance", "factuality", "tone"] as const).map(k => [k, entries.reduce((s, r) => s + r[k], 0) / entries.length / 4])) as Record<"language" | "relevance" | "factuality" | "tone", number>;
    }).filter(r => r !== null);
    const humanMean = (key: "language" | "relevance" | "factuality" | "tone") => rowReviews.length ? rowReviews.reduce((s, r) => s + r[key], 0) / rowReviews.length : null;
    const categories = Object.fromEntries([...Map.groupBy(rows, r => r.category)].map(([k, rs]) => [k, { n: rs.length, passRate: rs.filter(r => r.finalGrade.pass).length / rs.length }]));
    const max = Math.max(...rows.map(r => r.result.attempts.length));
    const curve = Array.from({ length: max }, (_, index) => {
      const eligible = rows.filter(r => r.result.attempts[index]);
      const requests = eligible.flatMap(r => r.result.requests.filter(req => req.attempt === index));
      const humanScores = eligible.flatMap(row => {
        const matching = reviews.filter(r => r.rowId === row.id && r.attempt === index);
        return matching.length ? [matching.reduce((sum, r) => sum + (r.language + r.relevance + r.factuality + r.tone) / 16, 0) / matching.length] : [];
      });
      return { attempt: index, n: eligible.length, passRate: eligible.filter(r => r.attemptGrades[index]?.pass).length / eligible.length,
        incrementalCostUsd: requests.some(r => r.costUsd === null) ? null : requests.reduce((s, r) => s + (r.costUsd ?? 0), 0),
        p50AttemptMs: quantile(eligible.map(r => r.result.attempts[index]!.ms), 0.5), humanReviewed: humanScores.length, humanMean: humanScores.length ? humanScores.reduce((s, n) => s + n, 0) / humanScores.length : null };
    });
    const humanValues = [humanMean("language"), humanMean("relevance"), humanMean("factuality"), humanMean("tone")];
    return {
      model: rows[0]!.model, variant: rows[0]!.variant, n,
      successRate: rows.filter(r => r.result.status !== "unavailable").length / n,
      passRate: passed / n, passInterval95: wilson(passed, n),
      p50Ms: quantile(rows.map(r => r.result.totalMs), .5), p95Ms: quantile(rows.map(r => r.result.totalMs), .95),
      successP95Ms: quantile(rows.filter(r => r.result.status !== "unavailable").map(r => r.result.totalMs), .95),
      costUsd: unknown ? null : known, knownCostUsd: known, unknownCostRequests: unknown,
      estimatedCostRequests: rows.reduce((n, r) => n + r.result.requests.filter(req => req.costSource === "estimated").length, 0),
      costPerPassUsd: unknown || !passed ? null : known / passed,
      repairRate: repaired.length / n, recoveryRate: firstBad.length ? firstBad.filter(r => r.finalGrade.pass).length / firstBad.length : null,
      regressionRate: firstGood.length ? firstGood.filter(r => !r.finalGrade.pass).length / firstGood.length : null,
      unnecessaryRepairRate: repaired.length ? firstGood.length / repaired.length : null,
      gateDegradedRate: rows.filter(r => r.result.gateDegraded).length / n, categories, curve,
      human: { reviewed: rowReviews.length, coverage: rowReviews.length / n, mean: rowReviews.length ? humanValues.reduce<number>((s, v) => s + (v ?? 0), 0) / 4 : null,
        language: humanMean("language"), relevance: humanMean("relevance"), factuality: humanMean("factuality"), tone: humanMean("tone") },
    };
  });
}
// Recommendation only: never changes runtime configuration. No human review, no 'winner'.
export function recommend(s: Summary[], limits = { pass: .9, reliability: .95, p95Ms: 6000, human: .8, humanCoverage: .8 }) {
  const eligible = s.filter(r => r.passRate >= limits.pass && r.successRate >= limits.reliability && r.p95Ms !== null && r.p95Ms <= limits.p95Ms && r.costPerPassUsd !== null && r.human.coverage >= limits.humanCoverage && (r.human.mean ?? 0) >= limits.human && r.gateDegradedRate === 0);
  return eligible.sort((a, b) => a.costPerPassUsd! - b.costPerPassUsd! || a.p95Ms! - b.p95Ms!)[0] ?? null;
}
