import type { Gate, Generator, RequestRecord } from "../types.js";
const record = (purpose: RequestRecord["purpose"]): RequestRecord => ({ purpose, model: "mock", status: "ok", ms: 1, costUsd: 0, costSource: "reported" });
// Deterministic wiring check only, intentionally not a plausible LLM benchmark.
export const mockGenerator: Generator = { async complete(input) { return { text: "MOCK: this is a pipeline smoke test, not a model response.", record: record(input.purpose) }; } };
export const mockGate: Gate = {
  async query() { return { action: "answer", complexity: "lookup", confidence: 1, formal: false, record: record("query") }; },
  async judge(input) { return { action: input.reply.startsWith("MOCK") ? "repair" : "send", reasons: ["mock-only"], record: record("judge") }; },
};
