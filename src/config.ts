import { readFile } from "node:fs/promises";
import type { Config, Model, Profile, Style, Turn } from "./types.js";
export const VERSION = "0.1.0";
export const PROMPT_VERSION = "prompt@1";
export const POLICY_VERSION = "policy@1";
export const QUERY_VERSION = "query@1";
export const RESPONSE_VERSION = "response@1";
export async function json<T>(path: string | URL): Promise<T> { return JSON.parse(await readFile(path, "utf8")) as T; }
export async function loadSettings() {
  const config = await json<Config>(new URL("../eval/config.json", import.meta.url));
  const profile = await json<Profile>(new URL("../eval/profile.json", import.meta.url));
  const catalog = await json<{ models: Model[] }>(new URL("../eval/models.json", import.meta.url));
  validateConfig(config, catalog.models);
  return { config, profile, models: catalog.models };
}
export function validateConfig(c: Config, models: Model[]) {
  if (c.version !== VERSION || !models.some(m => m.id === c.model) || (c.reasoningModel && !models.some(m => m.id === c.reasoningModel))) throw new Error("Invalid version or model configuration");
  if (!Number.isInteger(c.maxRepairs) || c.maxRepairs < 0 || c.maxRepairs > 2 || !Number.isInteger(c.maxTokens) || c.maxTokens < 32 || c.maxTokens > 2048 || !Number.isFinite(c.timeoutMs) || c.timeoutMs < 100 || c.timeoutMs > 60000 || !Number.isFinite(c.temperature) || c.temperature < 0 || c.temperature > 2) throw new Error("Invalid request limits");
  if (!["closed", "open"].includes(c.gateFailure) || typeof c.queryGate !== "boolean" || typeof c.responseGate !== "boolean") throw new Error("Invalid gate configuration");
}
export function parseStyle(value: unknown, defaults: Style): Style {
  if (value === undefined) return { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid style");
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some(k => !["tone", "detail", "language", "lowercase"].includes(k))) throw new Error("Unknown style option");
  const style = { ...defaults, ...v } as Style;
  if (!["warm", "formal", "neutral"].includes(style.tone) || !["brief", "balanced"].includes(style.detail) || !["tr", "en"].includes(style.language) || typeof style.lowercase !== "boolean") throw new Error("Invalid style option");
  return style;
}
export function parseTurns(value: unknown): Turn[] {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error("Expected 1–12 turns");
  const turns = value.map((turn: unknown) => {
    if (!turn || typeof turn !== "object") throw new Error("Invalid turn");
    const t = turn as Record<string, unknown>;
    if (!["user", "assistant"].includes(String(t.role)) || typeof t.content !== "string" || !t.content.trim() || t.content.length > 4000) throw new Error("Invalid turn");
    return { role: t.role, content: t.content } as Turn;
  });
  if (turns.at(-1)?.role !== "user" || turns.reduce((n, t) => n + t.content.length, 0) > 12000) throw new Error("Invalid conversation");
  return turns;
}
