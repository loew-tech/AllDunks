import { COURT } from './court.js';
import type { GameState, PlannedAction } from './types.js';

/** Shared simultaneous movement policy. Swaps/chains may vacate cells; collisions block. */
export function movementProblems(state: GameState, actions: PlannedAction[]): Map<string, string> {
  const errors = new Map<string, string>();
  const moves = actions.filter((a): a is Extract<PlannedAction, { type: 'move' }> => a.type === 'move');
  for (const a of moves) {
    if (state.remaining[a.athlete] <= 0) errors.set(a.athlete, 'No stamina remains for movement');
    if (!COURT[state.positions[a.athlete]]?.includes(a.to)) errors.set(a.athlete, 'Move must target an adjacent on-court hex');
    if (moves.some(b => b.athlete !== a.athlete && b.to === a.to)) errors.set(a.athlete, 'Two teammates target the same hex');
  }
  // Propagate blockage backwards through a chain without prohibiting cycles/swaps.
  for (let i = 0; i < moves.length; i++) for (const a of moves) {
    const occupant = state.players.find(p => p.team === state.possession && p.id !== a.athlete && state.positions[p.id] === a.to);
    if (occupant && (!moves.some(b => b.athlete === occupant.id) || errors.has(occupant.id)))
      errors.set(a.athlete, 'A teammate is not vacating the destination');
  }
  return errors;
}

