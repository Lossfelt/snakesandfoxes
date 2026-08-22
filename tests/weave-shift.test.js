"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const gamePath = path.join(__dirname,"..","assets","game.js");
const gameSource = fs.readFileSync(gamePath,"utf8");
const boardMarker = "/* ================= board SVG";
const coreEnd = gameSource.indexOf(boardMarker);

if (coreEnd < 0) throw new Error("Fant ikke grensen for den testbare regelmotoren.");

const context = {
  URLSearchParams,
  console,
  crypto:globalThis.crypto,
  location:{search:""},
  performance:globalThis.performance
};

vm.runInNewContext(
  gameSource.slice(0,coreEnd) +
    "\nglobalThis.__gameTest = {RULESETS,graphForMode,shiftArrowsAt,cloneMutableGraph,nodes,id,CENTER,S,R};",
  context
);

const {RULESETS,graphForMode,shiftArrowsAt,cloneMutableGraph,nodes,id,CENTER,S,R} = context.__gameTest;

const plain = edge => Array.from(edge);
const plainEdges = graph => graph.dirEdges.map(plain);
const edgeMap = graph => new Map(graph.dirEdges.map(([from,to]) => [[from,to].sort((a,b) => a - b).join("-"),from]));
const touches = (edge,node) => edge[0] === node || edge[1] === node;

test("v6 arver nøyaktig de samme enveiskjøringene som v2", () => {
  const symbol = graphForMode("symbol","frø");
  const shifting = graphForMode("vevskifte","frø");
  assert.equal(shifting.dirEdges.length,symbol.dirEdges.length);
  assert.deepEqual(edgeMap(shifting),edgeMap(symbol));
});

test("bare de indre ringsegmentene er enveis", () => {
  const graph = graphForMode("vevskifte","frø");
  for (const [from,to,kind] of graph.dirEdges){
    assert.equal(kind,"ring");
    const ringOf = index => Number(nodes[index].split(",")[0]);
    assert.ok(ringOf(from) >= 1 && ringOf(from) < R,"ringsegment i ring 1-5: " + nodes[from]);
    assert.equal(ringOf(from),ringOf(to));
  }
});

test("ankomst snur begge ringsegmentene i noden, og bare dem", () => {
  const graph = graphForMode("vevskifte","frø");
  const node = id["3,4"];
  const before = plainEdges(graph);
  assert.equal(shiftArrowsAt(graph,node),true);
  const after = plainEdges(graph);
  let flipped = 0;
  for (let index = 0; index < before.length; index++){
    if (touches(before[index],node)){
      assert.deepEqual(after[index],[before[index][1],before[index][0],before[index][2]]);
      flipped++;
    } else {
      assert.deepEqual(after[index],before[index]);
    }
  }
  assert.equal(flipped,2,"en indre ringnode har nøyaktig to ringsegmenter");
});

test("to ankomster på samme node gir veven tilbake", () => {
  const graph = graphForMode("vevskifte","frø");
  const before = plainEdges(graph);
  shiftArrowsAt(graph,id["2,7"]);
  shiftArrowsAt(graph,id["2,7"]);
  assert.deepEqual(plainEdges(graph),before);
});

test("sentrum, ytterring og hjørner har ingen piler å snu", () => {
  const graph = graphForMode("vevskifte","frø");
  const before = plainEdges(graph);
  for (const node of [CENTER,id["K0"],id["K2"],...Array.from({length:S},(_,s) => id[R + "," + s])]){
    assert.equal(shiftArrowsAt(graph,node),false,"ingen skifte ved " + nodes[node]);
  }
  assert.deepEqual(plainEdges(graph),before);
});

test("snuingen følges av nabolistene i begge retninger", () => {
  const graph = graphForMode("vevskifte","frø");
  const node = id["1,0"];
  const outgoing = graph.dirEdges.filter(edge => touches(edge,node)).map(edge => edge.slice());
  shiftArrowsAt(graph,node);
  for (const [from,to] of outgoing){
    assert.ok(!graph.out[from].includes(to),"gammel retning er borte");
    assert.ok(graph.out[to].includes(from),"ny retning er lagt inn");
    assert.ok(!graph.outSC[to].includes(from),"fiendenettet følger med");
    assert.ok(graph.outSC[from].includes(to),"fiendenettet følger med");
  }
});

test("eikene forblir toveis, så ingen brikke kan bli innelåst", () => {
  const graph = graphForMode("vevskifte","frø");
  for (let round = 0; round < 200; round++) shiftArrowsAt(graph,1 + (round * 7) % (S * R));
  for (let node = 0; node < nodes.length; node++){
    assert.ok(graph.out[node].length > 0,"noden har en utvei: " + nodes[node]);
  }
});

test("en kopi av veven skifter uavhengig av originalen", () => {
  const graph = graphForMode("vevskifte","frø");
  const copy = cloneMutableGraph(graph);
  const before = plainEdges(graph);
  shiftArrowsAt(copy,id["4,2"]);
  assert.deepEqual(plainEdges(graph),before);
  assert.notDeepEqual(plainEdges(copy),before);
  assert.notEqual(copy.key,graph.key);
});

test("avstandene regnes på nytt etter et skifte", () => {
  const graph = graphForMode("vevskifte","frø");
  const from = id["3,1"], to = id["3,0"];
  assert.ok(graph.dist[from][to] > 1,"ring 3 går med klokken, så motsatt vei er en omvei");
  shiftArrowsAt(graph,to);
  assert.equal(graph.dist[from][to],1,"segmentet peker nå den andre veien");
});

test("v6 flytter én node om gangen", () => {
  assert.equal(RULESETS.vevskifte.singleStep,true);
  assert.equal(RULESETS.vevskifte.shiftOnArrive,true);
  assert.equal(RULESETS.symbol.singleStep,undefined);
  assert.equal(RULESETS.symbol.shiftOnArrive,undefined);
});
