import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../web/session.js';
import { chooseOffensiveAction, legalActions } from '../src/engine.js';

test('manual turn flow: select off-ball player, move, pass and select receiver', () => {
  const session = new GameSession(0);
  session.selectPlayer('human-1');
  const move = legalActions(session.state).find(a => a.type === 'move' && a.athlete === 'human-1');
  assert.ok(move); session.play(move);
  assert.equal(session.selectedId, 'human-1');
  const pass = legalActions(session.state).find(a => a.type === 'pass' && a.to === 'human-1');
  assert.ok(pass); session.play(pass);
  const passed = session.state.events.findLast(e => e.type === 'pass');
  assert.ok(passed?.success);
  assert.equal(session.state.ballHolder, 'human-1');
  assert.equal(session.selectedId, 'human-1');
});

test('opponent is paused for strategy choice, steps legally, and returns control', () => {
  const session = new GameSession(42);
  session.play({ type: 'end-possession' });
  const frozen = structuredClone(session.state);
  assert.equal(session.state.possession, 'ai');
  assert.equal(session.state.strategyOpen, true);
  session.selectPlayer('human-2');
  assert.deepEqual(session.state, frozen);
  session.chooseStrategy('protect-paint');
  assert.throws(() => session.play({ type: 'end-possession' }), /Wait/);
  let steps = 0;
  while (session.state.possession === 'ai' && steps++ < 100) session.nextOpponentAction();
  assert.ok(steps < 100);
  assert.equal(session.state.possession, 'human');
  assert.equal(session.selectedId, session.state.ballHolder);
  assert.throws(() => session.nextOpponentAction(), /not playing/);
});

test('full game through the UI session ends and rejects extra actions; restart clears state', () => {
  const session = new GameSession(42);
  let steps = 0;
  while (session.state.status === 'playing' && steps++ < 1500) {
    if (session.state.possession === 'ai') session.nextOpponentAction();
    else {
      const action = chooseOffensiveAction(session.state);
      assert.ok(action); session.play(action);
    }
  }
  assert.equal(session.state.status, 'over');
  assert.throws(() => session.play({ type: 'end-possession' }));
  assert.throws(() => session.nextOpponentAction());
  const restart = new GameSession(42);
  assert.deepEqual(restart.state.scores, { human: 0, ai: 0 });
  assert.equal(restart.state.phaseNumber, 1);
  assert.equal(restart.selectedId, restart.state.ballHolder);
});
