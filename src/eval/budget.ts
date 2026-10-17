import type { Generator, Model } from "../types.js";
export class Budget {
  committedUsd = 0;
  exhausted = false;
  constructor(readonly maxUsd: number) {
    if (!Number.isFinite(maxUsd) || maxUsd <= 0 || maxUsd > 100) throw new Error("Budget must be >0 and <=100 USD");
  }
  reserve(usd: number) {
    if (!Number.isFinite(usd) || usd < 0 || this.committedUsd + usd > this.maxUsd) { this.exhausted = true; throw new Error("Eval budget exhausted"); }
    // Conservative reservation retained even on errors; missing billing never becomes zero.
    this.committedUsd += usd;
  }
  wrap(generator: Generator, models: Model[]): Generator {
    return { complete: async input => {
      const model = models.find(m => m.id === input.model)!;
      // UTF-8 bytes provide a conservative prompt-token allowance; add protocol overhead.
      const inputAllowance = Buffer.byteLength(input.system + JSON.stringify(input.turns), "utf8") + 2048;
      const reservation = (inputAllowance * model.inputUsdPerMillion + input.config.maxTokens * model.outputUsdPerMillion) / 1e6;
      this.reserve(reservation);
      const result = await generator.complete(input);
      if (result.record.costUsd !== null && result.record.costUsd > reservation) this.committedUsd += result.record.costUsd - reservation;
      return result;
    } };
  }
}
