import { CELLS, RIM, distance, neighbors } from './court.js';
import type { GameState, HexId } from './types.js';

/** Separate seeded stream: formation variety does not consume shot/pass rolls. */
export function startingPositions(state: GameState): Record<string, HexId> {
  let seed = (state.rng ^ Math.imul(state.phaseNumber, 0x9e3779b9)) >>> 0;
  const random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
  const positions: Record<string, HexId> = {};
  const occupied = new Set<HexId>();
  const pick = (options: {id: HexId; weight: number}[]) => {
    let roll = random() * options.reduce((sum, c) => sum + c.weight, 0);
    for (const c of options) { roll -= c.weight; if (roll < 0) return c.id; }
    if (!options.length) throw new Error('No legal starting position');
    return options.at(-1)!.id;
  };
  const place = (id: string, options: {id: HexId; weight: number}[]) => {
    const spot = pick(options.filter(c => !occupied.has(c.id)));
    occupied.add(spot); positions[id] = spot;
  };
  const offense = state.players.filter(p => p.team === state.possession);
  const defense = state.players.filter(p => p.team !== state.possession);
  const court = Object.values(CELLS);
  // Check the ball near the top of the arc; favor central, reachable positions.
  place(offense[0].id, court.filter(c => c.area === 'three' && c.r >= 3 && c.r <= 4 && Math.abs(c.q+c.r/2) <= 1.5)
    .map(c => ({id:c.id, weight: 5 / (1 + Math.abs(c.q+c.r/2))})));
  for (const player of offense.slice(1)) {
    const big = player.height >= 202 && player.finishing > player.shooting;
    const teammates = Object.values(positions);
    place(player.id, court.filter(c => c.r >= 1 && c.r <= 4 && distance(c.id,RIM) >= 2 && teammates.every(id => distance(id,c.id) >= 2))
      .map(c => {
        const x = c.q+c.r/2;
        const oppositeSide = teammates.some(id => (CELLS[id].q+CELLS[id].r/2)*x > 0.5) ? 0.35 : 1.8;
        const role = big ? (c.paint ? 7 : c.area === 'midrange' ? 4 : 1) : (c.area === 'three' ? 6 : 2);
        return {id:c.id,weight:role * oppositeSide / (1+Math.max(0,Math.abs(x)-3))};
      }));
  }
  // Match height to height, and prefer guarding between each assignment and rim.
  const attackers = [...offense].sort((a,b) => b.height-a.height);
  const defenders = [...defense].sort((a,b) => b.height-a.height);
  defenders.forEach((player,i) => {
    const target = positions[attackers[i].id];
    place(player.id, neighbors(target).map(id => ({id,weight:distance(id,RIM)<distance(target,RIM)?6:1})));
  });
  return positions;
}
