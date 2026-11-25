import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame as randomGame, applyAction } from '../src/engine.js';
import { emptyPlan, validatePlan, commitPlan, stepPlay, chooseOffensivePlan } from '../src/plans.js';
import { PLAYER_POOL } from '../src/roster.js';
import type { GameState } from '../src/types.js';

test('every player has S holds, including rare stamina and rebound allowances', () => {
  const s = createGame();
  Object.assign(s.players[0], PLAYER_POOL.find(p => p.stamina === 3));
  Object.assign(s.players[1], PLAYER_POOL.find(p => p.stamina === 7));
  for (const p of s.players) s.remaining[p.id] = p.stamina;
  const plan = emptyPlan(s);
  assert.equal(plan.slots, 7);
  assert.ok(Object.values(plan.rows).every(row => row.length === 7 && row.every(a => a.type === 'hold')));
  assert.ok(!validatePlan(s, plan).issues.some(i => i.severity === 'error'));
  s.phase = 'rebound';
  for (const p of s.players) s.remaining[p.id] = Math.floor(p.stamina * 2 / 3);
  assert.equal(emptyPlan(s).slots, 4);
});

test('all-hold play consumes only time, with no defense reactions or RNG, then expires', () => {
  const initial = createGame({ seed: 123 });
  let s = commitPlan(initial, emptyPlan(initial));
  assert.equal(s.mode, 'executing');
  for (let i = 0; i < 5; i++) {
    s = stepPlay(s); assert.equal(s.possession, 'human');
    assert.deepEqual(s.remaining, initial.remaining);
  }
  s = stepPlay(s);
  assert.equal(s.possession, 'ai'); assert.equal(s.mode, 'planning'); assert.equal(s.rng, initial.rng);
  assert.equal(s.events.filter(e => e.type === 'hold').length, 18);
  assert.equal(s.events.filter(e => e.type === 'defensive-reaction').length, 0);
  assert.ok(s.events.some(e => e.type === 'phase-violation' && e.reason === 'Timeline ended without a shot'));
});

test('invalid whole plans leave live state and RNG intact', () => {
  const s = createGame(), before = structuredClone(s), plan = emptyPlan(s);
  plan.rows['human-1'][0] = { type: 'shoot', athlete: 'human-1' };
  assert.throws(() => commitPlan(s, plan), /will not have the ball/);
  assert.deepEqual(s, before);
  const wrong = emptyPlan(s); wrong.phaseNumber++;
  assert.throws(() => commitPlan(s, wrong), /does not match/);
  const exhausted = emptyPlan(s);
  exhausted.rows['human-2'] = exhausted.rows['human-2'].map(() => ({ type: 'shoot', athlete: 'human-2' }));
  assert.throws(() => commitPlan(s, exhausted), /exceed/);
});

test('same-step duplicate destinations and blocked chains are rejected; teammate swaps work', () => {
  const s = createGame(); s.positions['human-1'] = '-3,4';
  const collision = emptyPlan(s);
  collision.rows['human-0'][0] = { type: 'move', athlete: 'human-0', to: '-2,3' };
  collision.rows['human-1'][0] = { type: 'move', athlete: 'human-1', to: '-2,3' };
  assert.throws(() => commitPlan(s, collision), /same hex/);
  const blocked = emptyPlan(s);
  blocked.rows['human-0'][0] = { type: 'move', athlete: 'human-0', to: '-3,4' };
  assert.throws(() => commitPlan(s, blocked), /not vacating/);
  const swap = emptyPlan(s);
  swap.rows['human-0'][0] = { type: 'move', athlete: 'human-0', to: '-3,4' };
  swap.rows['human-1'][0] = { type: 'move', athlete: 'human-1', to: '-2,4' };
  const next = stepPlay(commitPlan(s, swap));
  assert.equal(next.positions['human-0'], '-3,4'); assert.equal(next.positions['human-1'], '-2,4');
  assert.equal(next.events.filter(e => e.type === 'defensive-reaction').length, 1);
});

test('move, pass and catch-and-shoot resolve in order with one defensive response', () => {
  const s = createGame({ seed: 0 }), plan = emptyPlan(s);
  plan.rows['human-2'][0] = { type: 'move', athlete: 'human-2', to: '2,3' };
  plan.rows['human-0'][0] = { type: 'pass', athlete: 'human-0', to: 'human-1' };
  plan.rows['human-1'][0] = { type: 'shoot', athlete: 'human-1' };
  assert.ok(!validatePlan(s, plan).issues.some(i => i.severity === 'error'));
  const next = stepPlay(commitPlan(s, plan));
  const events = next.events;
  const pass = events.findIndex(e => e.type === 'pass'), reaction = events.findIndex(e => e.type === 'defensive-reaction');
  const shot = events.findIndex(e => e.type === 'shot');
  assert.ok(pass < reaction && reaction < shot);
  assert.equal(events.filter(e => e.type === 'defensive-reaction').length, 1);
  assert.equal(events.find(e => e.type === 'shot')?.athlete, 'human-1');
  assert.notEqual(next.phaseNumber, s.phaseNumber); assert.equal(next.playback, null);
});

test('exhausting the passer does not prematurely end a coordinated play', () => {
  const s = createGame({ seed: 0 }); s.remaining['human-0'] = 1;
  const plan = emptyPlan(s);
  plan.rows['human-0'][0] = { type: 'pass', athlete: 'human-0', to: 'human-1' };
  plan.rows['human-1'][2] = { type: 'shoot', athlete: 'human-1' };
  let next = stepPlay(commitPlan(s, plan));
  assert.equal(next.possession, 'human'); assert.equal(next.remaining['human-0'], 0);
  next = stepPlay(next); assert.equal(next.mode, 'executing');
  next = stepPlay(next); assert.ok(next.events.some(e => e.type === 'shot'));
});

test('committed plans are copied and assignment APIs cannot act during playback', () => {
  const s = createGame(), plan = emptyPlan(s);
  let committed = commitPlan(s, plan);
  plan.rows['human-0'][0] = { type: 'shoot', athlete: 'human-0' };
  assert.equal(committed.playback?.plan.rows['human-0'][0].type, 'hold');
  assert.throws(() => commitPlan(committed, plan), /while planning/);
  assert.throws(() => applyAction(committed, { type: 'shoot', athlete: 'human-0' }), /during playback/);
  committed = stepPlay(committed);
  assert.equal(committed.events.filter(e => e.type === 'shot').length, 0);
});

test('shots cancel later assignments and fresh rebound plans use reduced budgets', () => {
  let found = false;
  for (let seed = 0; seed < 500 && !found; seed++) {
    const s = createGame({ seed }), plan = emptyPlan(s);
    plan.rows['human-0'][0] = { type: 'shoot', athlete: 'human-0' };
    plan.rows['human-1'][4] = { type: 'move', athlete: 'human-1', to: '-5,3' };
    const next = stepPlay(commitPlan(s, plan));
    assert.equal(next.playback, null);
    assert.ok(next.events.some(e => e.type === 'play-ended' && e.cancelledSteps === 5));
    assert.equal(next.events.filter(e => e.type === 'action' && e.athlete === 'human-1').length, 0);
    if (next.phase === 'rebound') {
      assert.equal(emptyPlan(next).slots, 4);
      for (const p of next.players) assert.equal(next.remaining[p.id], Math.floor(p.stamina * 2 / 3));
      found = true;
    }
  }
  assert.ok(found);
});

test('stepping and uninterrupted play produce identical outcomes and AI games terminate', () => {
  function run(seed: number, serialize = false): GameState {
    let s = createGame({ seed });
    for (let i = 0; s.status === 'playing' && i < 1500; i++) {
      if (s.mode === 'planning') s = commitPlan(s, chooseOffensivePlan(s));
      if (serialize) s = JSON.parse(JSON.stringify(s)) as GameState;
      s = stepPlay(s);
      for (const p of s.players) assert.ok(s.remaining[p.id] >= 0 && s.remaining[p.id] <= p.stamina);
    }
    assert.equal(s.status, 'over'); return s;
  }
  for (const seed of [0, 1, 42]) assert.deepEqual(run(seed), run(seed, true));
});

test('interception and failed drive cancel remaining assignments immediately', () => {
  for (const kind of ['pass', 'move'] as const) {
    const s = createGame({ seed: kind === 'pass' ? 1700 : 2000 }), plan = emptyPlan(s);
    plan.rows['human-0'][0] = kind === 'pass' ? { type:'pass', athlete:'human-0', to:'human-1' }
      : { type:'move', athlete:'human-0', to:'-1,3' };
    const next = stepPlay(commitPlan(s, plan));
    assert.equal(next.possession, 'ai'); assert.equal(next.playback, null);
    assert.ok(next.events.some(e => e.type === 'play-ended' && e.cancelledSteps === 5));
    assert.equal(next.events.filter(e => e.type === 'timeline-step').length, 1);
  }
});

test('a winning planned open dunk is guaranteed and ends without another phase', () => {
  const s = createGame();
  s.positions['human-0'] = '0,0'; s.scores.human = 19;
  const plan = emptyPlan(s); plan.rows['human-0'][0] = { type:'shoot', athlete:'human-0' };
  const next = stepPlay(commitPlan(s, plan));
  assert.equal(next.status,'over'); assert.equal(next.mode,'over'); assert.equal(next.scores.human,21);
  assert.equal(next.rng,s.rng); assert.equal(next.phaseNumber,s.phaseNumber);
  assert.throws(()=>stepPlay(next),/No committed play/);
});

function createGame(options: Parameters<typeof randomGame>[0] = {}) {
  const state = randomGame(options);
  Object.assign(state.positions, { 'human-0':'-2,4', 'human-1':'-4,3', 'human-2':'1,3', 'ai-0':'-1,3', 'ai-1':'-3,2', 'ai-2':'1,2' });
  return state;
}
