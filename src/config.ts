import { readFile, readdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import type { Config, Model, Profile, Style, Turn } from "./types.js";
export const VERSION = "0.2.2";
export const PROMPT_VERSION = "prompt@2";
export const POLICY_VERSION = "policy@2";
export const SOFT_REPAIR_REASONS: ReadonlySet<string> = new Set(["concise"]);
export const QUERY_VERSION = "query@1";
export const RESPONSE_VERSION = "response@1";
export async function json<T>(path: string | URL): Promise<T> { return JSON.parse(await readFile(path, "utf8")) as T; }
export async function loadSettings() {
  const root = process.env.CENKBOT_ROOT ? resolve(process.env.CENKBOT_ROOT) : new URL("../", import.meta.url);
  const path = (file: string) => typeof root === "string" ? join(root, file) : new URL(file, root);
  const config = await json<Config>(path("config/bot.json"));
  const profile = await json<Profile>(path("content/profile.json"));
  config.version = VERSION;
  if (process.env.CENKBOT_MODEL) config.model = process.env.CENKBOT_MODEL;
  const mode = process.env.CENKBOT_MODE ?? (process.env.TYPESAFE_API_KEY ? "reviewed" : "basic");
  if (!["basic", "reviewed"].includes(mode)) throw new Error("CENKBOT_MODE must be basic or reviewed");
  config.queryGate = mode === "reviewed";
  config.responseGate = mode === "reviewed";
  config.maxRepairs = mode === "reviewed" ? 1 : 0;
  const models: Model[] = [{ id: config.model }, ...(config.reasoningModel ? [{ id: config.reasoningModel }] : [])];
  validateConfig(config, models);
  parseStyle(profile.style, profile.style);
  if (!profile.name?.trim() || profile.name.length > 120 || !profile.scope?.trim() || profile.scope.length > 2000 || typeof profile.knowledge !== "string" || profile.knowledge.length > 10000) throw new Error("Invalid portfolio profile");
  for (const messages of [profile.greeting, profile.refusal, profile.unavailable]) if (!messages || [messages.tr,messages.en].some(value => typeof value !== "string" || !value.trim() || value.length > 1000)) throw new Error("Invalid portfolio status messages");
  const entries = (await readdir(path("content"))).filter(name => name.endsWith(".md")).sort();
  if (entries.length > 64) throw new Error("At most 64 portfolio documents are supported");
  const documents = await Promise.all(entries.map(async name => {
    const text = await readFile(path(`content/${name}`), "utf8");
    if (text.length > 100000) throw new Error("Portfolio document exceeds 100000 characters");
    return { id: basename(name, ".md"), title: text.match(/^#\s+(.+)$/m)?.[1] ?? basename(name, ".md"), text };
  }));
  return { config, profile, models, documents };
}
export function validateConfig(c: Config, models: Model[]) {
  if (c.version !== VERSION || !/^[\w./:-]{3,128}$/.test(c.model) || !models.some(m => m.id === c.model) || (c.reasoningModel && !models.some(m => m.id === c.reasoningModel))) throw new Error("Invalid version or model configuration");
  if (!Number.isInteger(c.maxRepairs) || c.maxRepairs < 0 || c.maxRepairs > 1 || !Number.isInteger(c.maxTokens) || c.maxTokens < 32 || c.maxTokens > 2048 || !Number.isFinite(c.timeoutMs) || c.timeoutMs < 100 || c.timeoutMs > 60000 || !Number.isFinite(c.temperature) || c.temperature < 0 || c.temperature > 2) throw new Error("Invalid request limits");
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
