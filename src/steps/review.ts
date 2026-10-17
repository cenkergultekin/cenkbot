import type { Gate } from "../types.js";
/** Review the actual draft; the pipeline may request one sequential rewrite. */
export const reviewReply = (gate: Gate, input: Parameters<Gate["judge"]>[0]) => gate.judge(input);
