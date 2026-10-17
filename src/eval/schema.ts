import type { Answer, Config, Model, Style, Turn } from "../types.js";
export type Case = {
  id: string; category: string; turns: Turn[]; style?: Partial<Style>;
  all?: string[]; any?: string[]; none?: string[]; maxWords?: number;
};
export type Suite = { id: string; version: string; public: boolean; cases: Case[] };
export type Grade = { pass: boolean; checks: { name: string; pass: boolean }[] };
export type HumanReview = { rowId: string; attempt: number | "final"; reviewer: string; language: number; relevance: number; factuality: number; tone: number; note?: string };
export type Row = { id: string; caseId: string; category: string; model: string; repeat: number; variant: string; result: Answer; finalGrade: Grade; attemptGrades: Grade[] };
export type Run = {
  schemaVersion: 1; id: string; kind: "mock" | "live"; startedAt: string; finishedAt?: string;
  version: string; commit: string; dirty: boolean; suiteId: string; suiteVersion: string;
  suiteHash: string; profileHash: string; promptHash: string; evaluatorHash: string;
  configHash: string; policyHash: string; catalogHash: string; runtime: string; platform: string;
  config: Config; models: Model[]; variants: string[]; repeats: number;
  suitePublic: boolean; publicFixture: boolean; status: "complete" | "partial";
  rows: Row[];
};
export type Summary = {
  model: string; variant: string; n: number; successRate: number; passRate: number;
  passInterval95: [number, number]; p50Ms: number | null; p95Ms: number | null;
  successP95Ms: number | null; costUsd: number | null; knownCostUsd: number;
  estimatedCostRequests: number; unknownCostRequests: number; costPerPassUsd: number | null;
  repairRate: number; recoveryRate: number | null; regressionRate: number | null;
  unnecessaryRepairRate: number | null; gateDegradedRate: number;
  categories: Record<string, { n: number; passRate: number }>;
  curve: { attempt: number; n: number; passRate: number; incrementalCostUsd: number | null; p50AttemptMs: number | null; humanReviewed: number; humanMean: number | null }[];
  human: { reviewed: number; coverage: number; mean: number | null; language: number | null; factuality: number | null; tone: number | null; relevance: number | null };
};
