import type { Case, Grade } from "./schema.js";
export const EVALUATOR_VERSION = "deterministic@1";
// Objective checks are not Turkish fluency or human preference scores.
export function grade(c: Case, text: string): Grade {
  const checks: Grade["checks"] = [{ name: "nonempty", pass: text.trim().length > 0 }];
  const matches = (p: string) => new RegExp(p, "iu").test(text);
  for (const p of c.all ?? []) checks.push({ name: `required:${p}`, pass: matches(p) });
  if (c.any?.length) checks.push({ name: "any-required", pass: c.any.some(matches) });
  for (const p of c.none ?? []) checks.push({ name: `forbidden:${p}`, pass: !matches(p) });
  if (c.maxWords) checks.push({ name: "word-limit", pass: text.trim().split(/\s+/u).length <= c.maxWords });
  return { pass: checks.every(c => c.pass), checks };
}
export function finalGrade(c: Case, text: string, status: string): Grade {
  const g = grade(c, text);
  g.checks.push({ name: "available", pass: status !== "unavailable" });
  g.pass = g.checks.every(c => c.pass);
  return g;
}
