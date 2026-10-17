import test from "node:test";
import assert from "node:assert/strict";
import { createLocalRetriever, retrieveContext } from "../steps/retrieve.js";
import { createBot } from "../engine.js";
import { loadSettings } from "../config.js";
import { TrafficGuard } from "../limits.js";
import type { Gate, Generator, RequestRecord } from "../types.js";

const { config, profile } = await loadSettings();
const documents = [
  { id: "garden", title: "Pocket Garden", text: "Pocket Garden tracks watering notes for plants.", url: "https://example.com/garden" },
  { id: "books", title: "Open Shelf", text: "Open Shelf organizes books and reading notes." },
  { id: "place", title: "İzmir", text: "Ada presented a project in İzmir." },
];
const record = (purpose: RequestRecord["purpose"]): RequestRecord => ({ purpose,model:"fake",status:"ok",ms:1,costUsd:0,costSource:"reported" });

test("local RAG ranks relevant public passages and leaves unrelated questions empty", async () => {
  const retriever = createLocalRetriever(documents,{topK:1});
  assert.equal((await retriever.retrieve({message:"Pocket Garden watering",history:[]}))[0]?.id,"garden:0");
  assert.deepEqual(await retriever.retrieve({message:"quantum banking",history:[]}),[]);
  assert.equal((await retriever.retrieve({message:"IZMIR",history:[]}))[0]?.id,"place:0");
  assert.throws(()=>createLocalRetriever([documents[0]!,documents[0]!]));
});

test("short follow-ups can retrieve the previous topic; cancellation stops retrieval", async () => {
  const retriever=createLocalRetriever(documents,{topK:1});
  const result=await retriever.retrieve({message:"details?",history:[{role:"user",content:"Pocket Garden"}]});
  assert.equal(result[0]?.id,"garden:0");
  await assert.rejects(retriever.retrieve({message:"Pocket Garden",history:[],signal:AbortSignal.abort()}));
});

test("retrieved context is bounded and source URLs cannot execute scripts", async () => {
  const result=await retrieveContext({async retrieve(){return Array.from({length:8},(_,i)=>({id:String(i),title:"Source",text:"\u0000".repeat(10000),url:"javascript:alert(1)"}));}},{message:"project",history:[]});
  assert.ok(result.sources.length<=3);
  assert.ok(result.context.length<2600);
  assert.ok(result.sources.every(source=>source.url===undefined));
});

test("reviewed pipeline routes, retrieves, generates and reviews the same grounded context", async () => {
  const order:string[]=[];
  const generator:Generator={async complete(input){order.push("generate");assert.match(input.system,/watering notes/);return{text:"Pocket Garden tracks watering notes.",record:record("draft")};}};
  const gate:Gate={async query(){order.push("route");return{action:"answer",complexity:"lookup",confidence:1,formal:false,record:record("query")};},async judge(input){order.push("review");assert.match(input.profile.knowledge,/watering notes/);return{action:"send",reasons:[],record:record("judge")};}};
  const retriever=createLocalRetriever(documents,{topK:1});
  const bot=createBot({config:{...config,queryGate:true,responseGate:true,maxRepairs:1},profile,generator,gate,retriever:{async retrieve(input){order.push("retrieve");return retriever.retrieve(input);}}});
  const answer=await bot.answer({turns:[{role:"user",content:"What is Pocket Garden?"}]});
  assert.deepEqual(order,["route","retrieve","generate","review"]);
  assert.equal(answer.status,"ok");assert.equal(answer.sources[0]?.id,"garden:0");assert.equal(answer.attempts.length,1);
});

test("basic mode uses one model call and retrieval failures do not trigger generation", async () => {
  let calls=0;
  const generator:Generator={async complete(){calls++;return{text:"Pocket Garden tracks plants.",record:record("draft")};}};
  const bot=createBot({config:{...config,queryGate:false,responseGate:false,maxRepairs:0},profile,generator,retriever:createLocalRetriever(documents)});
  await bot.answer({turns:[{role:"user",content:"Pocket Garden"}]});assert.equal(calls,1);
  const broken=createBot({config:{...config,queryGate:false,responseGate:false,maxRepairs:0},profile,generator,retriever:{async retrieve(){throw Error("unavailable");}}});
  const answer=await broken.answer({turns:[{role:"user",content:"Pocket Garden"}]});assert.equal(answer.status,"unavailable");assert.equal(calls,1);
  assert.throws(()=>createBot({config:{...config,maxRepairs:2},profile,generator}));
});

test("small-instance limits enforce per-client and daily budgets without growing forever", () => {
  const guard=new TrafficGuard({perMinute:2,perDay:3});
  assert.equal(guard.take("a",0),true);assert.equal(guard.take("a",1),true);assert.equal(guard.take("a",2),false);
  assert.equal(guard.take("b",3),true);assert.equal(guard.take("a",60000),false);assert.equal(guard.take("a",86400000),true);
});
