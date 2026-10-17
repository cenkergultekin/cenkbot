import { performance } from "node:perf_hooks";
import { buildPrompt, repairPrompt } from "./prompts.js";
import { parseStyle, parseTurns } from "./config.js";
import { RequestError, type Answer, type Config, type Gate, type Generator, type Profile, type Style, type Turn } from "./types.js";
export function createBot(deps: { generator: Generator; gate?: Gate; config: Config; profile: Profile }) {
  return { async answer(input: { turns: Turn[]; style?: Partial<Style>; signal?: AbortSignal }): Promise<Answer> {
    const started = performance.now();
    const turns = parseTurns(input.turns);
    const style = parseStyle(input.style, deps.profile.style);
    const message = turns.at(-1)!.content;
    const history = turns.slice(0, -1);
    const config = deps.config;
    const profile = { ...deps.profile, style };
    const result: Answer = { text: "", status: "ok", route: "default", selectedModel: config.model, attempts: [], requests: [], totalMs: 0, costUsd: 0, knownCostUsd: 0, unknownCostRequests: 0, gateDegraded: false };
    const finish = () => {
      result.totalMs = performance.now() - started;
      result.knownCostUsd = result.requests.reduce((sum, r) => sum + (r.costUsd ?? 0), 0);
      result.unknownCostRequests = result.requests.filter(r => r.costUsd === null).length;
      result.costUsd = result.unknownCostRequests ? null : result.knownCostUsd;
      return result;
    };
    const unavailable = () => { result.status = "unavailable"; result.text = profile.unavailable[style.language]; return finish(); };
    const failGate = (error: unknown) => {
      result.gateDegraded = true;
      if (error instanceof RequestError) result.requests.push(error.record);
    };
    // Whole-message greeting only: an attack prefixed with 'hello' never shortcuts the gate.
    if (/^(?:selam|merhaba|hello|hi)[!.\s]*$/iu.test(message.trim())) {
      result.text = profile.greeting[style.language]; result.route = "static"; result.selectedModel = null; return finish();
    }
    let model = config.model;
    if (config.queryGate) {
      try {
        if (!deps.gate) throw new Error("Missing query gate");
        const query = await deps.gate.query({ message, history, profile, signal: input.signal });
        result.requests.push(query.record);
        if (query.action === "refuse") { result.text = profile.refusal[style.language]; result.status = "refused"; result.selectedModel = null; return finish(); }
        if (config.reasoningModel && query.complexity === "reason" && query.confidence >= 0.85) { model = config.reasoningModel; result.route = "reasoning"; }
      } catch (error) { failGate(error); if (config.gateFailure === "closed") return unavailable(); }
    }
    result.selectedModel = model;
    const system = buildPrompt(profile, style);
    let prompt = system;
    // No speculation, no hedges, no model/provider fallbacks. Repairs are sequential and explicit.
    for (let index = 0; index <= config.maxRepairs; index++) {
      if (input.signal?.aborted) return unavailable();
      const attemptStarted = performance.now();
      try {
        const completion = await deps.generator.complete({ model, system: prompt, turns, config, purpose: index ? "repair" : "draft", signal: input.signal });
        result.requests.push({ ...completion.record, attempt: index });
        const attempt: Answer["attempts"][number] = { index, text: completion.text, verdict: "unchecked", reasons: [], ms: 0 };
        result.attempts.push(attempt);
        if (!config.responseGate) { attempt.ms = performance.now() - attemptStarted; result.text = completion.text; return finish(); }
        try {
          if (!deps.gate) throw new Error("Missing response gate");
          const judged = await deps.gate.judge({ message, history, reply: completion.text, profile, style, signal: input.signal });
          result.requests.push({ ...judged.record, attempt: index });
          attempt.verdict = judged.action; attempt.reasons = judged.reasons; attempt.signals = judged.signals;
        } catch (error) {
          failGate(error); attempt.ms = performance.now() - attemptStarted;
          if (config.gateFailure === "closed") return unavailable();
          result.text = completion.text; return finish();
        }
        attempt.ms = performance.now() - attemptStarted;
        if (attempt.verdict === "send") { result.text = completion.text; return finish(); }
        if (attempt.verdict === "refuse") { result.text = profile.refusal[style.language]; result.status = "refused"; return finish(); }
        if (index === config.maxRepairs) return unavailable();
        prompt = repairPrompt(system, completion.text, attempt.reasons);
      } catch (error) {
        if (error instanceof RequestError) result.requests.push(error.record);
        return unavailable();
      }
    }
    return unavailable();
  } };
}
