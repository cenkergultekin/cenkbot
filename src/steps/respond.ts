import type { Generator } from "../types.js";
/** Generate one answer with the selected model and retrieved context. */
export const generateReply = (generator: Generator, input: Parameters<Generator["complete"]>[0]) => generator.complete(input);
