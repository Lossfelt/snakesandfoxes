"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const gamePath = path.join(__dirname, "..", "assets", "game.js");
const gameSource = fs.readFileSync(gamePath, "utf8");
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
    "\nglobalThis.__gameTest = {Engine,graphForMode,cloneBurnGraph,burnEdge,isBurnedEdge,isThinEdge,symbolSnakeMovement,nodes,id,CENTER,RULESETS};",
  context
);

const {
  Engine,graphForMode,cloneBurnGraph,burnEdge,isBurnedEdge,isThinEdge,symbolSnakeMovement,nodes,id,CENTER,RULESETS
} = context.__gameTest;
const deterministic = {pick:items => items[0] ?? null};

const burnGraph = () => graphForMode("brenteBroer", 4711);

test("v7 Brente Broer bruker en egen, brennbar vev", () => {
  const rules = RULESETS.brenteBroer;
  assert.equal(rules.topology, "burn");
  assert.equal(rules.enemy, "symbols");
  assert.equal(rules.returnRule, "free");
  const graph = burnGraph();
  assert.equal(graph.burn, true);
  assert.equal(graph.burned.size, 0);
  const other = burnGraph();
  assert.notEqual(graph, other, "hvert spill skal få sin egen vev å brenne opp");
});

test("et ringsegment ryker etter én bruk, i begge retninger", () => {
  const graph = burnGraph();
  const from = id["3,0"], to = id["3,1"];
  assert.ok(graph.out[from].includes(to) || graph.out[to].includes(from));
  assert.equal(burnEdge(graph, from, to), true);
  assert.equal(isBurnedEdge(graph, from, to), true);
  assert.equal(isBurnedEdge(graph, to, from), true);
  assert.equal(graph.out[from].includes(to), false);
  assert.equal(graph.out[to].includes(from), false);
  assert.equal(graph.outSC[from].includes(to), false);
  assert.equal(graph.outSC[to].includes(from), false);
  assert.equal(graph.dirEdges.some(edge => (edge[0] === from && edge[1] === to) || (edge[0] === to && edge[1] === from)), false);
  assert.equal(burnEdge(graph, from, to), false, "en tråd kan bare brenne opp én gang");
});

test("ytterringen er også tynn", () => {
  const graph = burnGraph();
  assert.equal(burnEdge(graph, id["6,0"], id["6,1"]), true);
  assert.equal(graph.out[id["6,0"]].includes(id["6,1"]), false);
});

test("eiker og hjørnelenker er tykke tråder", () => {
  const graph = burnGraph();
  const inner = id["3,0"], outer = id["4,0"];
  assert.equal(isThinEdge(inner, outer), false);
  assert.equal(burnEdge(graph, inner, outer), false);
  assert.equal(graph.out[inner].includes(outer), true);

  assert.equal(isThinEdge(CENTER, id["1,0"]), false);
  assert.equal(burnEdge(graph, CENTER, id["1,0"]), false);
  assert.equal(graph.out[CENTER].includes(id["1,0"]), true);

  const corner = id.K0, entry = id["6,1"];
  assert.equal(isThinEdge(corner, entry), false);
  assert.equal(burnEdge(graph, corner, entry), false);
  assert.equal(graph.out[corner].includes(entry), true);
});

test("ingen node blir innelåst selv om alle ringtråder brenner", () => {
  const graph = burnGraph();
  for (let ring = 1; ring <= 6; ring++){
    for (let spoke = 0; spoke < 12; spoke++){
      burnEdge(graph, id[ring + "," + spoke], id[ring + "," + ((spoke + 1) % 12)]);
    }
  }
  assert.equal(graph.burned.size, 72);
  for (let node = 0; node < nodes.length; node++){
    if (nodes[node][0] === "K") continue;
    assert.ok(graph.out[node].length > 0, "noden " + nodes[node] + " mistet alle tråder");
  }
  assert.ok(graph.dist[CENTER][id["6,0"]] > 0, "veien ut skal fortsatt finnes");
  assert.ok(graph.dist[id["6,0"]][CENTER] > 0, "veien hjem skal fortsatt finnes");
  assert.equal(graph.outerDist[CENTER], 6);
});

test("brente tråder finnes ikke i lovlige trekk for spilleren", () => {
  const graph = burnGraph();
  const state = {
    players:[{pos:id["3,0"],alive:true,touched:false,done:false,steps:2,touchSpoke:-1}],
    dark:[]
  };
  const before = Engine.legalMoves(state, 0, RULESETS.brenteBroer, graph);
  assert.ok(before.includes(id["3,1"]));
  burnEdge(graph, id["3,0"], id["3,1"]);
  const after = Engine.legalMoves(state, 0, RULESETS.brenteBroer, graph);
  assert.equal(after.includes(id["3,1"]), false);
  assert.ok(after.includes(id["4,0"]), "eiken utover skal fortsatt være lovlig");
});

test("en slange kan ikke gå tilbake over tråden den nettopp brant", () => {
  const graph = burnGraph();
  const state = {
    players:[{pos:id["1,3"],alive:true,done:false,touched:false,steps:0,touchSpoke:-1}],
    dark:[{pos:id["3,0"],type:"S",bound:false,lastFrom:-1}]
  };
  const movement = symbolSnakeMovement(graph);
  const result = Engine.moveSnakeOne(state, 0, movement.adj, movement.distanceMatrix, deterministic, {
    mustTurn:movement.mustTurn,
    remainingSteps:movement.maxSteps
  });
  assert.equal(result.moved, true);
  if (!isThinEdge(result.from, result.to)) return;
  assert.equal(burnEdge(graph, result.from, result.to), true);
  const back = symbolSnakeMovement(graph);
  assert.equal(back.adj[result.to].includes(result.from), false);
});

test("kopiert vev brenner uavhengig av originalen", () => {
  const graph = burnGraph();
  const copy = cloneBurnGraph(graph);
  assert.equal(burnEdge(copy, id["2,0"], id["2,1"]), true);
  assert.equal(isBurnedEdge(copy, id["2,0"], id["2,1"]), true);
  assert.equal(isBurnedEdge(graph, id["2,0"], id["2,1"]), false);
  assert.equal(graph.out[id["2,0"]].includes(id["2,1"]) || graph.out[id["2,1"]].includes(id["2,0"]), true);
});

test("andre regelsett har ingen brennbare tråder", () => {
  for (const name of ["symbol","kutt","villvev"]){
    const graph = graphForMode(name, 99, true);
    assert.notEqual(graph.burn, true);
    assert.equal(burnEdge(graph, id["3,0"], id["3,1"]), false);
  }
});
