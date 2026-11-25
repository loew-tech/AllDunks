import test from 'node:test';
import assert from 'node:assert/strict';
import { possessionEvents } from '../web/possession-log.js';
import { createGame, applyAction } from '../src/engine.js';

test('possession tabs keep turnover events with the offense and next phase with its team', () => {
  const state = createGame();
  const next = applyAction(state,{type:'end-possession'});
  const own = possessionEvents(next.events,'human');
  const opponent = possessionEvents(next.events,'ai');
  assert.ok(own.some(e=>e.type==='possession-change'));
  assert.ok(opponent.some(e=>e.type==='phase-start' && e.possession==='ai'));
  assert.ok(!opponent.some(e=>e.type==='possession-change'));
  assert.equal(own.length+opponent.length,next.events.length);
});
