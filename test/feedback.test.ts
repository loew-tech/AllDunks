import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../web/session.js';
import { stepFeedback, DEFAULT_STEP_DELAY } from '../web/playback-feedback.js';

test('continuous steps publish fresh event reports without requiring acknowledgement', () => {
  const session = new GameSession(); session.commit();
  session.step();
  assert.equal(session.lastStepReport?.step,1);
  assert.equal(session.lastStepReport?.events.filter(e=>e.type==='hold').length,3);
  assert.equal(session.lastStepReport?.complete,false);
  session.step();
  assert.equal(session.lastStepReport?.step,2);
  assert.equal(session.lastStepReport?.events.filter(e=>e.type==='hold').length,3);
  assert.equal(session.state.mode,'executing');
  assert.ok(DEFAULT_STEP_DELAY > 700);
});

test('basket feedback includes outcome and next possession and stays visible at play end', () => {
  const session = new GameSession(42);
  Object.assign(session.state.positions, { 'human-0':'-2,4', 'human-1':'-4,3', 'human-2':'1,3', 'ai-0':'-1,3', 'ai-1':'-3,2', 'ai-2':'1,2' });
  session.assign({type:'shoot',athlete:'human-0'});
  session.commit(); session.step();
  const report = session.lastStepReport; assert.ok(report);
  assert.equal(report.complete,true);
  const feedback = stepFeedback(session.state,report);
  assert.equal(feedback.title,'Basket!');
  assert.ok(feedback.lines.some(l=>l.important && l.text.includes('scores 3 points')));
  assert.ok(feedback.lines.some(l=>l.text.includes('Opponent possession')));
  assert.equal(session.state.mode,'planning');
  session.chooseStrategy('protect-paint');
  assert.ok(session.lastStepReport);
  session.startOpponentPlay(); assert.equal(session.lastStepReport,null);
});

test('expired hold play reports the turnover without blocking the next play', () => {
  const session = new GameSession(); session.commit();
  while(String(session.state.mode)==='executing') session.step();
  assert.ok(session.lastStepReport);
  const feedback=stepFeedback(session.state,session.lastStepReport);
  assert.equal(feedback.title,'Play clock expired');
  assert.ok(feedback.lines.some(l=>l.text.includes('Turnover')));
  assert.equal(session.state.possession,'ai');
  session.startOpponentPlay(); assert.equal(session.state.mode,'executing');
});

test('opponent possession simulates through rebounds and returns control or ends the match', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const session = new GameSession(seed);
    session.commit();
    while (session.state.mode === 'executing') session.step();
    const scoreBefore = session.state.scores.ai;
    session.simulateOpponentPossession();
    assert.ok(session.state.status === 'over' || session.canEdit);
    assert.ok(session.lastOpponentReport?.events.some(e => e.type === 'shot' || e.type === 'phase-violation' || e.type === 'pass' || e.type === 'drive'));
    assert.ok(session.state.scores.ai >= scoreBefore);
    assert.equal(session.lastOpponentReport?.team, 'ai');
    const report = session.lastOpponentReport;
    session.simulateOpponentPossession();
    assert.equal(session.lastOpponentReport, report);
  }
});
