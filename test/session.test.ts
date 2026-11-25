import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../web/session.js';

test('editing and reordering drafts does not move players, consume stamina, or draw RNG', () => {
  const session = new GameSession(), before = structuredClone(session.state);
  session.assign({type:'move',athlete:'human-0',to:'-3,4'});
  session.selectSlot('human-0',0); session.shiftSlot(1);
  assert.equal(session.draft.rows['human-0'][0].type,'hold');
  assert.equal(session.draft.rows['human-0'][1].type,'move');
  assert.deepEqual(session.state,before);
  session.clearSlot(); assert.equal(session.draft.rows['human-0'][1].type,'hold');
  session.clearPlan(); assert.deepEqual(session.state,before);
});

test('commit locks edits, all-hold phase expires, and opponent returns control', () => {
  const session = new GameSession(); session.commit();
  assert.throws(()=>session.clearPlan(),/only be assigned/);
  while(String(session.state.mode)==='executing') session.step();
  assert.equal(session.state.possession,'ai');
  session.chooseStrategy('protect-paint'); session.startOpponentPlay();
  while(String(session.state.mode)==='executing') session.step();
  assert.equal(session.state.mode,'planning');
  assert.equal(session.state.playback,null);
});

test('failed commit preserves draft for correction and new game starts with all holds', () => {
  const session = new GameSession(); session.selectPlayer('human-1');
  session.assign({type:'shoot',athlete:'human-1'});
  assert.throws(()=>session.commit(),/will not have the ball/);
  assert.equal(session.state.mode,'planning');
  session.selectSlot('human-1',0); session.clearSlot(); session.commit();
  assert.equal(session.state.mode,'executing');
  const fresh = new GameSession();
  assert.equal(fresh.state.phaseNumber,1);
  assert.ok(Object.values(fresh.draft.rows).every(row=>row.every(a=>a.type==='hold')));
});
