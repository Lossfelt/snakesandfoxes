"use strict";

/* ================= rulesets ================= */
const RULESETS = {
  klassisk: {
    label: 'v1 Klassisk', topology: 'full', enemy: 'aggregate', returnRule: 'free',
    short: 'To vanlige terninger; hele flokken jakter samlet.',
    rules: 'Fienden kaster to vanlige terninger. Summen fordeles ett steg om gangen til den nærmeste bevegelige fiendebrikken, med høyst tre steg per brikke per runde.'
  },
  tidevann: {
    label: 'v1 Tidevann', topology: 'full', enemy: 'tide', returnRule: 'free',
    short: 'Slangene siger hver runde; revene får terningsummen.',
    rules: 'Alle ubundne slanger siger ett steg hver runde. Revene deler deretter summen av to terninger, med høyst fire steg per rev. Musikk halverer bare revenes del.'
  },
  symbol: {
    label: 'v2 Symbol', topology: 'full', enemy: 'symbols', returnRule: 'free',
    short: 'Seks symbolterninger og artsulik bevegelse.',
    rules: 'Fienden kaster seks symbolterninger. Hver slangeflate vekker én slange som åler to steg og kan følge ringene mot pilene. Hver revflate vekker én rev som gjør opptil to sprang på to felt. En rev tar bare brikken den lander på; springer den over en spillerbrikke, er brikken trygg og reven stanser etter landingen.'
  },
  sektor: {
    label: 'v3 Sektor', topology: 'full', enemy: 'symbols', returnRule: 'sector',
    short: 'Symbolreglene, men hjemveien må inn fra en fjern sektor.',
    rules: 'Som v2 Symbol. Når en brikke først berører ytterringen, lagres eiken den traff. Den kan bare gå inn i sentrum fra en eike minst fire sektorer unna. Inngangssektoren og gyldige hjem-eiker markeres på brettet.'
  },
  kutt: {
    label: 'v4 Kutt', topology: 'cut', enemy: 'symbols', returnRule: 'free',
    short: 'Symbolreglene på en vev med forskjøvne eikekutt.',
    rules: 'Som v2 Symbol, men annenhver eike er kuttet mellom ring 2 og 3, og de øvrige mellom ring 4 og 5. Ingen eike går ubrutt fra sentrum til kanten.'
  },
  villvev: {
    label: 'v5 Villvev', topology: 'wild', enemy: 'symbols', returnRule: 'free', soloRule: 'max',
    short: 'Alle indre ringsegmenter og eikesegmenter får ny, tilfeldig retning for hvert spill.',
    rules: 'Som v2 Symbol, men alle indre ringsegmenter og alle eikesegmenter er enveis. Hver enkelt pilretning trekkes på nytt for hvert spill. Ytterringen er fortsatt toveis, og hjørnelenkene slipper alltid fienden inn på brettet. Veven regenereres til det finnes minst én rettet rute som følger pilene fra sentrum til ytterringen, og minst én rettet rute som følger pilene fra ytterringen tilbake til sentrum; det trenger ikke være samme trasé. Gylne piler markerer eiker utover, grønne piler markerer eiker innover, blå piler viser ringer mot klokken, og grå piler viser ringer med klokken. Under spillerens flyttefase skifter pilene til navigasjonsfarger for den aktive brikken: grønn er korteste vei, gul er en mulig omvei, og rød er blindvei eller blokkert retning. Slangene følger de samme enveisretningene som spilleren og revene, men må svinge etter hvert skritt. Når bare én spillerbrikke er aktiv, bruker den den høyeste av de to terningene, ikke summen.'
  }
};

/* Patched after the reproducible simulation run. */
const BALANCE_STATS = {
  klassisk: {games:500,wins:68,rate:0.136,low:0.1087154434,high:0.1688350764,avgRounds:3.3,oneSurvivorWins:68},
  tidevann: {games:500,wins:43,rate:0.086,low:0.0644731424,high:0.1138398115,avgRounds:2.216,oneSurvivorWins:43},
  symbol: {games:500,wins:210,rate:0.42,low:0.3775093513,high:0.4637105432,avgRounds:4.918,oneSurvivorWins:174},
  sektor: {games:500,wins:48,rate:0.096,low:0.0731735047,high:0.1249869624,avgRounds:5.07,oneSurvivorWins:46},
  kutt: {games:500,wins:178,rate:0.356,low:0.3152745600,high:0.3989212500,avgRounds:5.484,oneSurvivorWins:153},
  villvev: {games:500,wins:26,rate:0.052,low:0.0357302651,high:0.0751011439,avgRounds:29.686,oneSurvivorWins:24}
};
const POWER_STATS = 'Bonusmåling for kreftene er ikke kjørt på nytt etter de siste endringene i slangebevegelse og v5-regler. Tallene i tabellen over er derimot oppdatert med en ny simulering (n=500 per modus).';

let mode = 'symbol';
const rulesFor = (name = mode) => RULESETS[name];

/* ================= seeded randomness ================= */
function hashText(value){
  const text = String(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
class SeededRng {
  constructor(seed){ this.state = (seed >>> 0) || 0x6d2b79f5; }
  next(){
    let t = this.state += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(max){ return max > 0 ? Math.floor(this.next() * max) : 0; }
  pick(items){ return items.length ? items[this.int(items.length)] : null; }
  d6(){ return 1 + this.int(6); }
  shuffled(items){
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--){
      const j = this.int(i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  fork(tag){ return new SeededRng(hashText(this.state + ':' + tag)); }
}
function randomSeed(){
  if (globalThis.crypto && crypto.getRandomValues){
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] >>> 0;
  }
  return hashText(Date.now() + ':' + performance.now());
}
const seedParam = new URLSearchParams(location.search).get('seed');
let seedSerial = 0;
function nextGameSeed(){
  if (seedParam !== null) return hashText(seedParam + ':' + seedSerial++);
  return randomSeed();
}

/* ================= graph ================= */
const S = 12, R = 6;
const nodes = [], id = {};
function addNode(key){ id[key] = nodes.length; nodes.push(key); }
addNode('C');
for (let r = 1; r <= R; r++) for (let s = 0; s < S; s++) addNode(r + ',' + s);
for (let k = 0; k < 4; k++) addNode('K' + k);
const N = nodes.length, CENTER = id.C;
const cornerLinks = [[1,2],[4,5],[7,8],[10,11]];
const ring6 = new Set(Array.from({length:S}, (_,s) => id[R + ',' + s]));
const isCorner = i => nodes[i][0] === 'K';
const spokeOfN = i => {
  const key = nodes[i];
  return (key === 'C' || key[0] === 'K') ? -1 : Number(key.split(',')[1]);
};
const circDist = (a,b) => {
  const d = Math.abs(a - b) % S;
  return Math.min(d, S - d);
};
const isCutEdge = (r,s,cut) => cut && ((s % 2 === 0 && r === 2) || (s % 2 === 1 && r === 4));

function bfs(src, adj, allowEdge){
  const dist = new Int16Array(N).fill(-1);
  dist[src] = 0;
  const queue = [src];
  for (let q = 0; q < queue.length; q++){
    const u = queue[q];
    for (const v of adj[u]){
      if (dist[v] !== -1) continue;
      if (allowEdge && !allowEdge(u, v)) continue;
      dist[v] = dist[u] + 1;
      queue.push(v);
    }
  }
  return dist;
}
function allPairs(adj){
  return Array.from({length:N}, (_,src) => bfs(src, adj));
}
function finalizeGraph(graph, includeSectorHome = false){
  graph.dist = allPairs(graph.out);
  graph.distSC = allPairs(graph.outSC);
  graph.outerDist = new Int16Array(N);
  for (let src = 0; src < N; src++){
    let best = 32767;
    for (const target of ring6){
      const distance = graph.dist[src][target];
      if (distance >= 0 && distance < best) best = distance;
    }
    graph.outerDist[src] = best === 32767 ? -1 : best;
  }
  graph.sectorHome = includeSectorHome ? Array.from({length:S}, (_,touchSpoke) => {
    const result = new Int16Array(N).fill(-1);
    for (let src = 0; src < N; src++){
      result[src] = bfs(src, graph.out, (u,v) => !(v === CENTER && circDist(spokeOfN(u), touchSpoke) < 4))[CENTER];
    }
    return result;
  }) : null;
  return graph;
}
function createGraph(cut){
  const out = nodes.map(() => []);
  const outSC = nodes.map(() => []);
  const dirEdges = [];
  const edge = (adj,a,b) => adj[id[a]].push(id[b]);
  const biedge = (adj,a,b) => { edge(adj,a,b); edge(adj,b,a); };

  for (let s = 0; s < S; s++) biedge(out, 'C', '1,' + s);
  for (let r = 1; r < R; r++) for (let s = 0; s < S; s++){
    if (!isCutEdge(r,s,cut)) biedge(out, r + ',' + s, (r + 1) + ',' + s);
  }
  for (let r = 1; r <= R; r++) for (let s = 0; s < S; s++){
    const a = r + ',' + s, clockwise = r + ',' + ((s + 1) % S);
    if (r === R) biedge(out, a, clockwise);
    else if (r % 2 === 1){ edge(out, a, clockwise); dirEdges.push([id[a], id[clockwise], 'ring']); }
    else { edge(out, clockwise, a); dirEdges.push([id[clockwise], id[a], 'ring']); }
  }
  for (let corner = 0; corner < 4; corner++) for (const spoke of cornerLinks[corner]) edge(out, 'K' + corner, R + ',' + spoke);

  for (let s = 0; s < S; s++) biedge(outSC, 'C', '1,' + s);
  for (let r = 1; r < R; r++) for (let s = 0; s < S; s++){
    if (!isCutEdge(r,s,cut)) biedge(outSC, r + ',' + s, (r + 1) + ',' + s);
  }
  for (let r = 1; r <= R; r++) for (let s = 0; s < S; s++){
    const a = r + ',' + s, clockwise = r + ',' + ((s + 1) % S);
    if (r === R) biedge(outSC, a, clockwise);
    else if (r % 2 === 1) edge(outSC, clockwise, a);
    else edge(outSC, a, clockwise);
  }
  for (let corner = 0; corner < 4; corner++) for (const spoke of cornerLinks[corner]) edge(outSC, 'K' + corner, R + ',' + spoke);

  return finalizeGraph({key:cut ? 'cut' : 'full', topology:cut ? 'cut' : 'full', cut, out, outSC, dirEdges, randomized:false}, !cut);
}
function reverseAdjacency(adj){
  const reversed = nodes.map(() => []);
  for (let from = 0; from < N; from++) for (const to of adj[from]) reversed[to].push(from);
  return reversed;
}
function wildCandidateIsPlayable(candidate){
  const fromCenter = bfs(CENTER,candidate.out);
  const toCenter = bfs(CENTER,reverseAdjacency(candidate.out));
  let outward = Infinity, homeward = Infinity;
  for (const outer of ring6){
    if (fromCenter[outer] >= 0) outward = Math.min(outward,fromCenter[outer]);
    if (toCenter[outer] >= 0) homeward = Math.min(homeward,toCenter[outer]);
  }
  const centerOut = candidate.out[CENTER].length;
  let centerIn = 0;
  for (let node = 0; node < N; node++) if (candidate.out[node].includes(CENTER)) centerIn++;
  return Number.isFinite(outward) && Number.isFinite(homeward) && centerOut >= 2 && centerIn >= 2 && outward <= 22 && homeward <= 22;
}
function createWildCandidate(seed,attempt){
  const random = new SeededRng(hashText(seed + ':villvev:' + attempt));
  const out = nodes.map(() => []);
  const outSC = nodes.map(() => []);
  const dirEdges = [];
  const edge = (adj,a,b) => adj[id[a]].push(id[b]);
  const biedge = (adj,a,b) => { edge(adj,a,b); edge(adj,b,a); };
  const oneWay = (a,b,kind) => {
    const forward = random.int(2) === 0;
    const from = forward ? a : b, to = forward ? b : a;
    edge(out,from,to);
    edge(outSC,to,from);
    dirEdges.push([id[from],id[to],kind]);
  };

  for (let spoke = 0; spoke < S; spoke++) oneWay('C','1,' + spoke,'spoke');
  for (let ring = 1; ring < R; ring++) for (let spoke = 0; spoke < S; spoke++){
    oneWay(ring + ',' + spoke,(ring + 1) + ',' + spoke,'spoke');
  }
  for (let ring = 1; ring <= R; ring++) for (let spoke = 0; spoke < S; spoke++){
    const a = ring + ',' + spoke, clockwise = ring + ',' + ((spoke + 1) % S);
    if (ring === R){ biedge(out,a,clockwise); biedge(outSC,a,clockwise); }
    else oneWay(a,clockwise,'ring');
  }
  // Hjørnelenkene er innslipp til selve veven, ikke randomiserte spillelinjer.
  for (let corner = 0; corner < 4; corner++) for (const spoke of cornerLinks[corner]){
    edge(out,'K' + corner,R + ',' + spoke);
    edge(outSC,'K' + corner,R + ',' + spoke);
  }
  return {key:'wild:' + seed + ':' + attempt,topology:'wild',seed,attempt,cut:false,out,outSC,dirEdges,randomized:true};
}
function createWildGraph(seed){
  for (let attempt = 0; attempt < 512; attempt++){
    const candidate = createWildCandidate(seed,attempt);
    if (wildCandidateIsPlayable(candidate)) return finalizeGraph(candidate,false);
  }
  throw new Error('Klarte ikke å lage en spillbar villvev for frø ' + seed + '.');
}
const GRAPHS = {full:createGraph(false), cut:createGraph(true)};
function graphForMode(modeName,seed){
  const rule = rulesFor(modeName);
  return rule.topology === 'wild' ? createWildGraph(seed) : GRAPHS[rule.topology];
}
let graph = GRAPHS.full;

/* ================= shared rules engine ================= */
const Engine = {
  activePlayerIndices(state){
    const result = [];
    state.players.forEach((p,index) => { if (p.alive && !p.done) result.push(index); });
    return result;
  },
  darkOccupied(state, exceptIndex = -1){
    const occupied = new Set();
    state.dark.forEach((d,index) => { if (index !== exceptIndex) occupied.add(d.pos); });
    return occupied;
  },
  playerBlocks(state, node, movingIndex){
    if (node === CENTER) return false;
    return state.players.some((p,index) => index !== movingIndex && p.alive && !p.done && p.pos === node);
  },
  sectorBanned(player, from, to, rules){
    return rules.returnRule === 'sector' && player.touched && to === CENTER &&
      circDist(spokeOfN(from), player.touchSpoke) < 4;
  },
  legalMoves(state, discIndex, rules, currentGraph){
    const player = state.players[discIndex];
    if (!player || !player.alive || player.done || player.steps <= 0) return [];
    const occupied = this.darkOccupied(state);
    return currentGraph.out[player.pos].filter(node =>
      !occupied.has(node) &&
      !isCorner(node) &&
      !this.playerBlocks(state, node, discIndex) &&
      !this.sectorBanned(player, player.pos, node, rules)
    );
  },
  nearestTargets(state, from, distanceMatrix){
    const targetNodes = [...new Set(this.activePlayerIndices(state).map(index => state.players[index].pos))];
    let minDistance = Infinity;
    let targets = [];
    for (const target of targetNodes){
      const distance = distanceMatrix[from][target];
      if (distance < 0) continue;
      if (distance < minDistance){ minDistance = distance; targets = [target]; }
      else if (distance === minDistance) targets.push(target);
    }
    return targets.length ? {distance:minDistance, targets} : null;
  },
  choosePursuer(state, predicate, distanceMatrix, random){
    let minDistance = Infinity;
    let tied = [];
    state.dark.forEach((piece,index) => {
      if (!predicate(piece,index)) return;
      const info = this.nearestTargets(state, piece.pos, distanceMatrix);
      if (!info) return;
      if (info.distance < minDistance){ minDistance = info.distance; tied = [{index,info}]; }
      else if (info.distance === minDistance) tied.push({index,info});
    });
    if (!tied.length) return null;
    const chosen = random.pick(tied);
    return {index:chosen.index, target:random.pick(chosen.info.targets), distance:chosen.info.distance};
  },
  turningAngle(prev, from, to){
    if (prev == null || prev < 0) return null;
    const ax = XY[from][0] - XY[prev][0], ay = XY[from][1] - XY[prev][1];
    const bx = XY[to][0] - XY[from][0], by = XY[to][1] - XY[from][1];
    const al = Math.hypot(ax,ay), bl = Math.hypot(bx,by);
    if (!al || !bl) return null;
    let cos = (ax * bx + ay * by) / (al * bl);
    cos = Math.max(-1,Math.min(1,cos));
    return Math.acos(cos) * 180 / Math.PI;
  },
  isTurningStep(prev, from, to){
    const angle = this.turningAngle(prev,from,to);
    return angle == null ? true : angle >= 25 && angle <= 155;
  },
  chooseAdvance(state, darkIndex, from, target, adj, distanceMatrix, random, options = {}){
    const currentDistance = distanceMatrix[from][target];
    if (currentDistance <= 0) return -1;
    let candidates = adj[from].filter(node => distanceMatrix[node][target] === currentDistance - 1);
    if (!candidates.length) return -1;
    if (options.turnFrom != null && options.turnFrom >= 0){
      candidates = candidates.filter(node => this.isTurningStep(options.turnFrom, from, node));
      if (!candidates.length) return -1;
    }
    const occupied = this.darkOccupied(state, darkIndex);
    const free = candidates.filter(node => !occupied.has(node));
    return random.pick(free.length ? free : candidates);
  },
  moveSnakeOne(state, darkIndex, adj, distanceMatrix, random){
    const piece = state.dark[darkIndex];
    const info = this.nearestTargets(state, piece.pos, distanceMatrix);
    if (!info) return {moved:false, captured:[]};
    const target = random.pick(info.targets);
    const next = this.chooseAdvance(state, darkIndex, piece.pos, target, adj, distanceMatrix, random, {turnFrom:piece.lastFrom});
    if (next < 0) return {moved:false, captured:[]};
    const from = piece.pos;
    piece.pos = next;
    piece.lastFrom = from;
    return {moved:true, from, to:next, captured:this.captureAt(state, next)};
  },
  captureAt(state, node){
    const captured = [];
    state.players.forEach((player,index) => {
      if (player.alive && !player.done && player.pos === node){
        player.alive = false;
        captured.push(index);
      }
    });
    return captured;
  },
  moveDarkOne(state, darkIndex, target, adj, distanceMatrix, random){
    const piece = state.dark[darkIndex];
    const next = this.chooseAdvance(state, darkIndex, piece.pos, target, adj, distanceMatrix, random);
    if (next < 0) return {moved:false, captured:[]};
    piece.pos = next;
    return {moved:true, from:null, to:next, captured:this.captureAt(state, next)};
  },
  planFoxHop(state, darkIndex, currentGraph, random){
    const piece = state.dark[darkIndex];
    const info = this.nearestTargets(state, piece.pos, currentGraph.dist);
    if (!info) return null;
    const target = random.pick(info.targets);
    if (info.distance === 1){
      const mid = target;
      const occupied = this.darkOccupied(state, darkIndex);
      const landingCandidates = currentGraph.out[mid].filter(node => node !== piece.pos);
      if (!landingCandidates.length) return null;
      const free = landingCandidates.filter(node => !occupied.has(node));
      const land = random.pick(free.length ? free : landingCandidates);
      const overPlayers = this.activePlayerIndices(state).filter(index => state.players[index].pos === mid);
      return {mid, land, leapt:true, overPlayers};
    }
    const mid = this.chooseAdvance(state, darkIndex, piece.pos, target, currentGraph.out, currentGraph.dist, random);
    if (mid < 0) return null;
    const land = this.chooseAdvance(state, darkIndex, mid, target, currentGraph.out, currentGraph.dist, random);
    if (land < 0) return null;
    return {mid, land, leapt:false, overPlayers:[]};
  }
};

/* ================= geometry ================= */
const CX = 360, CY = 372;
function jit(key, salt){ return ((hashText(key + salt) % 1000) / 1000 - .5) * 6; }
function nodeXY(index){
  const key = nodes[index];
  if (key === 'C') return [CX, CY];
  if (key[0] === 'K'){
    const corner = Number(key[1]);
    const angle = (-45 + corner * 90) * Math.PI / 180;
    return [CX + 372 * Math.cos(angle), CY + 372 * Math.sin(angle)];
  }
  const [ring,spoke] = key.split(',').map(Number);
  const radius = 330 - 46 * (R - ring);
  const angle = (spoke * 30 - 90) * Math.PI / 180;
  return [CX + radius * Math.cos(angle) + jit(key,'x'), CY + radius * Math.sin(angle) + jit(key,'y')];
}
const XY = nodes.map((_,index) => nodeXY(index));

/* ================= board SVG ================= */
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attributes, parent){
  const element = document.createElementNS(NS, tag);
  for (const key in attributes) element.setAttribute(key, attributes[key]);
  if (parent) parent.appendChild(element);
  return element;
}
const svg = el('svg',{viewBox:'0 0 720 764', role:'group', 'aria-label':'Spillebrett for Slanger og rever'});
document.getElementById('boardwrap').appendChild(svg);
const defs = el('defs',{},svg);
defs.innerHTML = `
  <linearGradient id="frameWood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7b4a24"/><stop offset=".18" stop-color="#3c2112"/>
    <stop offset=".48" stop-color="#1c0e08"/><stop offset=".77" stop-color="#5d351a"/><stop offset="1" stop-color="#2b160d"/>
  </linearGradient>
  <linearGradient id="frameBevel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a86a31"/><stop offset=".16" stop-color="#593016"/><stop offset=".84" stop-color="#1a0d07"/><stop offset="1" stop-color="#70401e"/>
  </linearGradient>
  <linearGradient id="brassGradient" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f0c879"/><stop offset=".25" stop-color="#be7931"/><stop offset=".55" stop-color="#714017"/><stop offset=".82" stop-color="#d89a49"/><stop offset="1" stop-color="#8b531f"/>
  </linearGradient>
  <radialGradient id="clothGradient" cx="45%" cy="36%" r="80%">
    <stop offset="0" stop-color="#bd4933"/><stop offset=".43" stop-color="#a33224"/><stop offset=".8" stop-color="#7b2118"/><stop offset="1" stop-color="#57130e"/>
  </radialGradient>
  <radialGradient id="boneGradient" cx="31%" cy="22%" r="86%">
    <stop offset="0" stop-color="#fff2c9"/><stop offset=".42" stop-color="#e8d39f"/><stop offset=".78" stop-color="#c29e62"/><stop offset="1" stop-color="#8d6536"/>
  </radialGradient>
  <radialGradient id="ironGradient" cx="32%" cy="24%" r="85%">
    <stop offset="0" stop-color="#514a43"/><stop offset=".38" stop-color="#292522"/><stop offset=".78" stop-color="#100e0d"/><stop offset="1" stop-color="#050404"/>
  </radialGradient>
  <radialGradient id="studGradient" cx="34%" cy="25%" r="78%">
    <stop offset="0" stop-color="#e1a655"/><stop offset=".34" stop-color="#8d531f"/><stop offset=".75" stop-color="#31180c"/><stop offset="1" stop-color="#110806"/>
  </radialGradient>
  <linearGradient id="ironBand" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d7d6cb"/><stop offset=".32" stop-color="#696d6c"/><stop offset=".7" stop-color="#242729"/><stop offset="1" stop-color="#8b918e"/>
  </linearGradient>
  <pattern id="woodGrain" width="120" height="36" patternUnits="userSpaceOnUse">
    <path d="M-12 8 C18 -2 38 16 70 7 S118 10 142 0 M-20 24 C12 13 38 31 72 22 S118 28 145 15" fill="none" stroke="#d8964e" stroke-opacity=".13" stroke-width="2"/>
    <path d="M8 14 C25 7 38 19 55 13 S85 11 109 17" fill="none" stroke="#120805" stroke-opacity=".23" stroke-width="1.2"/>
  </pattern>
  <pattern id="clothWeave" width="8" height="8" patternUnits="userSpaceOnUse">
    <path d="M0 1H8M0 5H8" stroke="#ffd6ad" stroke-opacity=".055" stroke-width="1"/>
    <path d="M1 0V8M5 0V8" stroke="#2c0605" stroke-opacity=".09" stroke-width="1"/>
  </pattern>
  <filter id="boardShadow" x="-12%" y="-12%" width="124%" height="128%">
    <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity=".58"/>
  </filter>
  <filter id="clothNoise" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".018 .13" numOctaves="2" seed="17" result="noise"/>
    <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .12 .12 .12 0 0" result="alpha"/>
    <feBlend in="SourceGraphic" in2="alpha" mode="multiply"/>
  </filter>
  <filter id="pieceShadow" x="-70%" y="-70%" width="240%" height="250%">
    <feDropShadow dx="0" dy="3" stdDeviation="2.2" flood-color="#000" flood-opacity=".65"/>
  </filter>
  <filter id="softGlow" x="-120%" y="-120%" width="340%" height="340%">
    <feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="webShadow" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur stdDeviation=".65"/>
  </filter>
`;
const frameG = el('g',{filter:'url(#boardShadow)','aria-hidden':'true'},svg);
el('rect',{x:4,y:4,width:712,height:756,rx:20,fill:'url(#frameWood)',stroke:'#090402','stroke-width':4},frameG);
el('rect',{x:7,y:7,width:706,height:750,rx:18,fill:'url(#woodGrain)',opacity:.72},frameG);
el('rect',{x:14,y:14,width:692,height:736,rx:14,fill:'none',stroke:'url(#brassGradient)','stroke-width':2.2,opacity:.72},frameG);
el('rect',{x:20,y:20,width:680,height:724,rx:11,fill:'url(#frameBevel)',stroke:'#100704','stroke-width':3},frameG);
const clothG = el('g',{filter:'url(#clothNoise)','aria-hidden':'true'},svg);
el('rect',{x:28,y:28,width:664,height:708,rx:8,fill:'url(#clothGradient)',stroke:'#3d0d09','stroke-width':3},clothG);
el('rect',{x:28,y:28,width:664,height:708,rx:8,fill:'url(#clothWeave)',opacity:.78},clothG);
el('rect',{x:36,y:36,width:648,height:692,rx:5,fill:'none',stroke:'#2b0c08','stroke-width':1.4,'stroke-dasharray':'8 7',opacity:.72},svg);
el('rect',{x:41,y:41,width:638,height:682,rx:3,fill:'none',stroke:'rgba(255,210,143,.15)','stroke-width':1},svg);
function addCornerMount(x,y,rotation){
  const group = el('g',{transform:'translate(' + x + ' ' + y + ') rotate(' + rotation + ')','aria-hidden':'true'},svg);
  el('path',{d:'M0 46 V12 Q0 0 12 0 H46 L34 12 H15 Q12 12 12 15 V34 Z',fill:'url(#brassGradient)',stroke:'#3c210d','stroke-width':1.5,opacity:.92},group);
  el('circle',{cx:10,cy:10,r:3.1,fill:'url(#studGradient)',stroke:'#2c1609','stroke-width':1},group);
}
addCornerMount(28,28,0); addCornerMount(692,28,90); addCornerMount(692,736,180); addCornerMount(28,736,270);
const watermarkG = el('g',{fill:'none',stroke:'#f6c987','stroke-width':15,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.035,'aria-hidden':'true'},svg);
el('path',{d:'M360 193 L503 490 L217 490 Z'},watermarkG);
el('path',{d:'M170 382 Q220 323 270 382 T370 382 T470 382 T570 382'},watermarkG);
const webShadowG = el('g',{stroke:'rgba(28,7,4,.62)','stroke-linecap':'round',fill:'none',filter:'url(#webShadow)','aria-hidden':'true'},svg);
const haloG = el('g',{stroke:'rgba(255,208,137,.18)','stroke-linecap':'round',fill:'none','aria-hidden':'true'},svg);
const webG = el('g',{stroke:'#170d08','stroke-width':3.1,'stroke-linecap':'round',fill:'none','aria-hidden':'true'},svg);
const chevShadowG = el('g',{fill:'none',stroke:'rgba(35,8,4,.72)','stroke-linecap':'round','stroke-linejoin':'round',filter:'url(#webShadow)','aria-hidden':'true'},svg);
const chevG = el('g',{fill:'none',stroke:'#170d08','stroke-width':3.15,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'},svg);
const arrowVisuals = [];
function line(a,b,width){
  const w = width || 3.1;
  el('line',{x1:XY[a][0],y1:XY[a][1],x2:XY[b][0],y2:XY[b][1],'stroke-width':w+5},webShadowG);
  el('line',{x1:XY[a][0],y1:XY[a][1],x2:XY[b][0],y2:XY[b][1],'stroke-width':w+2.1},haloG);
  el('line',{x1:XY[a][0],y1:XY[a][1],x2:XY[b][0],y2:XY[b][1],'stroke-width':w},webG);
}
function drawWeb(currentGraph){
  webShadowG.innerHTML = ''; haloG.innerHTML = ''; webG.innerHTML = ''; chevShadowG.innerHTML = ''; chevG.innerHTML = '';
  arrowVisuals.length = 0;
  for (let s = 0; s < S; s++) line(CENTER, id['1,' + s]);
  for (let r = 1; r < R; r++) for (let s = 0; s < S; s++){
    if (!isCutEdge(r,s,currentGraph.cut)) line(id[r + ',' + s], id[(r + 1) + ',' + s]);
  }
  for (let r = 1; r <= R; r++) for (let s = 0; s < S; s++){
    line(id[r + ',' + s], id[r + ',' + ((s + 1) % S)], r === R ? 4 : 3.1);
  }
  for (let k = 0; k < 4; k++) for (const s of cornerLinks[k]) line(id['K' + k], id[R + ',' + s], 2.55);
  for (const [a,b,kind] of currentGraph.dirEdges){
    const mx = (XY[a][0] + XY[b][0]) / 2, my = (XY[a][1] + XY[b][1]) / 2;
    const angle = Math.atan2(XY[b][1] - XY[a][1], XY[b][0] - XY[a][0]) * 180 / Math.PI;
    const scale = kind === 'spoke' ? .76 : .9;
    const transform = 'translate(' + mx + ' ' + my + ') rotate(' + angle + ') scale(' + scale + ')';
    let main = '#8ec7da', glow = 'rgba(160,215,235,.24)';
    const keyA = nodes[a], keyB = nodes[b];
    if (kind === 'spoke'){
      const radiusOf = key => key === 'C' ? 0 : (key[0] === 'K' ? R + 1 : Number(key.split(',')[0]));
      const outward = radiusOf(keyB) > radiusOf(keyA);
      main = outward ? '#f0d38e' : '#6fbe70';
      glow = outward ? 'rgba(255,224,158,.24)' : 'rgba(144,227,150,.22)';
    } else {
      const spokeA = Number(keyA.split(',')[1]), spokeB = Number(keyB.split(',')[1]);
      const clockwise = ((spokeB - spokeA + S) % S) === 1;
      main = clockwise ? '#9a9a9a' : '#66acd9';
      glow = clockwise ? 'rgba(190,190,190,.22)' : 'rgba(125,197,238,.24)';
    }
    el('path',{d:'M-6 -5.8 L5.8 0 L-6 5.8','stroke-width':8.4,stroke:'rgba(35,8,4,.72)',transform},chevShadowG);
    const glowPath = el('path',{d:'M-6 -5.8 L5.8 0 L-6 5.8','stroke-width':5.8,stroke:glow,transform,class:'route-arrow-glow'},haloG);
    const arrowPath = el('path',{d:'M-6 -5.8 L5.8 0 L-6 5.8',stroke:main,transform,class:'route-arrow','data-from':a,'data-to':b,'data-route-state':'base'},chevG);
    arrowVisuals.push({from:a,to:b,kind,path:arrowPath,glowPath,baseMain:main,baseGlow:glow});
  }
}
drawWeb(graph);
const dotG = el('g',{'aria-hidden':'true'},svg);
for (let i = 0; i < N; i++){
  if (isCorner(i)){
    el('rect',{x:XY[i][0]-11,y:XY[i][1]-11,width:22,height:22,rx:3,transform:'rotate(45 ' + XY[i][0] + ' ' + XY[i][1] + ')',fill:'rgba(31,13,7,.72)',stroke:'url(#brassGradient)','stroke-width':2.2},dotG);
    el('circle',{cx:XY[i][0],cy:XY[i][1],r:3.2,fill:'url(#studGradient)',stroke:'#180b06','stroke-width':1},dotG);
  } else if (i === CENTER){
    const hub = el('g',{transform:'translate(' + CX + ' ' + CY + ')'},dotG);
    el('circle',{r:32,fill:'rgba(30,9,5,.52)',stroke:'rgba(255,212,144,.13)','stroke-width':2},hub);
    el('circle',{r:27,fill:'url(#brassGradient)',stroke:'#3d200d','stroke-width':2},hub);
    el('circle',{r:22,fill:'url(#ironGradient)',stroke:'#0a0503','stroke-width':2},hub);
    el('circle',{r:16,fill:'none',stroke:'rgba(240,200,126,.42)','stroke-width':1.3,'stroke-dasharray':'2 4'},hub);
    for (let a = 0; a < 4; a++) el('line',{x1:0,y1:-25,x2:0,y2:-29,stroke:'#f1c87b','stroke-width':2,transform:'rotate(' + (a*90) + ')'},hub);
  } else {
    el('circle',{cx:XY[i][0],cy:XY[i][1],r:5.1,fill:'url(#studGradient)',stroke:'#150a06','stroke-width':1.25},dotG);
    el('circle',{cx:XY[i][0]-1.4,cy:XY[i][1]-1.5,r:1.1,fill:'rgba(255,225,165,.48)'},dotG);
  }
}
const homePlaque = el('g',{'aria-hidden':'true'},svg);
el('path',{d:'M326 326 Q360 316 394 326 L389 343 Q360 336 331 343 Z',fill:'rgba(43,15,9,.52)',stroke:'rgba(224,168,91,.22)','stroke-width':1},homePlaque);
el('text',{x:CX,y:CY-37,'text-anchor':'middle','font-size':12,'font-style':'italic',fill:'#e5bd79',opacity:.86,'font-family':'Georgia,serif','letter-spacing':1.2},homePlaque).textContent='hjem';
const sectorG = el('g',{'aria-hidden':'true'},svg);
const legalG = el('g',{'aria-hidden':'true'},svg);
const hopFxG = el('g',{'aria-hidden':'true'},svg);
const pieceG = el('g',{},svg);
const tapG = el('g',{},svg);
const tapNodes = [];
let rovingNode = CENTER;
function setRovingNode(index, focus = false){
  if (index < 0 || index >= N) return;
  rovingNode = index;
  updateNodeAccessibility();
  if (focus) tapNodes[index].focus();
}
function directionalNode(from, key){
  const direction = key === 'ArrowLeft' ? [-1,0] : key === 'ArrowRight' ? [1,0] : key === 'ArrowUp' ? [0,-1] : [0,1];
  const [x,y] = XY[from];
  let best = from, bestScore = Infinity;
  for (let i = 0; i < N; i++){
    if (i === from) continue;
    const vx = XY[i][0] - x, vy = XY[i][1] - y;
    const forward = vx * direction[0] + vy * direction[1];
    if (forward <= 1) continue;
    const perpendicular = Math.abs(vx * direction[1] - vy * direction[0]);
    const distance = Math.hypot(vx,vy);
    const score = (perpendicular / forward) * 1000 + distance;
    if (score < bestScore){ bestScore = score; best = i; }
  }
  return best;
}
for (let i = 0; i < N; i++){
  const circle = el('circle',{cx:XY[i][0],cy:XY[i][1],r:24,class:'tapnode','data-i':i,tabindex:i===CENTER?'0':'-1',role:'button',focusable:'true'},tapG);
  circle.addEventListener('pointerdown', event => { event.preventDefault(); tapNode(i); });
  circle.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' '){ event.preventDefault(); tapNode(i); return; }
    if (event.key === 'Home'){ event.preventDefault(); setRovingNode(CENTER,true); return; }
    if (event.key.startsWith('Arrow')){ event.preventDefault(); setRovingNode(directionalNode(i,event.key),true); }
  });
  circle.addEventListener('focus', () => { rovingNode = i; updateNodeAccessibility(); });
  tapNodes.push(circle);
}

/* ================= pieces ================= */
function mkDarkEl(type, index){
  const group = el('g',{class:'piece dark-piece ' + (type === 'S' ? 'snake-piece' : 'fox-piece'),tabindex:'-1',role:'button','aria-disabled':'true','data-dark-index':index,filter:'url(#pieceShadow)'});
  const face = el('g',{class:'token-face'},group);
  el('circle',{cx:0,cy:2.5,r:17,fill:'rgba(0,0,0,.34)'},face);
  el('circle',{r:15.7,fill:'url(#boneGradient)',stroke:'#6f4926','stroke-width':2.3},face);
  el('circle',{r:12.5,fill:'none',stroke:'rgba(255,246,216,.34)','stroke-width':1},face);
  el('path',{d:'M-9 -10 Q-2 -14 7 -10',fill:'none',stroke:'rgba(96,55,24,.22)','stroke-width':1.1,'stroke-linecap':'round'},face);
  const symbolPath = type === 'S' ? 'M-10 1 Q -6 -7, -1 0 T 9 0' : 'M0 -9 L9 7 L-9 7 Z';
  el('path',{d:symbolPath,fill:'none',stroke:'rgba(255,246,216,.46)','stroke-width':3.8,'stroke-linecap':'round','stroke-linejoin':'round',transform:'translate(0 -1)'},face);
  el('path',{d:symbolPath,fill:'none',stroke:'#2b170c','stroke-width':2.5,'stroke-linecap':'round','stroke-linejoin':'round'},face);
  const bind = el('g',{class:'binding-mark'},group);
  el('circle',{r:18.2,fill:'none',stroke:'url(#ironBand)','stroke-width':3.5,'stroke-dasharray':'7 3'},bind);
  el('path',{d:'M-12 -11 L12 11 M12 -11 L-12 11',stroke:'url(#ironBand)','stroke-width':3.1,'stroke-linecap':'round'},bind);
  el('circle',{r:3.2,fill:'#313537',stroke:'#aeb3ad','stroke-width':1},bind);
  group.addEventListener('pointerdown', event => {
    if (!bindMode) return;
    event.preventDefault(); event.stopPropagation(); bindDark(index);
  });
  group.addEventListener('keydown', event => {
    if (!bindMode || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault(); bindDark(index);
  });
  pieceG.appendChild(group);
  return group;
}
function mkPlayerEl(number){
  const group = el('g',{class:'piece player-piece','aria-hidden':'true',filter:'url(#pieceShadow)'});
  el('circle',{r:22,class:'selection-ring'},group);
  const face = el('g',{class:'token-face'},group);
  el('circle',{cx:0,cy:3,r:18,fill:'rgba(0,0,0,.38)'},face);
  el('circle',{r:16.5,fill:'url(#brassGradient)',stroke:'#3c1f0c','stroke-width':2},face);
  el('circle',{r:13.1,fill:'url(#ironGradient)',stroke:'#090504','stroke-width':1.7},face);
  el('circle',{r:10.6,fill:'none',stroke:'rgba(240,201,129,.3)','stroke-width':1,'stroke-dasharray':'1.5 3'},face);
  el('text',{y:5,'text-anchor':'middle','font-size':12.5,fill:'#f0d394','font-family':'Georgia,serif','font-style':'italic','font-weight':'700','paint-order':'stroke',stroke:'#0a0503','stroke-width':1.5},face).textContent = number === 0 ? 'I' : 'II';
  pieceG.appendChild(group);
  return group;
}

/* ================= live state ================= */
let dark = [], players = [], phase = 'ritual', turnNo = 0, activeDisc = -1;
let pDice = [0,0], eDice = [0,0], cheats = {}, dazzle = 0, blindNext = false;
let motArmed = false, bindMode = false, bindReturnStatus = '', breaches = 0, anyStep = false;
let gameVersion = 0, undoStack = [], gameSeed = 0, rng = new SeededRng(1);
let renderedGraphKey = graph.key;
const liveState = () => ({players,dark});
function livingDiscs(){ return players.filter(player => player.alive && !player.done); }
function applyModeGraph(){
  const rule = rulesFor();
  const next = rule.topology === 'wild' && graph.topology === 'wild' && graph.seed === gameSeed
    ? graph
    : graphForMode(mode,gameSeed);
  graph = next;
  if (renderedGraphKey !== next.key){ drawWeb(next); renderedGraphKey = next.key; }
}
function reset(){
  gameVersion++;
  gameSeed = nextGameSeed();
  rng = new SeededRng(gameSeed);
  applyModeGraph();
  undoStack = [];
  pieceG.innerHTML = ''; legalG.innerHTML = ''; sectorG.innerHTML = ''; hopFxG.innerHTML = '';
  dark = [];
  for (let corner = 0; corner < 4; corner++) for (let i = 0; i < 5; i++){
    const type = corner % 2 === 0 ? 'S' : 'F';
    const index = dark.length;
    dark.push({pos:id['K' + corner], type, bound:false, lastFrom:-1, el:mkDarkEl(type,index)});
  }
  players = [0,1].map(number => ({pos:CENTER,alive:true,touched:false,done:false,steps:0,touchSpoke:-1,el:mkPlayerEl(number)}));
  phase = 'ritual'; turnNo = 0; activeDisc = -1; pDice = [0,0]; eDice = [0,0];
  cheats = {mot:false,ild:false,mus:false,jern:false};
  dazzle = 0; blindNext = false; motArmed = false; bindMode = false; bindReturnStatus = '';
  breaches = 0; anyStep = false;
  document.getElementById('log').innerHTML = '';
  rovingNode = CENTER;
  renderAll(); updateHud(); renderRulesPanel();
  log('Brettet rulles ut. Tjue brikker venter i hjørnene.');
}
function stackOffset(index, position){
  const peers = [];
  dark.forEach((piece,pieceIndex) => { if (piece.pos === position) peers.push(pieceIndex); });
  const stackIndex = peers.indexOf(index);
  if (bindMode && peers.length > 1){
    const radius = 34;
    const angle = -Math.PI / 2 + stackIndex * (Math.PI * 2 / peers.length);
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }
  const angle = stackIndex * 2.4;
  return [Math.cos(angle) * stackIndex * 4.5, Math.sin(angle) * stackIndex * 4.5];
}
function renderSectorGuides(){
  sectorG.innerHTML = '';
  if (rulesFor().returnRule !== 'sector') return;
  players.forEach((player,index) => {
    if (!player.alive || player.done || !player.touched || player.touchSpoke < 0) return;
    const touchNode = id[R + ',' + player.touchSpoke];
    el('circle',{cx:XY[touchNode][0],cy:XY[touchNode][1],r:15,class:'sector-touch','stroke-dasharray':index===0?'none':'5 4'},sectorG);
    el('text',{x:XY[touchNode][0],y:XY[touchNode][1]-21,'text-anchor':'middle',class:'sector-label'},sectorG).textContent = index === 0 ? 'I' : 'II';
    if (index !== activeDisc || phase !== 'move') return;
    for (let spoke = 0; spoke < S; spoke++){
      if (circDist(spoke, player.touchSpoke) < 4) continue;
      const target = id['1,' + spoke];
      const dx = XY[target][0] - CX, dy = XY[target][1] - CY;
      const length = Math.hypot(dx,dy);
      const sx = CX + dx / length * 31, sy = CY + dy / length * 31;
      el('line',{x1:sx,y1:sy,x2:XY[target][0],y2:XY[target][1],class:'sector-home','stroke-dasharray':index===0?'none':'7 5'},sectorG);
    }
  });
}
function renderBindTargets(){
  tapG.style.pointerEvents = bindMode ? 'none' : 'all';
  dark.forEach((piece,index) => {
    const targetable = bindMode && !piece.bound;
    piece.el.classList.toggle('bind-target', targetable);
    piece.el.setAttribute('tabindex', targetable ? '0' : '-1');
    piece.el.setAttribute('aria-disabled', targetable ? 'false' : 'true');
    const typeName = piece.type === 'S' ? 'slange' : 'rev';
    piece.el.setAttribute('aria-label', targetable ? 'Bind ' + typeName + ' med jern' : (piece.bound ? 'Bundet ' + typeName : typeName));
  });
}
function clearFoxHopFx(){ hopFxG.innerHTML = ''; }
function renderFoxHopFx(plan,stage){
  hopFxG.innerHTML = '';
  if (!plan) return;
  const over = el('g',{transform:'translate(' + XY[plan.mid][0] + ' ' + XY[plan.mid][1] + ')'},hopFxG);
  const overOpacity = stage === 'land' ? .62 : 1;
  el('circle',{r:18,class:'fox-over-marker',opacity:overOpacity},over);
  el('path',{d:'M-8 6 Q-1 -8 7 -2',class:'fox-over-core',opacity:overOpacity},over);
  if (plan.overPlayers.length) el('path',{d:'M-7 -7 L7 7 M7 -7 L-7 7',class:'fox-over-core',opacity:overOpacity},over);
  const land = el('g',{transform:'translate(' + XY[plan.land][0] + ' ' + XY[plan.land][1] + ')'},hopFxG);
  if (stage === 'mid'){
    el('circle',{r:15,class:'fox-land-outer',opacity:.55},land);
    el('circle',{r:4,class:'fox-land-core',opacity:.6},land);
  } else {
    el('circle',{r:18,class:'fox-land-marker'},land);
    el('circle',{r:11,class:'fox-land-outer'},land);
    el('circle',{r:4.2,class:'fox-land-core'},land);
  }
}
function setArrowAppearance(visual,state){
  const palette = {
    shortest:{main:'#79e59a',glow:'rgba(112,255,156,.54)',opacity:1,width:4.25},
    detour:{main:'#ffd166',glow:'rgba(255,213,102,.42)',opacity:.96,width:3.8},
    dead:{main:'#ff7868',glow:'rgba(255,112,96,.42)',opacity:.92,width:3.55},
    inactive:{main:'#f4f2eb',glow:'rgba(255,248,236,.22)',opacity:.34,width:2.75},
    base:{main:'#f4f2eb',glow:'rgba(255,248,236,.24)',opacity:1,width:3.15}
  };
  const style = palette[state] || palette.base;
  visual.path.style.stroke = style.main;
  visual.path.style.opacity = style.opacity;
  visual.path.style.strokeWidth = style.width;
  visual.glowPath.style.stroke = style.glow;
  visual.glowPath.style.opacity = state === 'inactive' ? .07 : style.opacity;
  visual.glowPath.style.strokeWidth = state === 'shortest' ? 7.2 : state === 'detour' ? 6.5 : 5.8;
  visual.path.dataset.routeState = state;
}
function resetArrowGuidance(){
  arrowVisuals.forEach(visual => setArrowAppearance(visual,'base'));
  const legend = document.getElementById('routeLegend');
  if (legend) legend.hidden = true;
}
function playerNavigationAdjacency(playerIndex){
  const player = players[playerIndex];
  if (!player) return nodes.map(() => []);
  const state = liveState();
  const occupied = Engine.darkOccupied(state);
  return graph.out.map((nextNodes,from) => nextNodes.filter(to =>
    !occupied.has(to) &&
    !isCorner(to) &&
    !Engine.playerBlocks(state,to,playerIndex) &&
    !Engine.sectorBanned(player,from,to,rulesFor())
  ));
}
function distancesFromStart(start,adjacency,terminalTargets){
  const distance = new Int16Array(N).fill(-1);
  if (start < 0 || start >= N) return distance;
  const terminals = new Set(terminalTargets || []);
  distance[start] = 0;
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++){
    const from = queue[cursor];
    if (terminals.has(from) && from !== start) continue;
    for (const to of adjacency[from]) if (distance[to] === -1){
      distance[to] = distance[from] + 1;
      queue.push(to);
    }
  }
  return distance;
}
function distancesToTargets(targets,adjacency){
  const reverse = nodes.map(() => []);
  for (let from = 0; from < N; from++) for (const to of adjacency[from]) reverse[to].push(from);
  const distance = new Int16Array(N).fill(-1);
  const queue = [];
  for (const target of targets){
    if (distance[target] !== -1) continue;
    distance[target] = 0;
    queue.push(target);
  }
  for (let cursor = 0; cursor < queue.length; cursor++){
    const to = queue[cursor];
    for (const from of reverse[to]) if (distance[from] === -1){
      distance[from] = distance[to] + 1;
      queue.push(from);
    }
  }
  return distance;
}
function updateArrowGuidance(){
  const usable = phase === 'move' && !bindMode && activeDisc >= 0;
  const player = usable ? players[activeDisc] : null;
  if (!player || !player.alive || player.done || player.steps <= 0){
    resetArrowGuidance();
    return;
  }
  const adjacency = playerNavigationAdjacency(activeDisc);
  const targets = player.touched ? [CENTER] : [...ring6];
  const targetSet = new Set(targets);
  const fromStart = distancesFromStart(player.pos,adjacency,targets);
  const toGoal = distancesToTargets(targets,adjacency);
  const shortestLength = toGoal[player.pos];
  const allowedSets = adjacency.map(list => new Set(list));
  let shortest = 0, detour = 0, dead = 0;
  for (const visual of arrowVisuals){
    if (fromStart[visual.from] < 0 || targetSet.has(visual.from)){
      setArrowAppearance(visual,'inactive');
      continue;
    }
    let state;
    if (!allowedSets[visual.from].has(visual.to) || toGoal[visual.to] < 0){
      state = 'dead';
      dead++;
    } else if (shortestLength >= 0 && fromStart[visual.from] + 1 + toGoal[visual.to] === shortestLength){
      state = 'shortest';
      shortest++;
    } else {
      state = 'detour';
      detour++;
    }
    setArrowAppearance(visual,state);
  }
  const legend = document.getElementById('routeLegend');
  const goal = document.getElementById('routeGoal');
  if (legend) legend.hidden = false;
  if (goal){
    const destination = player.touched ? 'sentrum' : 'ytterringen';
    const routeStatus = shortestLength < 0 ? ' · ingen åpen rute akkurat nå' : ' · korteste avstand ' + shortestLength + ' steg';
    goal.textContent = 'Mål: ' + destination + routeStatus;
    legend?.setAttribute('aria-label','Navigasjon mot ' + destination + ': ' + shortest + ' grønne korteste piler, ' + detour + ' gule omveier og ' + dead + ' røde blindveier eller blokkerte piler.');
  }
}
function renderAll(){
  dark.forEach((piece,index) => {
    const [ox,oy] = stackOffset(index,piece.pos);
    piece.el.style.transform = 'translate(' + (XY[piece.pos][0]+ox) + 'px,' + (XY[piece.pos][1]+oy) + 'px)';
    piece.el.classList.toggle('bound',piece.bound);
  });
  players.forEach((player,index) => {
    player.el.style.display = player.alive ? '' : 'none';
    const shared = players[0].alive && players[1].alive && players[0].pos === players[1].pos;
    const offset = shared ? (index === 0 ? -10 : 10) : 0;
    player.el.style.transform = 'translate(' + (XY[player.pos][0]+offset) + 'px,' + XY[player.pos][1] + 'px)';
    player.el.classList.toggle('p-select',index === activeDisc);
    player.el.style.opacity = player.done ? .55 : 1;
  });
  renderSectorGuides();
  renderBindTargets();
  updateArrowGuidance();
  updateNodeAccessibility();
}
function legalMovesFor(index){ return Engine.legalMoves(liveState(),index,rulesFor(),graph); }
function renderLegal(){
  legalG.innerHTML = '';
  if (bindMode || phase !== 'move' || activeDisc < 0) { updateNodeAccessibility(); return; }
  const player = players[activeDisc];
  if (player && player.alive && !player.done){
    el('circle',{cx:XY[player.pos][0],cy:XY[player.pos][1],r:22,class:'active-node-ring'},legalG);
  }
  for (const node of legalMovesFor(activeDisc)){
    el('line',{x1:XY[player.pos][0],y1:XY[player.pos][1],x2:XY[node][0],y2:XY[node][1],class:'legal-link'},legalG);
    const marker = el('g',{class:'legal-marker'},legalG);
    el('circle',{cx:XY[node][0],cy:XY[node][1],r:13,class:'legal-ring'},marker);
    el('circle',{cx:XY[node][0],cy:XY[node][1],r:3.5,class:'legal-core'},marker);
  }
  updateNodeAccessibility();
}
function nodeName(index){
  if (index === CENTER) return 'sentrum, hjem';
  if (isCorner(index)) return 'hjørne ' + (Number(nodes[index][1]) + 1);
  const [ring,spoke] = nodes[index].split(',').map(Number);
  return 'ring ' + ring + ', eike ' + (spoke + 1);
}
function updateNodeAccessibility(){
  if (!tapNodes.length || !players.length) return;
  const legal = new Set(phase === 'move' && !bindMode && activeDisc >= 0 ? legalMovesFor(activeDisc) : []);
  tapNodes.forEach((circle,index) => {
    const parts = [nodeName(index)];
    const herePlayers = [];
    players.forEach((player,number) => { if (player.alive && !player.done && player.pos === index) herePlayers.push(number === 0 ? 'brikke I' : 'brikke II'); });
    if (herePlayers.length) parts.push(herePlayers.join(' og '));
    const hereDark = dark.filter(piece => piece.pos === index);
    if (hereDark.length){
      const snakes = hereDark.filter(piece => piece.type === 'S').length;
      const foxes = hereDark.length - snakes;
      if (snakes) parts.push(snakes + (snakes === 1 ? ' slange' : ' slanger'));
      if (foxes) parts.push(foxes + (foxes === 1 ? ' rev' : ' rever'));
    }
    if (legal.has(index)) parts.push('lovlig trekk');
    if (rulesFor().returnRule === 'sector' && activeDisc >= 0){
      const player = players[activeDisc];
      if (player && player.touched && index !== CENTER && spokeOfN(index) >= 0 && circDist(spokeOfN(index),player.touchSpoke) >= 4) parts.push('gyldig hjemsektor');
    }
    const selectable = legal.has(index) || herePlayers.length > 0;
    circle.setAttribute('aria-label',parts.join(', '));
    circle.setAttribute('aria-disabled',selectable ? 'false' : 'true');
    circle.setAttribute('tabindex',!bindMode && index === rovingNode ? '0' : '-1');
  });
}

/* ================= HUD ================= */
const $ = identifier => document.getElementById(identifier);
function pipDie(value, enemy, label){
  const die = document.createElement('span');
  die.className = 'die' + (enemy ? ' enemy' : '') + (value ? '' : ' empty');
  die.setAttribute('role','img');
  die.setAttribute('aria-label',label || (value ? value + ' øyne' : 'tom terning'));
  if (typeof value !== 'number' || !isFinite(value) || value < 0) value = 0;
  if (value > 6){ die.classList.add('num'); die.textContent = value; return die; }
  const map = {1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};
  for (let cell = 0; cell < 9; cell++){
    const pip = document.createElement('span');
    if (value && map[value].includes(cell)) pip.className = 'pip';
    pip.style.gridArea = (Math.floor(cell/3)+1) + ' / ' + (cell%3+1);
    die.appendChild(pip);
  }
  return die;
}
function symDie(symbol,index){
  const die = document.createElement('span');
  die.className = 'die enemy sym' + (symbol ? '' : ' empty');
  const name = symbol === 'S' ? 'slange' : symbol === 'F' ? 'rev' : symbol === 'B' ? 'blank' : 'tom';
  die.setAttribute('role','img'); die.setAttribute('aria-label','Fiendeterning ' + (index + 1) + ': ' + name);
  const icon = document.createElementNS(NS,'svg');
  icon.setAttribute('viewBox','0 0 20 20'); icon.setAttribute('width','16'); icon.setAttribute('height','16'); icon.setAttribute('aria-hidden','true');
  if (symbol === 'S' || symbol === 'F'){
    const path = document.createElementNS(NS,'path');
    path.setAttribute('d',symbol === 'S' ? 'M2 11 Q 6 4, 10 11 T 18 11' : 'M10 3 L17 15 L3 15 Z');
    path.setAttribute('fill','none'); path.setAttribute('stroke','var(--wood)'); path.setAttribute('stroke-width','2.2');
    path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round'); icon.appendChild(path);
  }
  die.appendChild(icon); return die;
}
function appendPlayerDie(container,player,index,value){
  const slot = document.createElement('span'); slot.className = 'die-slot';
  const label = document.createElement('span'); label.className = 'die-label'; label.textContent = index === 0 ? 'I' : 'II';
  slot.appendChild(label); slot.appendChild(pipDie(value,false,'Brikke ' + (index === 0 ? 'I' : 'II') + ': ' + value + ' steg igjen'));
  container.appendChild(slot);
}
function drawDice(){
  const playerDice = $('pdice'), enemyDice = $('edice');
  playerDice.innerHTML = ''; enemyDice.innerHTML = '';
  let playerCount = 0;
  players.forEach((player,index) => {
    if (player.alive && !player.done){ appendPlayerDie(playerDice,player,index,phase === 'move' ? (player.steps || 0) : 0); playerCount++; }
  });
  if (!playerCount && phase !== 'dark'){
    appendPlayerDie(playerDice,{alive:false},0,0); appendPlayerDie(playerDice,{alive:false},1,0);
  }
  if (rulesFor().enemy === 'symbols'){
    const values = typeof eDice[0] === 'string' ? eDice : [null,null,null,null,null,null];
    values.forEach((symbol,index) => enemyDice.appendChild(symDie(symbol,index)));
  } else {
    enemyDice.appendChild(pipDie(eDice[0],true,'Fiendeterning én: ' + (eDice[0] || 0)));
    enemyDice.appendChild(pipDie(eDice[1],true,'Fiendeterning to: ' + (eDice[1] || 0)));
  }
}
function status(html){ $('status').innerHTML = html; }
function log(message){
  const item = document.createElement('li');
  item.innerHTML = (turnNo ? '<b>R' + turnNo + '</b> ' : '') + message;
  $('log').prepend(item);
}
function updateJourney(){
  players.forEach((player,index) => {
    const card = $('journey' + index), label = $('journeyStatus' + index);
    if (!card || !label) return;
    let stage = 'out', text = 'mot kanten';
    if (!player.alive){ stage = 'lost'; text = 'tatt'; }
    else if (player.done){ stage = 'done'; text = 'trygg hjemme'; }
    else if (player.touched){ stage = 'home'; text = 'på vei hjem'; }
    card.dataset.stage = stage;
    label.textContent = text;
    card.setAttribute('aria-label','Brikke ' + (index === 0 ? 'I' : 'II') + ': ' + text);
  });
}
function updateHud(){
  $('rollBtn').disabled = phase !== 'roll' || bindMode;
  $('darkBtn').disabled = phase !== 'move' || bindMode;
  $('swapBtn').disabled = !(phase === 'move' && !bindMode && !anyStep && livingDiscs().length === 2);
  $('undoBtn').disabled = !(phase === 'move' && !bindMode && undoStack.length);
  $('pickBtn').disabled = phase === 'dark' || bindMode;
  const remaining = players.reduce((sum,player) => sum + (player.alive && !player.done ? Math.max(0,player.steps || 0) : 0),0);
  $('darkBtn').textContent = phase === 'move' && remaining > 0 ? 'Avslutt tur (' + remaining + ' steg ubrukt)' : 'Avslutt tur: fienden flytter';
  const lockedByBind = bindMode;
  $('chMot').disabled = lockedByBind || cheats.mot || phase === 'ritual' || phase === 'over' || phase === 'dark' || phase === 'move';
  $('chIld').disabled = lockedByBind || cheats.ild || !(phase === 'roll' || phase === 'move');
  $('chMus').disabled = lockedByBind || cheats.mus || !(phase === 'roll' || phase === 'move');
  $('chJern').disabled = cheats.jern || (!bindMode && !(phase === 'roll' || phase === 'move'));
  $('chMot').classList.toggle('armed',motArmed);
  $('chJern').classList.toggle('armed',bindMode);
  $('chJern').setAttribute('aria-pressed',bindMode ? 'true' : 'false');
  $('chJern').querySelector('b').textContent = bindMode ? 'Avbryt jern' : 'Jern';
  $('chJern').querySelector('.cheat-copy').textContent = bindMode ? 'trykk igjen eller Esc for å avbryte' : 'til å binde: lås én brikke for godt';
  updateJourney(); drawDice(); renderBindTargets(); updateNodeAccessibility();
}

/* ================= player turn ================= */
function beginPlayerTurn(){
  turnNo++;
  pDice = [rng.d6(),rng.d6()];
  if (motArmed){
    pDice = [pDice[0] * 2,pDice[1] * 2]; motArmed = false;
    log('MOT styrker deg. Kastet dobles: ' + pDice[0] + ' og ' + pDice[1] + '.');
  }
  const living = livingDiscs();
  const soloUsesHighest = rulesFor().soloRule === 'max';
  const soloSteps = soloUsesHighest ? Math.max(pDice[0],pDice[1]) : pDice[0] + pDice[1];
  if (living.length === 2) players.forEach((player,index) => { if (player.alive && !player.done) player.steps = pDice[index] || 0; });
  else if (living.length === 1) living[0].steps = soloSteps;
  anyStep = false; eDice = [0,0]; undoStack = []; phase = 'move';
  activeDisc = players.findIndex(player => player.alive && !player.done);
  if (activeDisc >= 0) rovingNode = players[activeDisc].pos;
  status('Runde <b>' + turnNo + '</b>. Du kastet <b>' + pDice[0] + '</b> og <b>' + pDice[1] + '</b>.' +
    (living.length === 1 ? (soloUsesHighest ? ' Den siste brikken bruker den høyeste terningen: <b>' + soloSteps + '</b> steg.' : ' Den siste brikken bruker begge.') : '') +
    ' Velg en brikke og et gult felt; du kan stoppe før alle steg er brukt.');
  log('Du kaster ' + pDice[0] + ' og ' + pDice[1] + '.');
  renderAll(); renderLegal(); updateHud();
}
$('rollBtn').addEventListener('click',() => { if (phase === 'roll') beginPlayerTurn(); });
$('undoBtn').addEventListener('click',() => {
  if (phase !== 'move' || bindMode || !undoStack.length) return;
  const snapshot = undoStack.pop();
  players.forEach((player,index) => Object.assign(player,snapshot.players[index]));
  activeDisc = snapshot.activeDisc; anyStep = snapshot.anyStep; rovingNode = snapshot.rovingNode;
  log('Angret ett steg.'); renderAll(); renderLegal(); updateHud();
});
$('swapBtn').addEventListener('click',() => {
  if (phase !== 'move' || bindMode || anyStep) return;
  const living = livingDiscs();
  if (living.length === 2) [living[0].steps,living[1].steps] = [living[1].steps,living[0].steps];
  renderLegal(); updateHud();
});
function applyPlayerStep(index,node){
  const player = players[index];
  undoStack.push({
    players:players.map(p => ({pos:p.pos,alive:p.alive,touched:p.touched,done:p.done,steps:p.steps,touchSpoke:p.touchSpoke})),
    activeDisc,anyStep,rovingNode
  });
  player.pos = node; player.steps--; anyStep = true; rovingNode = node;
  if (ring6.has(node) && !player.touched){
    player.touched = true; player.touchSpoke = spokeOfN(node);
    log('Brikke ' + (index === 0 ? 'I' : 'II') + ' når kanten av veven.' + (rulesFor().returnRule === 'sector' ? ' Inngangssektoren og gyldige hjem-eiker markeres.' : ''));
  }
  if (node === CENTER && player.touched && !player.done){
    player.done = true; player.steps = 0;
    log('Brikke ' + (index === 0 ? 'I' : 'II') + ' er trygt hjemme.');
    if (checkWin()) return;
    activeDisc = players.findIndex(p => p.alive && !p.done);
    if (activeDisc >= 0) rovingNode = players[activeDisc].pos;
  }
  if (player.steps <= 0){
    const next = players.findIndex(p => p.alive && !p.done && p.steps > 0);
    if (next >= 0){ activeDisc = next; rovingNode = players[next].pos; }
  }
  renderAll(); renderLegal(); updateHud();
}
function tapNode(node){
  if (bindMode) return;
  if (phase !== 'move') return;
  if (activeDisc >= 0 && legalMovesFor(activeDisc).includes(node)){
    applyPlayerStep(activeDisc,node);
    return;
  }
  const here = [];
  players.forEach((player,index) => { if (player.alive && !player.done && player.pos === node) here.push(index); });
  if (!here.length) return;
  const current = here.indexOf(activeDisc);
  selectDisc(here[(current + 1 + here.length) % here.length]);
}
function selectDisc(index){
  const player = players[index];
  if (phase !== 'move' || !player || !player.alive || player.done) return;
  activeDisc = index; rovingNode = player.pos;
  if (rulesFor().returnRule === 'sector' && player.touched){
    status('Brikke <b>' + (index === 0 ? 'I' : 'II') + '</b> valgt. Inngangssektoren er ringet inn; gyldige hjem-eiker lyser ved sentrum.');
  }
  renderAll(); renderLegal(); updateHud();
}

/* ================= rule-breaking powers ================= */
function breach(message){ breaches++; log(message + ' <b>(regelbrudd)</b>'); }
function flashPower(kind){
  const board = $('boardwrap'), classes = ['fx-mot','fx-ild','fx-mus','fx-jern'];
  board.classList.remove(...classes);
  void board.offsetWidth;
  const className = 'fx-' + kind;
  board.classList.add(className);
  window.setTimeout(() => board.classList.remove(className),950);
}
function beginBindMode(){
  if (cheats.jern || !(phase === 'roll' || phase === 'move')) return;
  bindMode = true; bindReturnStatus = $('status').innerHTML;
  status('JERN: Velg den markerte slangen eller reven som skal bindes. Hver stablet brikke kan velges direkte. Trykk Jern igjen eller Esc for å avbryte.');
  renderLegal(); renderAll(); updateHud();
  requestAnimationFrame(() => {
    const first = dark.find(piece => !piece.bound);
    if (first) first.el.focus();
  });
}
function cancelBindMode(announce = true){
  if (!bindMode) return;
  bindMode = false;
  if (announce) status(bindReturnStatus || 'Jern ble ikke brukt.');
  renderAll(); renderLegal(); updateHud();
  if (phase === 'move' && activeDisc >= 0) setRovingNode(players[activeDisc].pos,true);
  else $('chJern').focus();
}
function bindDark(index){
  if (!bindMode) return;
  const piece = dark[index];
  if (!piece || piece.bound) return;
  piece.bound = true; bindMode = false; cheats.jern = true;
  const typeName = piece.type === 'S' ? 'slange' : 'rev';
  breach('JERN binder en ' + typeName + '. Den rører seg aldri mer.');
  status('Jern binder en <b>' + typeName + '</b>. Fortsett turen.');
  flashPower('jern');
  renderAll(); renderLegal(); updateHud();
  if (phase === 'move' && activeDisc >= 0) setRovingNode(players[activeDisc].pos,true);
  else $('rollBtn').focus();
}
$('chMot').addEventListener('click',() => {
  if (cheats.mot || bindMode) return;
  cheats.mot = true; motArmed = true; breach('MOT er påkalt. Neste kast dobles.'); flashPower('mot'); updateHud();
});
$('chIld').addEventListener('click',() => {
  if (cheats.ild || bindMode) return;
  cheats.ild = true; blindNext = true; breach('ILD blinder fienden. Neste fiendefase står de stille.'); flashPower('ild'); updateHud();
});
$('chMus').addEventListener('click',() => {
  if (cheats.mus || bindMode) return;
  cheats.mus = true; dazzle = 2; breach('MUSIKK blender fienden i to fiendefaser.'); flashPower('mus'); updateHud();
});
$('chJern').addEventListener('click',() => { if (bindMode) cancelBindMode(); else beginBindMode(); });
document.addEventListener('keydown',event => {
  if (event.key === 'Escape' && bindMode && !$('overlay').open){ event.preventDefault(); cancelBindMode(); }
});

/* ================= enemy phase ================= */
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ENEMY_TIMING = Object.freeze({
  transition:500,
  nodePause:200
});
async function waitAtEnemyNode(version){
  if (reduceMotion) return version === gameVersion;
  await sleep(ENEMY_TIMING.transition);
  if (version !== gameVersion) return false;
  await sleep(ENEMY_TIMING.nodePause);
  return version === gameVersion;
}
function logCaptures(indices,type,landing = false){
  for (const index of indices){
    const name = index === 0 ? 'I' : 'II';
    if (landing) log('En rev lander på brikke ' + name + '. Den er tatt.');
    else log('En ' + (type === 'S' ? 'slange' : 'rev') + ' berører brikke ' + name + '. Den er tatt.');
  }
}
function moveDarkOneLive(choice,adj,matrix){
  const result = Engine.moveDarkOne(liveState(),choice.index,choice.target,adj,matrix,rng);
  if (result.captured.length) logCaptures(result.captured,dark[choice.index].type,false);
  return result.moved;
}
function moveSnakeOneLive(index,adj,matrix){
  const result = Engine.moveSnakeOne(liveState(),index,adj,matrix,rng);
  if (result.captured.length) logCaptures(result.captured,'S',false);
  return result.moved;
}
async function animateDarkStepLive(choice,adj,matrix,version){
  const piece = dark[choice.index];
  piece.el.classList.add('enemy-moving');
  const moved = moveDarkOneLive(choice,adj,matrix);
  if (!moved){ piece.el.classList.remove('enemy-moving'); return {moved:false,cancelled:false}; }
  renderAll();
  if (!await waitAtEnemyNode(version)) return {moved:true,cancelled:true};
  piece.el.classList.remove('enemy-moving');
  return {moved:true,cancelled:false};
}
async function animateSnakeStepLive(index,adj,matrix,version){
  const piece = dark[index];
  piece.el.classList.add('enemy-moving');
  const moved = moveSnakeOneLive(index,adj,matrix);
  if (!moved){ piece.el.classList.remove('enemy-moving'); return {moved:false,cancelled:false}; }
  renderAll();
  if (!await waitAtEnemyNode(version)) return {moved:true,cancelled:true};
  piece.el.classList.remove('enemy-moving');
  return {moved:true,cancelled:false};
}
async function foxHopLive(index,version){
  const plan = Engine.planFoxHop(liveState(),index,graph,rng);
  if (!plan) return {moved:false,leapt:false};
  const piece = dark[index];
  const finish = result => { clearFoxHopFx(); piece.el.classList.remove('fox-hopping','enemy-moving'); return result; };
  piece.el.classList.add('fox-hopping','enemy-moving');
  renderFoxHopFx(plan,'mid');
  piece.pos = plan.mid; renderAll();
  if (!await waitAtEnemyNode(version)) return finish({cancelled:true});
  if (plan.overPlayers.length){
    const names = plan.overPlayers.map(playerIndex => playerIndex === 0 ? 'I' : 'II').join(' og ');
    log('En rev springer over brikke ' + names + '. Brikken er trygg; reven stanser etter landingen.');
  }

  renderFoxHopFx(plan,'land');
  piece.pos = plan.land;
  const captured = Engine.captureAt(liveState(),plan.land);
  if (captured.length) logCaptures(captured,'F',true);
  renderAll();
  if (!await waitAtEnemyNode(version)) return finish({cancelled:true});
  return finish({moved:true,leapt:plan.leapt});
}
async function runSymbolEnemy(version){
  const dazzled = dazzle > 0;
  if (dazzled) dazzle--;
  const numberOfDice = dazzled ? 3 : 6;
  eDice = [];
  for (let i = 0; i < numberOfDice; i++){
    const roll = rng.int(6);
    eDice.push(roll < 2 ? 'S' : roll < 4 ? 'F' : 'B');
  }
  const snakeFaces = eDice.filter(value => value === 'S').length;
  const foxFaces = eDice.filter(value => value === 'F').length;
  drawDice();
  const note = dazzled ? ' Musikken blender dem; bare tre terninger kastes.' : '';
  status('Terningene viser <b>' + snakeFaces + '</b> slangeflater og <b>' + foxFaces + '</b> revflater.' + note);
  log('Fienden kaster ' + snakeFaces + ' slangeflater og ' + foxFaces + ' revflater' + (dazzled ? ' (blendet).' : '.'));
  updateHud();

  const snakeAdj = graph.topology === 'wild' ? graph.out : graph.outSC;
  const snakeDist = graph.topology === 'wild' ? graph.dist : graph.distSC;
  const wokenSnakes = new Set();
  for (let activation = 0; activation < snakeFaces && players.some(player => player.alive); activation++){
    const choice = Engine.choosePursuer(liveState(),(piece,index) => piece.type === 'S' && !piece.bound && !wokenSnakes.has(index),snakeDist,rng);
    if (!choice) break;
    wokenSnakes.add(choice.index);
    for (let step = 0; step < 2; step++){
      const stepResult = await animateSnakeStepLive(choice.index,snakeAdj,snakeDist,version);
      if (stepResult.cancelled) return false;
      if (!stepResult.moved) break;
      if (!players.some(player => player.alive)) break;
    }
  }

  const wokenFoxes = new Set();
  for (let activation = 0; activation < foxFaces && players.some(player => player.alive); activation++){
    const choice = Engine.choosePursuer(liveState(),(piece,index) => piece.type === 'F' && !piece.bound && !wokenFoxes.has(index),graph.dist,rng);
    if (!choice) break;
    wokenFoxes.add(choice.index);
    for (let hop = 0; hop < 2; hop++){
      const result = await foxHopLive(choice.index,version);
      if (result.cancelled) return false;
      if (!result.moved || result.leapt || !players.some(player => player.alive)) break;
    }
  }
  return version === gameVersion;
}
async function runTideEnemy(version){
  eDice = [0,0]; drawDice(); status('Slangene siger fremover.');
  let crept = 0;
  const snakeIndices = rng.shuffled(dark.map((piece,index) => ({piece,index})).filter(item => item.piece.type === 'S' && !item.piece.bound).map(item => item.index));
  for (const index of snakeIndices){
    if (!players.some(player => player.alive)) break;
    const stepResult = await animateSnakeStepLive(index,graph.out,graph.dist,version);
    if (stepResult.cancelled) return false;
    if (stepResult.moved) crept++;
  }
  if (crept) log('Tidevannet: ' + crept + ' slanger siger ett steg.');
  if (!players.some(player => player.alive)) return true;
  eDice = [rng.d6(),rng.d6()];
  let total = eDice[0] + eDice[1];
  let note = '';
  if (dazzle > 0){ total = Math.floor(total / 2); dazzle--; note = ' Musikken blender dem; spranget er halvert.'; }
  status('Revene kaster <b>' + eDice[0] + '</b> og <b>' + eDice[1] + '</b>.' + note);
  log('Revene kaster ' + eDice[0] + ' og ' + eDice[1] + (note ? ' (blendet, ' + total + ' steg).' : '.'));
  updateHud();
  const moved = new Map();
  while (total > 0 && players.some(player => player.alive)){
    const choice = Engine.choosePursuer(liveState(),(piece,index) => piece.type === 'F' && !piece.bound && (moved.get(index) || 0) < 4,graph.dist,rng);
    if (!choice) break;
    const stepResult = await animateDarkStepLive(choice,graph.out,graph.dist,version);
    if (stepResult.cancelled) return false;
    if (!stepResult.moved){ moved.set(choice.index,99); continue; }
    moved.set(choice.index,(moved.get(choice.index) || 0) + 1); total--;
  }
  return version === gameVersion;
}
async function runAggregateEnemy(version){
  eDice = [rng.d6(),rng.d6()];
  let total = eDice[0] + eDice[1];
  let note = '';
  if (dazzle > 0){ total = Math.floor(total / 2); dazzle--; note = ' Musikken blender dem; farten er halvert.'; }
  status('Fienden kaster <b>' + eDice[0] + '</b> og <b>' + eDice[1] + '</b>.' + note);
  log('Fienden kaster ' + eDice[0] + ' og ' + eDice[1] + (note ? ' (blendet, ' + total + ' steg).' : '.'));
  updateHud();
  const moved = new Map();
  while (total > 0 && players.some(player => player.alive)){
    const choice = Engine.choosePursuer(liveState(),(piece,index) => !piece.bound && (moved.get(index) || 0) < 3,graph.dist,rng);
    if (!choice) break;
    const stepResult = await animateDarkStepLive(choice,graph.out,graph.dist,version);
    if (stepResult.cancelled) return false;
    if (!stepResult.moved){ moved.set(choice.index,99); continue; }
    moved.set(choice.index,(moved.get(choice.index) || 0) + 1); total--;
  }
  return version === gameVersion;
}
$('darkBtn').addEventListener('click',async () => {
  if (phase !== 'move' || bindMode) return;
  const version = gameVersion;
  undoStack = []; phase = 'dark'; activeDisc = -1;
  renderLegal(); renderAll(); updateHud();
  if (blindNext){
    blindNext = false; eDice = [0,0]; drawDice(); status('Fienden famler i mørket. Ingen rører seg.');
    if (!await waitAtEnemyNode(version)) return;
    endDark(); return;
  }
  let completed = true;
  if (rulesFor().enemy === 'symbols') completed = await runSymbolEnemy(version);
  else if (rulesFor().enemy === 'tide') completed = await runTideEnemy(version);
  else completed = await runAggregateEnemy(version);
  if (completed && version === gameVersion) endDark();
});
function endDark(){
  if (!players.some(player => player.alive)){ gameOver(false); return; }
  if (checkWin()) return;
  phase = 'roll'; status('Runde <b>' + (turnNo + 1) + '</b>. Kast terningene.');
  renderAll(); updateHud();
}
function checkWin(){
  const alive = players.filter(player => player.alive);
  if (alive.length && alive.every(player => player.done)){ gameOver(true); return true; }
  return false;
}

/* ================= rules panel ================= */
function formatPercent(value){ return value == null ? 'ikke målt' : (value * 100).toFixed(1).replace('.',',') + ' %'; }
function modeHint(name){
  const rule = rulesFor(name), stat = BALANCE_STATS[name];
  const measurement = stat && stat.games ? ' Testbot: ' + formatPercent(stat.rate) + ' seier (n=' + stat.games.toLocaleString('nb-NO') + ').' : '';
  return (name === 'symbol' ? 'Start her. ' : '') + rule.label + '. ' + rule.short + measurement;
}
function renderRulesPanel(){
  document.body.dataset.mode = mode;
  const badge = $('modeBadge'), descriptor = $('modeDescriptor');
  if (badge) badge.textContent = rulesFor().label;
  if (descriptor) descriptor.textContent = rulesFor().short;
  const title = $('selectedModeName'), text = $('selectedModeRules'), body = $('balanceTableBody');
  if (title) title.textContent = rulesFor().label;
  if (text) text.textContent = rulesFor().rules;
  if (body){
    body.innerHTML = '';
    for (const name of Object.keys(RULESETS)){
      const stat = BALANCE_STATS[name];
      const row = document.createElement('tr');
      const interval = stat && stat.games ? formatPercent(stat.low) + '–' + formatPercent(stat.high) : '–';
      row.innerHTML = '<th scope="row">' + RULESETS[name].label + '</th><td>' + (stat && stat.games ? stat.games.toLocaleString('nb-NO') : '–') + '</td><td>' + formatPercent(stat && stat.rate) + '</td><td>' + interval + '</td><td>' + (stat && stat.avgRounds ? stat.avgRounds.toFixed(1).replace('.',',') : '–') + '</td>';
      body.appendChild(row);
    }
  }
  const power = $('powerMeasurement');
  if (power && POWER_STATS) power.textContent = POWER_STATS;
}

/* ================= dialog and endings ================= */
const overlay = $('overlay');
let overlayContext = 'ritual', pickerOriginalMode = mode;
function openOverlay(context,closable,focusSelector){
  overlayContext = context;
  overlay.dataset.closable = closable ? 'true' : 'false';
  if (!overlay.open) overlay.showModal();
  requestAnimationFrame(() => {
    const target = focusSelector ? overlay.querySelector(focusSelector) : null;
    const fallback = overlay.querySelector('.modebtn.selected, button, [href], [tabindex]:not([tabindex="-1"])');
    (target || fallback)?.focus();
  });
}
function closeOverlay(){ if (overlay.open) overlay.close(); }
overlay.addEventListener('cancel',event => {
  if (overlay.dataset.closable !== 'true'){ event.preventDefault(); return; }
  event.preventDefault();
  if (overlayContext === 'picker'){
    mode = pickerOriginalMode;
    renderRulesPanel();
  }
  closeOverlay();
});
overlay.addEventListener('keydown',event => {
  if (event.key !== 'Tab' || !overlay.open) return;
  const focusable = [...overlay.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  if (!focusable.length){ event.preventDefault(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  else if (!overlay.contains(document.activeElement)){ event.preventDefault(); first.focus(); }
});
function modeButtonsHtml(){
  return Object.keys(RULESETS).map(name => '<button class="modebtn' + (mode === name ? ' selected' : '') + '" data-mode="' + name + '">' + RULESETS[name].label + '</button>').join('');
}
function wireModeButtons(scope){
  scope.querySelectorAll('.modebtn').forEach(button => button.addEventListener('click',() => {
    mode = button.dataset.mode;
    scope.querySelectorAll('.modebtn').forEach(other => other.classList.toggle('selected',other === button));
    const hint = scope.querySelector('#modehint'); if (hint) hint.textContent = modeHint(mode);
    renderRulesPanel();
  }));
}
const ritualHTML = $('panelcontent').innerHTML;
function wireStart(scope){
  const start = scope.querySelector('#startBtn');
  if (!start) return;
  start.addEventListener('click',() => {
    closeOverlay(); reset();
    log('Tegnet er tegnet. «Mot til å styrke, ild til å blinde, musikk til å blende, jern til å binde.»');
    startPlay();
  });
}
function showModePicker(initial = false){
  pickerOriginalMode = mode;
  const content = $('panelcontent');
  content.innerHTML = ritualHTML;
  content.querySelectorAll('.modebtn').forEach(button => button.classList.toggle('selected',button.dataset.mode === mode));
  const hint = content.querySelector('#modehint'); if (hint) hint.textContent = modeHint(mode);
  wireModeButtons(content); wireStart(content);
  openOverlay('picker',!initial,'.modebtn.selected');
}
function gameOver(won){
  phase = 'over'; updateHud(); renderLegal();
  const content = $('panelcontent');
  let heading;
  if (!won){
    heading = '<h2 id="dialogTitle">Slangene og revene har deg</h2><p>Begge brikkene er tatt. Som alle i De to elver vet: fulgte du reglene, var dette gitt på forhånd.</p>';
    log('Spillet er tapt.');
  } else if (breaches === 0){
    heading = '<h2 id="dialogTitle">Du vant. Uten å jukse.</h2><p>Det skal ikke gå an. Talmanes ville sagt at dere telte feil. Et sted slapp noen ut av et tårn av stål akkurat nå.</p>';
    log('SEIER uten regelbrudd. Umulig, men sant.');
  } else {
    const homeCount = players.filter(player => player.alive && player.done).length;
    const homeText = homeCount === 2 ? 'Begge brikkene er hjemme' : 'Den siste brikken er hjemme';
    heading = '<h2 id="dialogTitle">Du slapp ut</h2><p>' + homeText + ', men bare fordi du brøt reglene ' + breaches + (breaches === 1 ? ' gang' : ' ganger') + '. Det er slik man vinner over slangene og revene.</p>';
    log('Seier med ' + breaches + ' regelbrudd.');
  }
  content.innerHTML = heading + '<div id="modes">' + modeButtonsHtml() + '</div><p id="modehint">' + modeHint(mode) + '</p><button class="big" id="againBtn">Spill igjen</button>';
  wireModeButtons(content);
  $('againBtn').addEventListener('click',() => { closeOverlay(); reset(); startPlay(); });
  openOverlay('gameover',false,'#againBtn');
}
function startPlay(){
  applyModeGraph(); phase = 'roll'; activeDisc = -1;
  status('Runde <b>1</b>. Kast terningene. Målet er ytterkanten og tilbake til sentrum med hver brikke som fortsatt lever.');
  log('Modus: ' + rulesFor().label + '. ' + rulesFor().short);
  if (rulesFor().topology === 'wild') log('Villveven er trukket på nytt: ' + graph.dirEdges.length + ' enveislinjer, med minst én rettet rute som følger pilene ut fra sentrum og minst én rettet rute som følger pilene hjem. Gylne piler peker utover langs eiker, grønne piler peker innover langs eiker, blå piler følger ringen mot klokken, og grå piler følger ringen med klokken. Når en pil ikke er markert som grønn, gul eller rød i spillerens navigasjonsvisning, vises den hvit.');
  renderAll(); updateHud();
}
$('resetBtn').addEventListener('click',() => { reset(); startPlay(); });
$('pickBtn').addEventListener('click',() => { $('rules').removeAttribute('open'); showModePicker(false); });

/* ================= pure simulator ================= */
const POWER_BITS = {mot:1,ild:2,mus:4,jern:8};
function createSimState(modeName,seed){
  const simDark = [];
  for (let corner = 0; corner < 4; corner++) for (let i = 0; i < 5; i++) simDark.push({pos:id['K' + corner],type:corner % 2 === 0 ? 'S' : 'F',bound:false,lastFrom:-1});
  const rules = rulesFor(modeName);
  return {
    mode:modeName, rules, graph:graphForMode(modeName,hashText(seed + ':graph')), dark:simDark,
    players:[0,1].map(() => ({pos:CENTER,alive:true,touched:false,done:false,steps:0,touchSpoke:-1})),
    turn:0,dazzle:0,blindNext:false,powersUsed:{mot:false,ild:false,mus:false,jern:false}
  };
}
function cloneSimState(state){
  return {...state,players:state.players.map(player => ({...player})),dark:state.dark.map(piece => ({...piece})),powersUsed:{...state.powersUsed}};
}
function simGoalDistance(player,position,state){
  if (!player.touched) return state.graph.outerDist[position];
  if (state.rules.returnRule === 'sector') return state.graph.sectorHome[player.touchSpoke][position];
  return state.graph.dist[position][CENTER];
}
function simThreatDistance(state,position){
  let best = 99;
  for (const piece of state.dark){
    if (piece.bound) continue;
    const matrix = state.rules.enemy === 'symbols' && piece.type === 'S' ? state.graph.distSC : state.graph.dist;
    const distance = matrix[piece.pos][position];
    if (distance >= 0 && distance < best) best = distance;
  }
  return best;
}
function simCaptureRisk(state,position){
  let minAny = 99, minSnake = 99, minFox = 99;
  for (const piece of state.dark){
    if (piece.bound) continue;
    const matrix = state.rules.enemy === 'symbols' && piece.type === 'S' ? state.graph.distSC : state.graph.dist;
    const distance = matrix[piece.pos][position];
    if (distance < 0) continue;
    minAny = Math.min(minAny,distance);
    if (piece.type === 'S') minSnake = Math.min(minSnake,distance);
    else minFox = Math.min(minFox,distance);
  }
  if (state.rules.enemy === 'aggregate'){
    if (minAny <= 3) return (4 - minAny) * 4200;
    if (minAny <= 5) return (6 - minAny) * 650;
    return 0;
  }
  if (state.rules.enemy === 'tide'){
    let risk = minSnake <= 1 ? 7500 : 0;
    if (minFox <= 4) risk += (5 - minFox) * 1700;
    return risk;
  }
  let risk = minSnake <= 2 ? (3 - minSnake) * 3800 : 0;
  if (minFox === 2) risk += 6200;
  else if (minFox === 4) risk += 2800;
  else if (minFox === 3) risk += 900;
  return risk;
}
const SIM_RISK_SCALE = 0.45;
function simStateScore(state){
  let score = 0;
  state.players.forEach(player => {
    if (!player.alive){ score -= 10000; return; }
    if (player.done){ score += 20000; return; }
    const goal = simGoalDistance(player,player.pos,state);
    const threat = simThreatDistance(state,player.pos);
    if (player.touched) score += 8000 - (goal < 0 ? 40 : goal) * 1200;
    else score -= (goal < 0 ? 40 : goal) * 1200;
    score += Math.min(threat,12) * 35;
    score -= simCaptureRisk(state,player.pos) * SIM_RISK_SCALE;
  });
  const active = Engine.activePlayerIndices(state);
  if (active.length === 2 && state.players[active[0]].pos === state.players[active[1]].pos && state.players[active[0]].pos !== CENTER) score -= 500;
  return score;
}
function simApplyPlayerStep(state,index,node){
  const player = state.players[index];
  player.pos = node; player.steps--;
  if (ring6.has(node) && !player.touched){ player.touched = true; player.touchSpoke = spokeOfN(node); }
  if (node === CENTER && player.touched){ player.done = true; player.steps = 0; }
}
function simMoveDiscGreedy(state,index,steps,random){
  const player = state.players[index];
  player.steps = steps;
  for (let step = 0; step < steps && player.alive && !player.done; step++){
    const legal = Engine.legalMoves(state,index,state.rules,state.graph);
    if (!legal.length) break;
    const currentScore = simStateScore(state);
    let bestScore = -Infinity;
    let bestMoves = [];
    for (const node of legal){
      const snapshot = {...player};
      simApplyPlayerStep(state,index,node);
      const score = simStateScore(state);
      Object.assign(player,snapshot);
      if (score > bestScore + 1e-9){ bestScore = score; bestMoves = [node]; }
      else if (Math.abs(score - bestScore) < 1e-9) bestMoves.push(node);
    }
    if (!bestMoves.length) break;
    simApplyPlayerStep(state,index,random.pick(bestMoves));
  }
  player.steps = 0;
}
function simPlayerTurn(state,dice,random){
  const active = Engine.activePlayerIndices(state);
  if (!active.length) return;
  if (active.length === 1){
    const steps = state.rules.soloRule === 'max' ? Math.max(dice[0],dice[1]) : dice[0] + dice[1];
    simMoveDiscGreedy(state,active[0],steps,random); return;
  }
  const scenarios = [];
  const assignments = [[dice[0],dice[1]],[dice[1],dice[0]]];
  const orders = [[active[0],active[1]],[active[1],active[0]]];
  assignments.forEach((assignment,a) => orders.forEach((order,o) => {
    const candidate = cloneSimState(state);
    const local = random.fork(a + ':' + o + ':' + state.turn);
    const stepsByIndex = new Map([[active[0],assignment[0]],[active[1],assignment[1]]]);
    order.forEach(index => simMoveDiscGreedy(candidate,index,stepsByIndex.get(index),local));
    scenarios.push({candidate,score:simStateScore(candidate)});
  }));
  const max = Math.max(...scenarios.map(item => item.score));
  const chosen = random.pick(scenarios.filter(item => item.score === max)).candidate;
  state.players = chosen.players;
}
function simMinThreat(state){
  let best = 99;
  for (const index of Engine.activePlayerIndices(state)) best = Math.min(best,simThreatDistance(state,state.players[index].pos));
  return best;
}
function simUsePowersBeforeRoll(state,powerMask){
  if ((powerMask & POWER_BITS.mot) && !state.powersUsed.mot){ state.powersUsed.mot = true; return true; }
  return false;
}
function simUseDefensivePowers(state,powerMask,random){
  const threat = simMinThreat(state);
  if ((powerMask & POWER_BITS.jern) && !state.powersUsed.jern && (threat <= 5 || state.turn >= 4)){
    const choice = Engine.choosePursuer(state,piece => !piece.bound,state.graph.dist,random);
    if (choice){ state.dark[choice.index].bound = true; state.powersUsed.jern = true; }
  }
  if ((powerMask & POWER_BITS.ild) && !state.powersUsed.ild && (threat <= 2 || state.turn >= 5)){
    state.blindNext = true; state.powersUsed.ild = true;
  }
  if ((powerMask & POWER_BITS.mus) && !state.powersUsed.mus && (threat <= 4 || state.turn >= 3)){
    state.dazzle = 2; state.powersUsed.mus = true;
  }
}
function simMoveDark(state,choice,adj,matrix,random){ return Engine.moveDarkOne(state,choice.index,choice.target,adj,matrix,random).moved; }
function simMoveSnake(state,index,adj,matrix,random){ return Engine.moveSnakeOne(state,index,adj,matrix,random).moved; }
function simEnemySymbols(state,random){
  const dazzled = state.dazzle > 0; if (dazzled) state.dazzle--;
  const dice = dazzled ? 3 : 6;
  let snakeFaces = 0, foxFaces = 0;
  for (let i = 0; i < dice; i++){ const roll = random.int(6); if (roll < 2) snakeFaces++; else if (roll < 4) foxFaces++; }
  const snakeAdj = state.graph.topology === 'wild' ? state.graph.out : state.graph.outSC;
  const snakeDist = state.graph.topology === 'wild' ? state.graph.dist : state.graph.distSC;
  const wokenSnakes = new Set();
  for (let activation = 0; activation < snakeFaces && Engine.activePlayerIndices(state).length; activation++){
    const choice = Engine.choosePursuer(state,(piece,index) => piece.type === 'S' && !piece.bound && !wokenSnakes.has(index),snakeDist,random);
    if (!choice) break; wokenSnakes.add(choice.index);
    for (let step = 0; step < 2; step++){
      if (!simMoveSnake(state,choice.index,snakeAdj,snakeDist,random)) break;
      if (!Engine.activePlayerIndices(state).length) break;
    }
  }
  const wokenFoxes = new Set();
  for (let activation = 0; activation < foxFaces && Engine.activePlayerIndices(state).length; activation++){
    const choice = Engine.choosePursuer(state,(piece,index) => piece.type === 'F' && !piece.bound && !wokenFoxes.has(index),state.graph.dist,random);
    if (!choice) break; wokenFoxes.add(choice.index);
    for (let hop = 0; hop < 2; hop++){
      const plan = Engine.planFoxHop(state,choice.index,state.graph,random); if (!plan) break;
      state.dark[choice.index].pos = plan.land; Engine.captureAt(state,plan.land);
      if (plan.leapt || !Engine.activePlayerIndices(state).length) break;
    }
  }
}
function simEnemyTide(state,random){
  const snakes = random.shuffled(state.dark.map((piece,index) => ({piece,index})).filter(item => item.piece.type === 'S' && !item.piece.bound).map(item => item.index));
  for (const index of snakes){
    if (!Engine.activePlayerIndices(state).length) break;
    simMoveSnake(state,index,state.graph.out,state.graph.dist,random);
  }
  let total = random.d6() + random.d6();
  if (state.dazzle > 0){ total = Math.floor(total / 2); state.dazzle--; }
  const moved = new Map();
  while (total > 0 && Engine.activePlayerIndices(state).length){
    const choice = Engine.choosePursuer(state,(piece,index) => piece.type === 'F' && !piece.bound && (moved.get(index) || 0) < 4,state.graph.dist,random);
    if (!choice) break;
    if (!simMoveDark(state,choice,state.graph.out,state.graph.dist,random)){ moved.set(choice.index,99); continue; }
    moved.set(choice.index,(moved.get(choice.index) || 0) + 1); total--;
  }
}
function simEnemyAggregate(state,random){
  let total = random.d6() + random.d6();
  if (state.dazzle > 0){ total = Math.floor(total / 2); state.dazzle--; }
  const moved = new Map();
  while (total > 0 && Engine.activePlayerIndices(state).length){
    const choice = Engine.choosePursuer(state,(piece,index) => !piece.bound && (moved.get(index) || 0) < 3,state.graph.dist,random);
    if (!choice) break;
    if (!simMoveDark(state,choice,state.graph.out,state.graph.dist,random)){ moved.set(choice.index,99); continue; }
    moved.set(choice.index,(moved.get(choice.index) || 0) + 1); total--;
  }
}
function simWon(state){
  const alive = state.players.filter(player => player.alive);
  return alive.length > 0 && alive.every(player => player.done);
}
function runSimGame(modeName,seed,powerMask = 0,maxTurns = 80){
  const random = new SeededRng(seed);
  const state = createSimState(modeName,seed);
  for (let turn = 1; turn <= maxTurns; turn++){
    state.turn = turn;
    let dice = [random.d6(),random.d6()];
    if (simUsePowersBeforeRoll(state,powerMask)) dice = [dice[0] * 2,dice[1] * 2];
    simPlayerTurn(state,dice,random);
    if (simWon(state)) return {won:true,turns:turn,survivors:state.players.filter(player => player.alive).length};
    simUseDefensivePowers(state,powerMask,random);
    if (state.blindNext) state.blindNext = false;
    else if (state.rules.enemy === 'symbols') simEnemySymbols(state,random);
    else if (state.rules.enemy === 'tide') simEnemyTide(state,random);
    else simEnemyAggregate(state,random);
    if (!state.players.some(player => player.alive)) return {won:false,turns:turn,survivors:0};
    if (simWon(state)) return {won:true,turns:turn,survivors:state.players.filter(player => player.alive).length};
  }
  return {won:false,turns:maxTurns,survivors:state.players.filter(player => player.alive).length};
}
function wilson(wins,games){
  if (!games) return [0,0];
  const z = 1.959963984540054, p = wins / games, denominator = 1 + z*z/games;
  const center = (p + z*z/(2*games)) / denominator;
  const margin = z * Math.sqrt((p*(1-p) + z*z/(4*games))/games) / denominator;
  return [Math.max(0,center-margin),Math.min(1,center+margin)];
}
function runBalance(options = {}){
  const games = options.games || 1000, baseSeed = options.seed == null ? 0x5f3759df : options.seed >>> 0;
  const modes = options.modes || Object.keys(RULESETS), powerMask = options.powerMask || 0;
  const result = {};
  for (const name of modes){
    let wins = 0, rounds = 0, oneSurvivorWins = 0;
    for (let gameIndex = 0; gameIndex < games; gameIndex++){
      const seedKey = options.pairedPowers ? (baseSeed + ':' + name + ':' + gameIndex) : (baseSeed + ':' + name + ':' + powerMask + ':' + gameIndex);
      const seed = hashText(seedKey);
      const outcome = runSimGame(name,seed,powerMask);
      if (outcome.won){ wins++; if (outcome.survivors === 1) oneSurvivorWins++; }
      rounds += outcome.turns;
    }
    const [low,high] = wilson(wins,games);
    result[name] = {games,wins,rate:wins/games,low,high,avgRounds:rounds/games,oneSurvivorWins};
  }
  return result;
}
function runPowerMatrix(options = {}){
  const games = options.games || 500, modeName = options.mode || 'symbol', seed = options.seed == null ? 0x9e3779b9 : options.seed >>> 0;
  const rows = [];
  for (let mask = 0; mask < 16; mask++){
    const stats = runBalance({games,seed,modes:[modeName],powerMask:mask,pairedPowers:true})[modeName];
    rows.push({mask,powers:Object.keys(POWER_BITS).filter(name => mask & POWER_BITS[name]),...stats});
  }
  return rows;
}
window.gameDiagnostics = {
  RULESETS,GRAPHS,Engine,createWildGraph,runSimGame,runBalance,runPowerMatrix,
  currentSeed:() => gameSeed,
  liveState:() => ({mode,phase,activeDisc,players:players.map(p => ({...p,el:undefined})),dark:dark.map(d => ({...d,el:undefined})),bindMode}),
  legalMovesFor,
  setScenario(scenario){
    if (scenario.mode){ mode = scenario.mode; applyModeGraph(); }
    if (scenario.phase) phase = scenario.phase;
    if (scenario.players) scenario.players.forEach((value,index) => Object.assign(players[index],value));
    if (scenario.dark) scenario.dark.forEach((value,index) => Object.assign(dark[index],value));
    if (Number.isInteger(scenario.activeDisc)) activeDisc = scenario.activeDisc;
    renderAll(); renderLegal(); updateHud();
  },
  choosePursuerSamples(type,count = 100){
    const counts = {};
    for (let i = 0; i < count; i++){
      const local = new SeededRng(i + 1);
      const choice = Engine.choosePursuer(liveState(),piece => !type || piece.type === type,graph.dist,local);
      if (choice){ const key = nodes[dark[choice.index].pos]; counts[key] = (counts[key] || 0) + 1; }
    }
    return counts;
  }
};

/* ================= initialization ================= */
wireModeButtons(document);
wireStart(document);
reset();
renderRulesPanel();
showModePicker(true);
