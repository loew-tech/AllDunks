import { commitPlan, stepPlay, chooseOffensivePlan } from '../src/plans.js';
import type { Player } from '../src/types.js';
import { createGame } from '../src/engine.js';
import { defaultRoster, PLAYER_POOL } from '../src/roster.js';

const count = Number(process.argv[2] ?? 30);
if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Game count must be 1–1000');

function simulate(seed: number, players: Player[]) {
  let state = createGame({ seed, players });
  let actions = 0;
  while (state.status === 'playing' && actions < 2000) {
    if (state.mode === 'planning') state = commitPlan(state, chooseOffensivePlan(state));
    state = stepPlay(state); actions++;
  }
  if (state.status !== 'over') throw new Error(`Game failed to finish: seed ${seed}`);
  const shots = state.events.filter(e => e.type === 'shot');
  return {
    winner: state.winner, actions,
    quality: shots.reduce((sum, shot) => sum + shot.probability, 0) / shots.length,
    rebounds: state.events.filter(e => e.type === 'rebound').length,
    spentMoves: state.events.reduce((sum, e) => sum + ('cost' in e ? e.cost : 0), 0),
  };
}

// Swap entire lineups to expose first-possession bias instead of conflating it
// with player strength. Each lineup contains only one rare athlete in this stress test.
for (const variant of ['default', 'rare-lineups']) {
  const totals = { games: count * 2, humanWins: 0, actions: 0, quality: 0, rebounds: 0, spentMoves: 0 };
  for (let seed = 0; seed < count; seed++) for (const mirror of [false, true]) {
    const players = defaultRoster();
    if (variant === 'rare-lineups') {
      Object.assign(players[2], PLAYER_POOL.find(p => p.stamina === 3));
      Object.assign(players[3], PLAYER_POOL.find(p => p.stamina === 7));
    }
    if (mirror) for (const p of players) p.team = p.team === 'human' ? 'ai' : 'human';
    const result = simulate(seed, players);
    totals.humanWins += result.winner === 'human' ? 1 : 0;
    for (const key of ['actions', 'quality', 'rebounds', 'spentMoves'] as const) totals[key] += result[key];
  }
  console.log(JSON.stringify({ variant, games: totals.games, humanWins: totals.humanWins,
    averageSteps: totals.actions / totals.games, averageShotQuality: totals.quality / totals.games,
    averageRebounds: totals.rebounds / totals.games, averageSpentMoves: totals.spentMoves / totals.games }));
}
