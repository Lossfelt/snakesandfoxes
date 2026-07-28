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
    "\nglobalThis.__gameTest = {Engine,graphForMode,symbolSnakeMovement,nodes,id,CENTER};",
  context
);

const {Engine,graphForMode,symbolSnakeMovement,nodes,id,CENTER} = context.__gameTest;
const deterministic = {pick:items => items[0] ?? null};

function runSnake(graph, corner, target){
  const movement = symbolSnakeMovement(graph);
  const state = {
    players:[{pos:target,alive:true,done:false}],
    dark:[{pos:id["K" + corner],type:"S",bound:false,lastFrom:-1}]
  };
  const path = [state.dark[0].pos];

  for (let step = 0; step < movement.maxSteps; step++){
    const result = Engine.moveSnakeOne(
      state,
      0,
      movement.adj,
      movement.distanceMatrix,
      deterministic,
      {mustTurn:movement.mustTurn,remainingSteps:movement.maxSteps - step}
    );
    if (!result.moved) break;
    path.push(result.to);
    if (!state.players[0].alive) break;
  }

  return {captured:!state.players[0].alive,path};
}

function assertValidSnakePath(graph, result){
  assert.ok(result.path.length - 1 <= 3, "Slangen gikk mer enn tre noder.");
  for (let index = 1; index < result.path.length; index++){
    assert.ok(
      graph.out[result.path[index - 1]].includes(result.path[index]),
      "Slangen gikk mot pilretningen."
    );
    if (index >= 2){
      assert.ok(
        Engine.isTurningStep(result.path[index - 2],result.path[index - 1],result.path[index]),
        "Slangen vekslet ikke mellom ring og eike."
      );
    }
  }
}

test("v2 til v5 bruker den samme slangepolicyen", () => {
  for (const mode of ["symbol","sektor","kutt","villvev"]){
    const graph = graphForMode(mode,123,true);
    const movement = symbolSnakeMovement(graph);
    assert.equal(movement.maxSteps,3);
    assert.equal(movement.mustTurn,true);
    assert.equal(movement.adj,graph.out);
    assert.equal(movement.distanceMatrix,graph.dist);
  }
});

test("slangene regner hjørnelenken som ring", () => {
  const graph = graphForMode("symbol",123,true);
  for (const corner of [0,2]){
    const start = id["K" + corner];
    for (const next of graph.out[start]){
      assert.equal(Engine.edgeKind(start,next),"ring");
    }
  }
});

test("v2 til v4 stopper ikke tidlig for noen mulig spillerposisjon", () => {
  for (const mode of ["symbol","sektor","kutt"]){
    const graph = graphForMode(mode,123,true);
    for (const corner of [0,2]){
      for (let target = 0; target < nodes.length; target++){
        if (nodes[target][0] === "K") continue;
        const result = runSnake(graph,corner,target);
        assertValidSnakePath(graph,result);
        if (!result.captured){
          assert.equal(
            result.path.length - 1,
            3,
            mode + " stoppet før tre steg mot " + nodes[target] + "."
          );
        }
        if (result.path.length === 4){
          assert.deepEqual(
            result.path.slice(1).map((node,index) => Engine.edgeKind(result.path[index],node)),
            ["ring","spoke","ring"]
          );
        }
      }
    }
  }
});

test("en fangst kan avslutte trekket før tre steg", () => {
  const graph = graphForMode("symbol",123,true);
  let result = null;
  for (let target = 0; target < nodes.length; target++){
    if (nodes[target][0] === "K") continue;
    const candidate = runSnake(graph,2,target);
    if (candidate.captured && candidate.path.length - 1 < 3){
      result = candidate;
      break;
    }
  }

  assert.ok(result,"Testen må finne en spillerbrikke som kan tas før tredje steg.");
  assertValidSnakePath(graph,result);
  assert.equal(result.captured,true);
  assert.ok(result.path.length - 1 < 3);
});

test("Villvev følger pilene og svinger for mange faste vever", () => {
  let oneStep = 0;
  let twoSteps = 0;
  let threeSteps = 0;

  for (let seed = 1; seed <= 200; seed++){
    const graph = graphForMode("villvev",seed,true);
    const result = runSnake(graph,0,CENTER);
    assertValidSnakePath(graph,result);
    const moves = result.path.length - 1;
    assert.ok(moves >= 1 && moves <= 3);
    if (moves === 1) oneStep++;
    if (moves === 2) twoSteps++;
    if (moves === 3) threeSteps++;
  }

  assert.ok(oneStep > 0,"Testutvalget må inneholde vever som stanser etter ett steg.");
  assert.ok(twoSteps > 0,"Testutvalget må inneholde vever som stanser etter to steg.");
  assert.ok(threeSteps > 0,"Testutvalget må inneholde vever med full trestegsrute.");
});

test("en fastlåst slange bruker ikke opp en aktivering når en annen kan bevege seg", () => {
  const graph = graphForMode("symbol",123,true);
  const movement = symbolSnakeMovement(graph);
  const state = {
    players:[{pos:id["2,0"],alive:true,done:false}],
    dark:[
      {pos:CENTER,type:"S",bound:false,lastFrom:id["1,0"]},
      {pos:id.K0,type:"S",bound:false,lastFrom:-1}
    ]
  };
  const canMove = index => Engine.canSnakeMove(
    state,index,movement.adj,movement.distanceMatrix,movement.maxSteps
  );

  assert.equal(canMove(0),false);
  assert.equal(canMove(1),true);
  const choice = Engine.choosePursuer(state,(piece,index) => piece.type === "S" && canMove(index),movement.distanceMatrix,deterministic);
  assert.equal(choice.index,1);
});

test("revene beholder korteste tofeltssprang fra hjørnet", () => {
  const graph = graphForMode("symbol",123,true);
  for (const corner of [1,3]){
    const start = id["K" + corner];
    const state = {
      players:[{pos:CENTER,alive:true,done:false}],
      dark:[{pos:start,type:"F",bound:false,lastFrom:-1}]
    };
    const plan = Engine.planFoxHop(state,0,graph,deterministic);

    assert.ok(plan);
    assert.ok(graph.out[start].includes(plan.mid));
    assert.ok(graph.out[plan.mid].includes(plan.land));
    assert.equal(nodes[plan.mid].startsWith("6,"),true);
    assert.equal(nodes[plan.land].startsWith("5,"),true);
    assert.equal(graph.dist[plan.land][CENTER],graph.dist[start][CENTER] - 2);
  }
});

test("reveplanen inne på brettet følger fortsatt to korteste kanter", () => {
  const graph = graphForMode("symbol",123,true);
  const start = id["5,4"];
  const state = {
    players:[{pos:CENTER,alive:true,done:false}],
    dark:[{pos:start,type:"F",bound:false,lastFrom:-1}]
  };
  const plan = Engine.planFoxHop(state,0,graph,deterministic);

  assert.ok(plan);
  assert.ok(graph.out[start].includes(plan.mid));
  assert.ok(graph.out[plan.mid].includes(plan.land));
  assert.equal(graph.dist[plan.land][CENTER],graph.dist[start][CENTER] - 2);
});
