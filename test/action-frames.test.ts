import test from 'node:test';
import assert from 'node:assert/strict';
import { GameSession } from '../web/session.js';
import { actionFrames } from '../web/action-frames.js';

test('catch and shoot shows receiver holding the ball before shot and outcome', () => {
  const session = new GameSession();
  const before = session.state;
  const frames = actionFrames(before, [
    { type: 'pass', phase: 1, athlete: 'human-0', receiver: 'human-1', success: true, probability: .8, roll: .1 },
    { type: 'shot', phase: 1, athlete: 'human-1', kind: 'three', dunk: false, points: 3, baseChance: .5, probability: .5, contributors: [], roll: .1, made: true },
  ]);
  assert.deepEqual(frames.map(f => f.text), ['Catch', 'Shot', 'Bucket · 3 points']);
  assert.equal(frames[0].state.ballHolder, 'human-1');
  assert.ok(frames[0].duration >= 100);
  assert.equal(before.ballHolder, 'human-0');
});

test('miss and rebound popups distinguish offensive and defensive rebounds', () => {
  const before = new GameSession().state;
  for (const [athlete, text] of [['human-1', 'Offensive rebound'], ['ai-1', 'Defensive rebound']]) {
    const frames = actionFrames(before, [{ type: 'rebound', phase: 1, athlete, roll: .2, weights: [] }]);
    assert.equal(frames[0].text, text);
    assert.equal(frames[0].state.ballHolder, athlete);
  }
  const frames = actionFrames(before, [{type:'phase-violation',phase:1,athlete:'human-0',reason:'Expired'}]);
  assert.equal(frames[0].text, 'Turnover');
});
