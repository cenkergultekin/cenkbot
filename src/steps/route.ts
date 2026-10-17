import type { Gate } from "../types.js";
/** Decide scope before generating an answer. No competing provider calls. */
export const routeQuestion = (gate: Gate, input: Parameters<Gate["query"]>[0]) => gate.query(input);
