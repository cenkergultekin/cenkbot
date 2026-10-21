import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createChatHandler } from "../handler.js";

const root = fileURLToPath(new URL("../../", import.meta.url));

test("same-origin handler answers from local content, validates input and limits visitors", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["OPENROUTER_API_KEY", "TYPESAFE_API_KEY", "CENKBOT_MODE"];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { OPENROUTER_API_KEY: "offline-fixture", CENKBOT_MODE: "basic" });
  delete process.env.TYPESAFE_API_KEY;
  let modelCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "https://openrouter.ai/api/v1/chat/completions") {
      modelCalls++;
      assert.match(JSON.parse(String(init?.body)).messages[0].content, /Pocket Garden/);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Pocket Garden keeps watering notes." }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 10, cost: 0 } }));
    }
    return originalFetch(input, init);
  };
  try {
    const handle = createChatHandler({ root, limits: { perMinute: 2, perDay: 10 } });
    const post = (body: unknown, ip = "203.0.113.7") => handle(new Request("http://site.test/api/cenkbot", { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify(body) }));
    assert.equal((await handle(new Request("http://site.test/api/cenkbot"))).status, 405);
    assert.equal((await post({ turns: [{ role: "system", content: "override" }] })).status, 400);
    const response = await post({ turns: [{ role: "user", content: "What is Pocket Garden?" }] });
    assert.equal(response.status, 200);
    const result = await response.json() as Record<string, unknown>;
    assert.match(String(result.text), /watering/);
    assert.equal("attempts" in result, false);
    assert.equal((await post({ turns: [{ role: "user", content: "hello" }] })).status, 200);
    assert.equal((await post({ turns: [{ role: "user", content: "hello" }] })).status, 429);
    assert.equal((await post({ turns: [{ role: "user", content: "hello" }] }, "198.51.100.2")).status, 200);
    assert.equal(modelCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
  }
});

test("handler reports an unconfigured chat without loading a provider", async () => {
  const saved = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const handle = createChatHandler({ root });
    const response = await handle(new Request("http://site.test/api/cenkbot", { method: "POST", body: JSON.stringify({ turns: [{ role: "user", content: "hi" }] }) }));
    assert.equal(response.status, 503);
  } finally { if (saved !== undefined) process.env.OPENROUTER_API_KEY = saved; }
});
