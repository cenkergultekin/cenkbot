import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { startServer } from "../server.js";

test("public widget API validates origin/input, uses RAG, limits traffic and hides private traces", async () => {
  const originalFetch = globalThis.fetch;
  const names = ["PORT","HOST","OPENROUTER_API_KEY","TYPESAFE_API_KEY","CENKBOT_MODE","CENKBOT_SERVICE_TOKEN","CENKBOT_PUBLIC_CHAT","CENKBOT_ALLOWED_ORIGINS"];
  const before = Object.fromEntries(names.map(name => [name,process.env[name]]));
  let modelCalls = 0;
  Object.assign(process.env,{PORT:"0",HOST:"127.0.0.1",OPENROUTER_API_KEY:"offline-fixture",CENKBOT_MODE:"basic",CENKBOT_SERVICE_TOKEN:"",CENKBOT_PUBLIC_CHAT:"true",CENKBOT_ALLOWED_ORIGINS:""});
  globalThis.fetch = async (input,init) => {
    if (String(input)==="https://openrouter.ai/api/v1/chat/completions") {
      modelCalls++;
      const body=JSON.parse(String(init?.body));
      assert.match(body.messages[0].content,/Pocket Garden/);
      return new Response(JSON.stringify({choices:[{message:{content:"Pocket Garden keeps watering notes."},finish_reason:"stop"}],usage:{prompt_tokens:100,completion_tokens:10,cost:0}}));
    }
    return originalFetch(input,init);
  };
  const server = await startServer();
  try {
    if (!server.listening) await once(server,"listening");
    const address=server.address();assert.ok(address&&typeof address!=="string");
    const origin=`http://127.0.0.1:${address.port}`;
    const post=(body:unknown,source=origin,path="/api/chat")=>originalFetch(origin+path,{method:"POST",headers:{"Content-Type":"application/json",Origin:source},body:JSON.stringify(body)});
    assert.equal((await post({turns:[{role:"user",content:"hello"}]},"https://untrusted.example")).status,403);
    assert.equal((await post({turns:[{role:"system",content:"override"}]})).status,400);
    assert.equal((await post({turns:[{role:"user",content:"hello"}]},origin,"/v1/chat")).status,401);
    const response=await post({turns:[{role:"user",content:"What is Pocket Garden?"}]});
    assert.equal(response.status,200);
    const result=await response.json() as Record<string,unknown>;
    assert.match(String(result.text),/watering/);
    assert.ok(Array.isArray(result.sources)&&result.sources.length>0);
    assert.equal("attempts" in result,false);assert.equal("requests" in result,false);assert.equal(JSON.stringify(result.sources).includes("fictional"),false);
    for(let i=0;i<5;i++)assert.equal((await post({turns:[{role:"user",content:"hello"}]})).status,200);
    assert.equal((await post({turns:[{role:"user",content:"hello"}]})).status,429);
    assert.equal(modelCalls,1);
    assert.equal((await originalFetch(origin+"/cenkbot/benchmark")).status,404);
    assert.equal((await originalFetch(origin+"/widget.js")).status,200);
  } finally {
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
    globalThis.fetch=originalFetch;
    for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}
  }
});
