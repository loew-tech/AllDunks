import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, applyAction } from '../src/engine.js';
import { startingPositions } from '../src/formations.js';
import { CELLS, distance, RIM } from '../src/court.js';

test('seeded starts vary while preserving spacing, legal checks and matched coverage', () => {
  const layouts = new Set<string>();
  for (let seed = 0; seed < 300; seed++) {
    const s = createGame({seed});
    assert.deepEqual(s.positions,createGame({seed}).positions);
    assert.equal(s.rng,seed);
    layouts.add(JSON.stringify(s.positions));
    assert.equal(new Set(Object.values(s.positions)).size,6);
    assert.ok(Object.values(s.positions).every(id => CELLS[id]));
    assert.equal(CELLS[s.positions[s.ballHolder]].area,'three');
    const offense = s.players.filter(p => p.team === s.possession).sort((a,b)=>b.height-a.height);
    const defense = s.players.filter(p => p.team !== s.possession).sort((a,b)=>b.height-a.height);
    offense.forEach((p,i)=> {
      assert.ok(distance(s.positions[p.id],RIM)>=2);
      assert.equal(distance(s.positions[p.id],s.positions[defense[i].id]),1);
      offense.slice(i+1).forEach(q=>assert.ok(distance(s.positions[p.id],s.positions[q.id])>=2));
    });
    const later = {...s,phaseNumber:s.phaseNumber+1};
    assert.deepEqual(startingPositions(later),startingPositions(JSON.parse(JSON.stringify(later))));
  }
  assert.ok(layouts.size > 200);
});

test('possession changes generate a new formation; rebound phases preserve positions', () => {
  const s = createGame({seed:42});
  const next = applyAction(s,{type:'end-possession'});
  assert.equal(next.possession,'ai');
  assert.notDeepEqual(next.positions,s.positions);
  assert.equal(new Set(Object.values(next.positions)).size,6);
});

test('randomized starts keep their geometry after an offensive rebound', () => {
  let found = false;
  for (let seed = 0; seed < 100 && !found; seed++) {
    const s = createGame({seed});
    const next = applyAction(s,{type:'shoot',athlete:s.ballHolder});
    if (next.phase === 'rebound') {
      assert.deepEqual(next.positions,s.positions);
      found = true;
    }
  }
  assert.ok(found);
});
