export type Turn = { role: "user" | "assistant"; content: string };
export type Style = { tone: "warm" | "formal" | "neutral"; detail: "brief" | "balanced"; language: "tr" | "en"; lowercase: boolean };
export type Profile = {
  id: string; version: string; name: string; scope: string; knowledge: string;
  style: Style; greeting: { tr: string; en: string };
  refusal: { tr: string; en: string }; unavailable: { tr: string; en: string };
};
export type Model = { id: string; provider?: string; inputUsdPerMillion?: number; outputUsdPerMillion?: number; role?: string };
export type Source = { id: string; title: string; text: string; url?: string };
export interface Retriever {
  retrieve(input: { message: string; history: Turn[]; signal?: AbortSignal }): Promise<Source[]>;
}
export type Config = {
  version: string; model: string; reasoningModel?: string; queryGate: boolean; responseGate: boolean;
  maxRepairs: number; maxTokens: number; timeoutMs: number; temperature: number;
  gateFailure: "closed" | "open";
};
export type RequestRecord = {
  attempt?: number;
  purpose: "query" | "draft" | "repair" | "judge"; model: string; provider?: string;
  status: "ok" | "error"; ms: number; inputTokens?: number; outputTokens?: number;
  costUsd: number | null; costSource: "reported" | "estimated" | "unknown"; error?: string;
};
export type Completion = { text: string; record: RequestRecord };
export interface Generator {
  complete(input: { model: string; system: string; turns: Turn[]; config: Config; purpose: "draft" | "repair"; signal?: AbortSignal }): Promise<Completion>;
}
export type QueryVerdict = { action: "answer" | "refuse"; complexity: "lookup" | "compose" | "reason"; confidence: number; formal: boolean; record: RequestRecord };
export type Verdict = { action: "send" | "repair" | "refuse"; reasons: string[]; record: RequestRecord; signals?: Record<string, number> };
export interface Gate {
  query(input: { message: string; history: Turn[]; profile: Profile; signal?: AbortSignal }): Promise<QueryVerdict>;
  judge(input: { message: string; history: Turn[]; reply: string; profile: Profile; style: Style; signal?: AbortSignal }): Promise<Verdict>;
}
export type Attempt = { index: number; text: string; verdict: "send" | "repair" | "refuse" | "unchecked"; reasons: string[]; ms: number; signals?: Record<string, number>; acceptedStyleOnly?: boolean };
export type Answer = {
  text: string; status: "ok" | "refused" | "unavailable"; route: "static" | "default" | "reasoning";
  selectedModel: string | null; attempts: Attempt[]; requests: RequestRecord[]; totalMs: number;
  costUsd: number | null; knownCostUsd: number; unknownCostRequests: number; gateDegraded: boolean;
  sources: Source[];
};
export class RequestError extends Error {
  constructor(message: string, readonly record: RequestRecord) { super(message); }
}
