import type { GameEvent, Team } from '../src/types.js';

/** Attribute rebounds/turnovers to the possession in which they happened. */
export function possessionEvents(events: GameEvent[], team: Team): GameEvent[] {
  const owners = new Map<number, Team>();
  for (const e of events) if (e.type === 'phase-start') owners.set(e.phase, e.possession);
  return events.filter(e => owners.get(e.phase) === team);
}
