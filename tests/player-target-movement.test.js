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
    "\nglobalThis.__gameTest = {Engine,graphForMode,nodes,id,CENTER,RULESETS};",
  context
);

const {Engine,graphForMode,nodes,id,CENTER,RULESETS} = context.__gameTest;

function player(overrides = {}){
  return {
    pos:CENTER,alive:true,touched:false,done:false,steps:3,touchSpoke:-1,
    ...overrides
  };
}

function stateFor(active,other = null,dark = []){
  return {players:other ? [active,other] : [active],dark};
}

function followRoute(state,index,path,rules,graph){
  const copy = {
    players:state.players.map(item => ({...item})),
    dark:state.dark.map(item => ({...item}))
  };
  for (const node of path){
    assert.ok(
      Engine.legalMoves(copy,index,rules,graph).includes(node),
      "Ruten inneholdt et ulovlig steg til " + nodes[node] + "."
    );
    Engine.advancePlayer(copy,index,node);
  }
  return copy;
}

test("målene bruker korteste lovlige ruter og tillater tidlig stopp", () => {
  const graph = graphForMode("symbol",123,true);
  const state = stateFor(player({steps:3}));
  const routes = Engine.reachablePlayerRoutes(state,0,RULESETS.symbol,graph);
  const lengths = new Set();

  assert.ok(routes.size > 0);
  for (const [target,path] of routes){
    assert.equal(path.at(-1),target);
    assert.ok(path.length >= 1 && path.length <= 3);
    lengths.add(path.length);
    const reached = followRoute(state,0,path,RULESETS.symbol,graph);
    assert.equal(reached.players[0].pos,target);
  }
  assert.deepEqual([...lengths].sort(),[1,2,3]);
});

test("ruter går ikke gjennom fiender, hjørner eller den andre spillerbrikken", () => {
  const graph = graphForMode("symbol",123,true);
  const blockedByDark = id["1,0"];
  const blockedByPlayer = id["1,1"];
  const state = stateFor(
    player({steps:4}),
    player({pos:blockedByPlayer,steps:0}),
    [{pos:blockedByDark,type:"S",bound:false}]
  );
  const routes = Engine.reachablePlayerRoutes(state,0,RULESETS.symbol,graph);

  assert.equal(routes.has(blockedByDark),false);
  assert.equal(routes.has(blockedByPlayer),false);
  for (const path of routes.values()){
    assert.equal(path.includes(blockedByDark),false);
    assert.equal(path.includes(blockedByPlayer),false);
    assert.equal(path.some(node => nodes[node][0] === "K"),false);
  }
});

test("en rute som berører ytterringen vender spillerbrikken hjemover", () => {
  const graph = graphForMode("symbol",123,true);
  const state = stateFor(player({pos:id["5,0"],steps:2}));
  const routes = Engine.reachablePlayerRoutes(state,0,RULESETS.symbol,graph);
  const target = id["6,1"];
  const route = routes.get(target);

  assert.ok(route);
  const reached = followRoute(state,0,route,RULESETS.symbol,graph);
  assert.equal(reached.players[0].touched,true);
  assert.equal(reached.players[0].touchSpoke,0);
  assert.equal(reached.players[0].pos,target);
});

test("sektorretur finner en lovlig hjemrute og avviser for nær inngangseike", () => {
  const graph = graphForMode("sektor",123,true);
  const state = stateFor(player({
    pos:id["6,0"],touched:true,touchSpoke:0,steps:12
  }));
  const routes = Engine.reachablePlayerRoutes(state,0,RULESETS.sektor,graph);
  const route = routes.get(CENTER);

  assert.ok(route,"Sektorvarianten må finne en hjemrute innen tolv steg.");
  const beforeCenter = route.at(-2);
  assert.ok(beforeCenter != null);
  const spoke = Number(nodes[beforeCenter].split(",")[1]);
  assert.ok(Math.min(spoke,12 - spoke) >= 4);
  const reached = followRoute(state,0,route,RULESETS.sektor,graph);
  assert.equal(reached.players[0].done,true);
});

test("alle mål i v2 til v5 følger variantens pilretning", () => {
  for (const mode of ["symbol","sektor","kutt","villvev"]){
    const graph = graphForMode(mode,9876,true);
    const state = stateFor(player({steps:6}));
    const routes = Engine.reachablePlayerRoutes(state,0,RULESETS[mode],graph);

    assert.ok(routes.size > 0,mode + " må ha minst ett mål.");
    for (const path of routes.values()){
      let from = CENTER;
      for (const node of path){
        assert.ok(graph.out[from].includes(node),mode + " gikk mot pilretningen.");
        from = node;
      }
      followRoute(state,0,path,RULESETS[mode],graph);
    }
  }
});
