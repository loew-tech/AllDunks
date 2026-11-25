import type { GameEvent, GameState, HexId } from '../src/types.js';

export interface ActionFrame { state: GameState; text: string; duration: number }

// Reconstruct presentation frames from resolved events without drawing RNG again.
export function actionFrames(before: GameState, events: GameEvent[]): ActionFrame[] {
  const view = structuredClone(before);
  const frames: ActionFrame[] = [];
  let shotTeam = before.possession;
  const push = (text: string, duration: number) => frames.push({ state: structuredClone(view), text, duration });
  for (const e of events) {
    if (e.type === 'action' && (e.actionType === 'move' || e.actionType === 'drive') && e.to)
      view.positions[e.athlete] = e.to as HexId;
    if (e.type === 'defensive-reaction' && 'athlete' in e) view.positions[e.athlete] = e.to;
    if (e.type === 'pass' && e.success) {
      view.ballHolder = e.receiver;
      push('Catch', 400);
    }
    if (e.type === 'shot') {
      view.ballHolder = e.athlete;
      shotTeam = view.players.find(p => p.id === e.athlete)!.team;
      push('Shot', 650);
      push(e.made ? (e.dunk ? 'Bucket · Dunk!' : `Bucket · ${e.points} points`) : 'Miss', 900);
    }
    if (e.type === 'rebound') {
      view.ballHolder = e.athlete;
      const offensive = view.players.find(p => p.id === e.athlete)!.team === shotTeam;
      push(offensive ? 'Offensive rebound' : 'Defensive rebound', 1100);
    }
    if ((e.type === 'pass' && !e.success) || (e.type === 'drive' && !e.success) || e.type === 'phase-violation')
      push('Turnover', 1100);
  }
  return frames;
}
