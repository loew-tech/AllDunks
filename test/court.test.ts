import test from 'node:test';
import assert from 'node:assert/strict';
import { CELLS, COURT, CHECK_POSITIONS, RIM, cell, cellLabel, distance,
  hexDistance, hexKey, neighbors, parseHex } from '../src/court.js';
import { THREE_RADIUS, hexToPixel } from '../web/court-view.js';
import type { HexId } from '../src/court.js';
import { applyAction, createGame, legalActions, shotPreview } from '../src/engine.js';

test('finite hex board has symmetric neighbors, six interior directions, and no off-court targets', () => {
  assert.equal(Object.keys(CELLS).length, 60);
  assert.equal(neighbors('-1,3').length, 6);
  for (const c of Object.values(CELLS)) {
    assert.deepEqual(parseHex(c.id), { q: c.q, r: c.r });
    assert.equal(hexKey(c), c.id);
    for (const next of neighbors(c.id)) {
      assert.ok(CELLS[next]); assert.ok(neighbors(next).includes(c.id));
      assert.equal(hexDistance(c, cell(next)), 1);
    }
    const p = hexToPixel(c);
    assert.ok(p.x > 78 && p.x < 822 && p.y >= 120 && p.y <= 570);
  }
  assert.throws(() => cell('99,99'), /outside/);
  assert.throws(() => distance('99,99', RIM), /outside/);
  assert.throws(() => parseHex('bad' as HexId), /Invalid/);
  assert.throws(() => parseHex('1.5,2' as HexId), /Invalid/);
});

test('cube distance equals independent shortest path for every pair of playable cells', () => {
  for (const origin of Object.values(CELLS)) {
    const queue: HexId[] = [origin.id];
    const steps = new Map<HexId, number>([[origin.id, 0]]);
    for (let i = 0; i < queue.length; i++) {
      for (const target of COURT[queue[i]]) if (!steps.has(target)) {
        steps.set(target, steps.get(queue[i])! + 1); queue.push(target);
      }
    }
    assert.equal(steps.size, Object.keys(CELLS).length);
    for (const [target, expected] of steps) assert.equal(distance(origin.id, target), expected);
  }
});

test('scoring comes from cell centers, check positions are valid, and only rim origin can dunk', () => {
  const s = createGame();
  for (const id of [...CHECK_POSITIONS.offense, ...CHECK_POSITIONS.defense]) assert.ok(cell(id));
  assert.equal(new Set([...CHECK_POSITIONS.offense, ...CHECK_POSITIONS.defense]).size, 6);
  assert.ok(CHECK_POSITIONS.offense.every(id => cell(id).area === 'three'));
  assert.equal(distance(CHECK_POSITIONS.offense[0], RIM), 4);
  for (const c of Object.values(CELLS)) {
    const p = hexToPixel(c), rim = hexToPixel(cell(RIM));
    const outside = (p.x - rim.x) ** 2 + (p.y - rim.y) ** 2 > THREE_RADIUS ** 2;
    assert.equal(c.area === 'three', outside);
    assert.equal(c.underRim, c.id === RIM);
    s.positions['human-0'] = c.id;
    const preview = shotPreview(s);
    assert.equal(preview.points, outside ? 3 : 2);
    if (preview.dunk) assert.equal(c.id, RIM);
    assert.ok(cellLabel(c.id).includes(`(${c.q}, ${c.r})`));
  }
});

test('runtime off-court and multi-hex movement are rejected without consuming state or RNG', () => {
  const s = createGame(), before = structuredClone(s);
  for (const to of ['99,99', RIM] as HexId[])
    assert.throws(() => applyAction(s, { type: 'drive', athlete: s.ballHolder, to }), /Illegal/);
  assert.deepEqual(s, before);
  for (const p of s.players.filter(p => p.team === 'human')) {
    for (const a of legalActions(s)) if ((a.type === 'move' || a.type === 'drive') && a.athlete === p.id)
      assert.equal(distance(s.positions[p.id], a.to), 1);
  }
});

test('a normal-stamina ball handler can reach the rim and afford a shot in one phase', () => {
  const path: HexId[] = ['-2,3', '-1,2', '-1,1', RIM];
  let completed = false;
  for (let seed = 0; seed < 100 && !completed; seed++) {
    let s = createGame({ seed });
    Object.assign(s.positions, { 'human-0':'-2,4', 'human-1':'-4,3', 'human-2':'1,3', 'ai-0':'-1,3', 'ai-1':'-3,2', 'ai-2':'1,2' });
    for (const p of s.players.filter(p => p.team === 'ai')) s.remaining[p.id] = 0;
    for (const to of path) {
      s = applyAction(s, { type: 'drive', athlete: 'human-0', to });
      if (s.possession !== 'human') break;
    }
    if (s.possession !== 'human') continue;
    assert.equal(s.positions['human-0'], RIM);
    assert.equal(s.remaining['human-0'], 2);
    assert.equal(shotPreview(s).dunk, true);
    const result = applyAction(s, { type: 'shoot', athlete: 'human-0' });
    assert.equal(result.scores.human, 2); completed = true;
  }
  assert.ok(completed);
});
