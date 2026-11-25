import test from 'node:test';
import type { Action, GameState } from '../src/types.js';
import assert from 'node:assert/strict';
import {
  COURT, createGame as randomGame, phaseAllowance, shotPreview, reboundWeights, applyAction,
  legalActions, chooseDefensiveReaction, chooseOffensiveAction, selectStrategy, distance,
} from '../src/engine.js';
import { PLAYER_POOL, defaultRoster } from '../src/roster.js';

const shoot: Action = { type: 'shoot', athlete: 'human-0' };
function rimState() {
  const s = createGame();
  Object.assign(s.positions, { 'human-0': '0,0', 'human-1': '-4,3', 'human-2': '1,3',
    'ai-0': '-2,4', 'ai-1': '-4,0', 'ai-2': '4,0' });
  return s;
}
function outcome(predicate: (state: GameState) => boolean, prepare: () => GameState = () => createGame()) {
  for (let seed = 0; seed < 10000; seed++) {
    const s = prepare(); s.rng = seed;
    const next = applyAction(s, shoot);
    if (predicate(next)) return { s, next };
  }
  throw new Error('Scenario outcome not found');
}

test('court connections are symmetric and distances are shortest paths', () => {
  for (const [hex, neighbors] of (Object.entries(COURT) as [keyof typeof COURT, (keyof typeof COURT)[]][])) {
    for (const neighbor of neighbors) assert.ok(COURT[neighbor].includes(hex));
    assert.equal(distance(hex, hex), 0);
    for (const target of (Object.keys(COURT) as (keyof typeof COURT)[])) assert.equal(distance(hex, target), distance(target, hex));
  }
  assert.equal(distance('-2,4', '0,0'), 4);
});

test('stamina extremes are rare and carry physical tradeoffs', () => {
  const extremes = PLAYER_POOL.filter(p => p.stamina < 4 || p.stamina > 6);
  assert.equal(extremes.length / PLAYER_POOL.length, 0.10);
  assert.ok(defaultRoster().every(p => p.stamina >= 4 && p.stamina <= 6));
  const center = extremes.find(p => p.stamina === 3), guard = extremes.find(p => p.stamina === 7);
  assert.ok(center && guard);
  assert.ok(center.height > guard.height && center.rebounding > guard.rebounding);
  assert.equal(phaseAllowance(3), 3); assert.equal(phaseAllowance(3, 'rebound'), 2);
  assert.equal(phaseAllowance(7), 7); assert.equal(phaseAllowance(7, 'rebound'), 4);
  assert.equal(phaseAllowance(1, 'rebound'), 0);
});

test('invalid rosters reject before game creation', () => {
  const p = defaultRoster(); p[0].stamina = 8;
  assert.throws(() => createGame({ players: p }), /Stamina/);
  p[0].stamina = 6; p[1].id = p[0].id;
  assert.throws(() => createGame({ players: p }), /Unique/);
});

test('open under-rim dunk is guaranteed, spends final move, and consumes no RNG', () => {
  const s = rimState(); s.remaining['human-0'] = 1;
  const snapshot = structuredClone(s), next = applyAction(s, shoot);
  assert.deepEqual(s, snapshot);
  assert.equal(next.rng, s.rng);
  assert.equal(next.scores.human, 2);
  assert.equal(next.possession, 'ai');
  const shot = next.events.find(e => e.type === 'shot');
  assert.ok(shot);
  assert.equal(shot.dunk, true); assert.equal(shot.roll, null);
  assert.equal(next.events.filter(e => e.type === 'defensive-reaction').length, 0);
});

test('defended rim uses finishing, contest and height, even if defender is exhausted', () => {
  const s = rimState(); s.positions['ai-0'] = '-1,1';
  const shooter = s.players[0], defender = s.players[3];
  shooter.finishing = 70; defender.defense = 80;
  shooter.height = defender.height = 195; s.remaining[defender.id] = 0;
  const preview = shotPreview(s);
  assert.equal(preview.dunk, false);
  assert.ok(Math.abs(preview.probability - 0.59) < 1e-10);
  defender.height = 215; shooter.height = 180;
  assert.ok(Math.abs(shotPreview(s).probability - 0.55) < 1e-10);
  defender.height = 180; shooter.height = 215;
  assert.ok(Math.abs(shotPreview(s).probability - 0.63) < 1e-10);
});

test('height changes rebound odds without changing open dunk success', () => {
  const s = rimState(); s.players[0].height = 215; s.players[3].height = 180;
  const weights = reboundWeights(s);
  assert.equal(weights.find(p => p.id === 'human-0')?.heightFactor, 1.2);
  assert.equal(weights.find(p => p.id === 'ai-0')?.heightFactor, 0.85);
  assert.equal(shotPreview(s).probability, 1);
});

test('repeated offensive rebounds preserve positions and reset from normal stamina', () => {
  const prepare = () => {
    const s = createGame();
    s.players.slice(0, 3).forEach((p, i) => { p.stamina = [5, 6, 4][i]; s.remaining[p.id] = 1; });
    return s;
  };
  const { s, next } = outcome(n => n.phase === 'rebound', prepare);
  assert.deepEqual(next.positions, s.positions);
  assert.deepEqual(next.players.slice(0, 3).map(p => next.remaining[p.id]), [3, 4, 2]);
  assert.equal(next.ballHolder, next.events.findLast(e => e.type === 'rebound')!.athlete);
  // Start a subsequent shot at the existing rebounder's position.
  let repeated: GameState | undefined;
  for (let seed = 0; seed < 10000; seed++) {
    const candidate = structuredClone(next); candidate.rng = seed;
    const result = applyAction(candidate, { type: 'shoot', athlete: candidate.ballHolder });
    if (result.phase === 'rebound' && result.phaseNumber === next.phaseNumber + 1) { repeated = result; break; }
  }
  assert.ok(repeated);
  assert.deepEqual(repeated.players.slice(0, 3).map(p => repeated.remaining[p.id]), [3, 4, 2]);
});

test('defensive rebound changes possession, resets positions and restores allowances', () => {
  const { next } = outcome(n => n.events.some(e => e.type === 'possession-change' && e.reason === 'defensive-rebound'));
  assert.equal(next.possession, 'ai'); assert.equal(next.phase, 'normal');
  assert.equal(next.ballHolder, 'ai-0'); assert.equal(next.positions['ai-0'] in COURT, true);
  for (const p of next.players) assert.equal(next.remaining[p.id], p.stamina);
});

test('21 is the win target and overshooting ends immediately', () => {
  const s = rimState(); s.scores.human = 19;
  const win = applyAction(s, shoot);
  assert.equal(win.scores.human, 21); assert.equal(win.status, 'over');
  assert.equal(win.possession, 'human'); assert.deepEqual(legalActions(win), []);
  assert.throws(() => applyAction(win, shoot), /over/);
  const { next } = outcome(n => n.status === 'over', () => {
    const game = createGame(); game.scores.human = 20; return game;
  });
  assert.equal(next.scores.human, 23); assert.equal(next.winner, 'human');
  const below = rimState(); below.scores.human = 11;
  assert.equal(applyAction(below, shoot).status, 'playing');
});

test('invalid actions do not change state or RNG', () => {
  const s = createGame(), snapshot = structuredClone(s);
  for (const action of [
    { type: 'drive', athlete: 'human-0', to: '0,0' },
    { type: 'move', athlete: 'ai-0', to: '-2,4' },
    { type: 'shoot', athlete: 'human-1' },
    { type: 'pass', athlete: 'human-0', to: 'ai-0' },
    { type: 'drive', athlete: 'human-0', to: '-4,3' },
  ] satisfies Action[]) assert.throws(() => applyAction(s, action), /Illegal/);
  assert.deepEqual(s, snapshot);
  s.remaining['human-0'] = 0;
  assert.throws(() => applyAction(s, shoot), /Illegal/);
});

test('passing to exhausted receiver warns, then violates on completion', () => {
  const s = createGame({ seed: 0 }); s.remaining['human-1'] = 0;
  const action = legalActions(s).find(a => a.type === 'pass' && a.to === 'human-1');
  assert.ok(action?.type === 'pass');
  assert.match(action.warning ?? '', /no moves/);
  const next = applyAction(s, action);
  assert.equal(next.events.find(e => e.type === 'pass')?.success, true);
  assert.ok(next.events.some(e => e.type === 'phase-violation'));
  assert.equal(next.possession, 'ai');
});

test('defense closes an open rim within one legal move', () => {
  const s = rimState(); s.positions['ai-0'] = '-2,2';
  const reaction = chooseDefensiveReaction(s);
  assert.ok(reaction);
  assert.ok(['0,0', '-1,1', '0,1'].includes(reaction.to));
  const source = s.positions[reaction.athlete];
  assert.equal(distance(source, reaction.to), 1);
});

test('each setup action permits at most one finite defensive response', () => {
  let s = createGame({ seed: 0 });
  const action = legalActions(s).find(a => a.type === 'move');
  const next = applyAction(s, action);
  const reactions = next.events.filter(e => e.type === 'defensive-reaction');
  assert.equal(reactions.length, 1);
  const spent = s.players.filter(p => p.team === 'ai').reduce((n, p) => n + s.remaining[p.id] - next.remaining[p.id], 0);
  assert.ok(spent === 0 || spent === 1);
  for (const p of s.players.filter(p => p.team === 'ai')) s.remaining[p.id] = 0;
  assert.equal(chooseDefensiveReaction(s), null);
});

test('defense keeps a dangerous shooter covered when helping gains less', () => {
  const s = rimState();
  // A low-finishing ball handler is already covered; moving the wing defender
  // toward the rim would expose a superior perimeter scorer.
  s.positions['ai-0'] = '-1,1'; s.positions['ai-1'] = '-4,3'; s.positions['ai-2'] = '1,3';
  s.players[0].finishing = 0; s.players[1].shooting = 100;
  s.remaining['ai-0'] = 0; s.remaining['ai-2'] = 0;
  const reaction = chooseDefensiveReaction(s);
  assert.ok(reaction === null || distance(reaction.to, '-4,3') <= 1);
});

test('strategy choice is restricted to start of opponent possession', () => {
  const s = createGame(); assert.throws(() => selectStrategy(s, 'protect-paint'));
  const opponent = applyAction(s, { type: 'end-possession' });
  const chosen = selectStrategy(opponent, 'protect-paint');
  assert.equal(chosen.strategy, 'protect-paint');
  assert.throws(() => selectStrategy(opponent, 'nonsense' as never));
  const played = applyAction(chosen, chooseOffensiveAction(chosen));
  if (!played.strategyOpen) assert.throws(() => selectStrategy(played, 'balanced'));
});

test('seeded full games terminate with legal state and reproducible outcomes', () => {
  function run(seed: number) {
    let s = createGame({ seed });
    for (let i = 0; i < 1500 && s.status === 'playing'; i++) {
      const previous = s;
      s = applyAction(s, chooseOffensiveAction(s));
      for (const p of s.players) {
        assert.ok(s.remaining[p.id] >= 0 && s.remaining[p.id] <= p.stamina);
        assert.ok(COURT[s.positions[p.id]]);
      }
      for (const team of ['human', 'ai'] as const) {
        const occupiedHexes = s.players.filter(p => p.team === team).map(p => s.positions[p.id]);
        assert.equal(new Set(occupiedHexes).size, 3);
      }
      assert.ok(s.events.length > previous.events.length);
    }
    assert.equal(s.status, 'over'); assert.ok(s.winner); assert.ok(s.scores[s.winner] >= 21);
    return { scores: s.scores, rng: s.rng, events: s.events };
  }
  for (const seed of [0, 1, 42, 12345]) assert.deepEqual(run(seed), run(seed));
});

function createGame(options: Parameters<typeof randomGame>[0] = {}) {
  const state = randomGame(options);
  Object.assign(state.positions, { 'human-0':'-2,4', 'human-1':'-4,3', 'human-2':'1,3', 'ai-0':'-1,3', 'ai-1':'-3,2', 'ai-2':'1,2' });
  return state;
}
