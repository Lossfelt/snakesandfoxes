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
    "\nglobalThis.__gameTest = {RULESETS,graphForMode,shiftArrowsAt,toggleArrowsAt,cloneMutableGraph,Engine,symbolSnakeMovement,nodes,id,CENTER,S,R};",
  context
);

const {RULESETS,graphForMode,shiftArrowsAt,toggleArrowsAt,cloneMutableGraph,Engine,symbolSnakeMovement,nodes,id,CENTER,S,R} = context.__gameTest;

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

/* ===== fiendens framsyn ===== */

const deterministic = {pick:items => items[0] ?? null};

function enemyState(snakeAt,playerAt,extra = []){
  return {
    players:[{pos:playerAt,alive:true,done:false,touched:false,touchSpoke:-1}],
    dark:[{pos:snakeAt,type:"S",bound:false,lastFrom:-1},...extra]
  };
}

test("slangesøket legger veven tilbake slik den var", () => {
  const graph = graphForMode("vevskifte","frø");
  const movement = symbolSnakeMovement(graph,true);
  const state = enemyState(id["5,3"],id["2,6"]);
  const before = plainEdges(graph);
  const beforeOut = graph.out.map(list => Array.from(list).sort((a,b) => a - b));
  Engine.chooseSnakeAdvance(state,0,state.dark[0].pos,[state.players[0].pos],
    movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps,movement.shiftGraph);
  assert.deepEqual(plainEdges(graph),before,"pilene er urørt etter søket");
  assert.deepEqual(graph.out.map(list => Array.from(list).sort((a,b) => a - b)),beforeOut,"nabolistene er urørt");
});

test("revesøket legger veven tilbake slik den var", () => {
  const graph = graphForMode("vevskifte","frø");
  const state = {
    players:[{pos:id["2,6"],alive:true,done:false,touched:false,touchSpoke:-1}],
    dark:[{pos:id["5,4"],type:"F",bound:false,lastFrom:-1}]
  };
  const before = plainEdges(graph);
  Engine.planFoxHop(state,0,graph,deterministic,{shifting:true});
  assert.deepEqual(plainEdges(graph),before);
});

test("framsynet endrer faktisk hvilket trekk fienden velger", () => {
  let differences = 0, total = 0;
  for (let trial = 0; trial < 6; trial++){
    const graph = graphForMode("vevskifte","frø" + trial);
    /* En vev som alt er vridd noen ganger, slik den er midt i et spill. */
    for (let step = 0; step < trial * 4; step++) shiftArrowsAt(graph,1 + ((step * 13 + trial) % (S * R)));
    const movement = symbolSnakeMovement(graph,true);
    for (const ring of [3,4,5]) for (let spoke = 0; spoke < S; spoke++){
      const state = enemyState(id[ring + "," + spoke],id["2," + ((spoke + 5) % S)]);
      const blind = Engine.chooseSnakeAdvance(state,0,state.dark[0].pos,[state.players[0].pos],
        movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps,null);
      const seeing = Engine.chooseSnakeAdvance(state,0,state.dark[0].pos,[state.players[0].pos],
        movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps,movement.shiftGraph);
      total++;
      if (blind !== seeing) differences++;
    }
  }
  assert.ok(differences > 0,"minst én stilling der framsynet gir et annet steg (av " + total + ")");
});

test("framsynet gir aldri et ulovlig steg", () => {
  const graph = graphForMode("vevskifte","frø");
  const movement = symbolSnakeMovement(graph,true);
  for (let spoke = 0; spoke < S; spoke++){
    const state = enemyState(id["4," + spoke],id["1,0"]);
    const from = state.dark[0].pos;
    const next = Engine.chooseSnakeAdvance(state,0,from,[state.players[0].pos],
      movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps,movement.shiftGraph);
    if (next < 0) continue;
    assert.ok(graph.out[from].includes(next),"steget følger en pil som faktisk finnes: " + nodes[from] + " -> " + nodes[next]);
  }
});

test("revens sprang følger to virkelige kanter", () => {
  const graph = graphForMode("vevskifte","frø");
  for (let spoke = 0; spoke < S; spoke++){
    const state = {
      players:[{pos:CENTER,alive:true,done:false,touched:true,touchSpoke:-1}],
      dark:[{pos:id["4," + spoke],type:"F",bound:false,lastFrom:-1}]
    };
    const plan = Engine.planFoxHop(state,0,graph,deterministic,{shifting:true});
    if (!plan) continue;
    assert.ok(graph.out[state.dark[0].pos].includes(plan.mid),"første felt finnes");
    assert.ok(graph.out[plan.mid].includes(plan.land),"andre felt finnes");
  }
});

test("uten skifte er søket bit for bit det gamle", () => {
  const graph = graphForMode("symbol","frø");
  const movement = symbolSnakeMovement(graph);
  assert.equal(movement.shiftGraph,null);
  for (let spoke = 0; spoke < S; spoke++){
    const state = enemyState(id["5," + spoke],id["2,2"]);
    const chosen = Engine.chooseSnakeAdvance(state,0,state.dark[0].pos,[state.players[0].pos],
      movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps);
    const explicitNull = Engine.chooseSnakeAdvance(state,0,state.dark[0].pos,[state.players[0].pos],
      movement.adj,movement.distanceMatrix,deterministic,movement.maxSteps,null);
    assert.equal(chosen,explicitNull);
  }
});

test("toggleArrowsAt rapporterer nøyaktig hvilke piler som snudde", () => {
  const graph = graphForMode("vevskifte","frø");
  const flipped = toggleArrowsAt(graph,id["3,3"]);
  assert.equal(flipped.length,2);
  for (const [from,to] of flipped){
    assert.ok(from === id["3,3"] || to === id["3,3"],"pilen berører noden");
    assert.ok(graph.out[to].includes(from),"den rapporterte pilen er snudd");
  }
  assert.equal(toggleArrowsAt(graph,CENTER).length,0);
});
