import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession as RandomSession } from '../web/session.js';

class GameSession extends RandomSession {
  constructor() {
    super();
    Object.assign(this.state.positions, { 'human-0':'-2,4', 'human-1':'-4,3', 'human-2':'1,3', 'ai-0':'-1,3', 'ai-1':'-3,2', 'ai-2':'1,2' });
  }
}

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

test('assignments cycle teammates within a step before advancing time', () => {
  const session = new GameSession(), before = structuredClone(session.state);
  session.assign({type:'hold',athlete:'human-0'});
  assert.equal(session.selectedId,'human-1'); assert.equal(session.selectedStep,0);
  session.assign({type:'move',athlete:'human-1',to:'-5,3'});
  assert.equal(session.selectedId,'human-2'); assert.equal(session.selectedStep,0);
  session.assign({type:'hold',athlete:'human-2'});
  assert.equal(session.selectedId,'human-0'); assert.equal(session.selectedStep,1);
  assert.equal(session.preview.positions['human-1'],'-5,3');
  assert.deepEqual(session.state,before);
});

test('holding through the whole timeline ends at the final slot without wrapping', () => {
  const session = new GameSession(), before = structuredClone(session.state);
  for (let turn=0;turn<18;turn++) {
    assert.equal(session.selectedId,`human-${turn%3}`);
    assert.equal(session.selectedStep,Math.floor(turn/3));
    assert.equal(session.cycleComplete,false);
    session.assign({type:'hold',athlete:session.selectedId});
  }
  assert.equal(session.cycleComplete,true);
  assert.equal(session.selectedId,'human-2'); assert.equal(session.selectedStep,5);
  assert.deepEqual(session.state,before);
  assert.ok(Object.values(session.draft.rows).every(row=>row.every(a=>a.type==='hold')));
  session.commit(); assert.equal(session.state.mode,'executing');
});

test('manual timeline edits resume cycling locally and clear resets the first player', () => {
  const session = new GameSession();
  session.selectSlot('human-1',2);
  session.assign({type:'hold',athlete:'human-1'});
  assert.equal(session.selectedId,'human-2'); assert.equal(session.selectedStep,2);
  session.assign({type:'hold',athlete:'human-2'});
  assert.equal(session.selectedId,'human-0'); assert.equal(session.selectedStep,3);
  session.clearPlan();
  assert.equal(session.selectedId,'human-0'); assert.equal(session.selectedStep,0);
  assert.equal(session.cycleComplete,false);
});

