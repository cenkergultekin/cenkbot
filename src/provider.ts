import { performance } from "node:perf_hooks";
import { RequestError, type Generator, type Model, type RequestRecord } from "./types.js";
export function openRouter(models: Model[], apiKey = process.env.OPENROUTER_API_KEY, fetcher: typeof fetch = fetch): Generator {
  return { async complete(input) {
    const started = performance.now();
    const model = models.find(m => m.id === input.model);
    if (!model) throw new Error("Model not in catalog");
    const base = { purpose: input.purpose, model: input.model, provider: model.provider, costUsd: null, costSource: "unknown" } as const;
    try {
      if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
      const timeout = AbortSignal.timeout(input.config.timeoutMs);
      const response = await fetcher("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", signal: input.signal ? AbortSignal.any([timeout, input.signal]) : timeout,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Cenkbot" },
        body: JSON.stringify({ model: input.model, messages: [{ role: "system", content: input.system }, ...input.turns],
          temperature: input.config.temperature, max_tokens: input.config.maxTokens, stream: false,
          provider: { allow_fallbacks: false, ...(model.provider ? { only: [model.provider] } : {}) },
        }),
      });
      if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
      const data = await response.json() as { model?: string; provider?: string; choices?: { message?: { content?: unknown }; finish_reason?: string }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number } };
      const choice = data.choices?.[0];
      if (typeof choice?.message?.content !== "string" || !choice.message.content.trim() || choice.finish_reason === "length") throw new Error("Empty or truncated completion");
      const usage = data.usage;
      const knownTokens = typeof usage?.prompt_tokens === "number" && typeof usage?.completion_tokens === "number";
      const reported = typeof usage?.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0;
      const estimated = knownTokens ? (usage!.prompt_tokens! * model.inputUsdPerMillion + usage!.completion_tokens! * model.outputUsdPerMillion) / 1e6 : null;
      const record: RequestRecord = { ...base, model: data.model ?? input.model, provider: data.provider ?? model.provider, status: "ok", ms: performance.now() - started, inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, costUsd: reported ? usage!.cost! : estimated, costSource: reported ? "reported" : estimated === null ? "unknown" : "estimated" };
      return { text: choice.message.content.trim(), record };
    } catch (error) {
      // Never include a response body or provider error string: it can echo user data or credentials.
      const message = error instanceof Error && /^(OpenRouter HTTP \d+|Empty or truncated completion|OPENROUTER_API_KEY is not configured)$/.test(error.message) ? error.message : "Model request failed or timed out";
      throw new RequestError(message, { ...base, status: "error", ms: performance.now() - started, error: message });
    }
  } };
}
