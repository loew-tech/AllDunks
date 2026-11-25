import { movementProblems } from './movement.js';
import { applyPlannedStep, chooseOffensiveAction, expirePlannedPhase } from './engine.js';
import type { GameState, HexId, PlannedAction, PlayPlan } from './types.js';

export interface PlanIssue { severity: 'error' | 'warning'; athlete: string; step: number; message: string }
export interface PlanValidation { issues: PlanIssue[]; snapshots: GameState[] }

export function emptyPlan(state: GameState): PlayPlan {
  const players = state.players.filter(p => p.team === state.possession);
  const slots = Math.max(...players.map(p => state.remaining[p.id]));
  return { team: state.possession, phaseNumber: state.phaseNumber, slots,
    rows: Object.fromEntries(players.map(p => [p.id, Array.from({ length: slots }, () => ({ type: 'hold' as const, athlete: p.id }))])) };
}

/** Optimistic projection: no RNG, defender movement, or mutation of live state. */
export function validatePlan(state: GameState, plan: PlayPlan): PlanValidation {
  const issues: PlanIssue[] = [];
  const report = (athlete: string, step: number, message: string, severity: 'error' | 'warning' = 'error') =>
    issues.push({ athlete, step, message, severity });
  const expected = emptyPlan(state);
  if (!plan || plan.team !== state.possession || plan.phaseNumber !== state.phaseNumber || plan.slots !== expected.slots
    || !plan.rows || Object.keys(plan.rows).length !== 3) {
    report('', 0, 'Plan does not match the current team, phase, or timeline length');
    return { issues, snapshots: [structuredClone(state)] };
  }
  for (const id of Object.keys(expected.rows)) {
    const row = plan.rows[id];
    if (!Array.isArray(row) || row.length !== plan.slots) { report(id, 0, 'Each player needs exactly S slots'); continue; }
    let active = 0;
    for (let step = 0; step < row.length; step++) {
      const a = row[step];
      if (!a || a.athlete !== id || !['hold', 'move', 'pass', 'shoot'].includes(a.type)) report(id, step, 'Invalid assignment');
      else if (a.type !== 'hold') active++;
    }
    if (active > state.remaining[id]) report(id, 0, `${active} active actions exceed the ${state.remaining[id]}-move budget`);
  }
  if (issues.length) return { issues, snapshots: [structuredClone(state)] };
  let projected = structuredClone(state), terminal = false;
  const snapshots = [structuredClone(projected)];
  for (let step = 0; step < plan.slots; step++) {
    const actions = Object.keys(expected.rows).map(id => plan.rows[id][step]);
    if (terminal) {
      for (const a of actions) if (a.type !== 'hold') report(a.athlete, step, 'This assignment will be cancelled after the shot', 'warning');
      snapshots.push(structuredClone(projected)); continue;
    }
    const blocked = movementProblems(projected, actions);
    for (const [id, reason] of blocked) report(id, step, reason);
    for (const a of actions) if (a.type === 'move' && !blocked.has(a.athlete)) projected.positions[a.athlete] = a.to;
    const startHolder = projected.ballHolder;
    for (const a of actions) if (a.type === 'pass') {
      if (a.athlete !== startHolder) report(a.athlete, step, 'Only the ball holder at the start of this step can pass');
      else if (!Object.hasOwn(expected.rows, a.to) || a.to === a.athlete) report(a.athlete, step, 'Pass must target a teammate');
      else projected.ballHolder = a.to;
    }
    for (const a of actions) {
      if (a.type !== 'hold') projected.remaining[a.athlete]--;
      if (a.type === 'shoot') {
        if (a.athlete !== projected.ballHolder) report(a.athlete, step, 'Shooter will not have the ball after this step’s pass');
        else terminal = true;
      }
    }
    snapshots.push(structuredClone(projected));
  }
  if (!terminal) report('', Math.max(0, plan.slots - 1), 'No shot scheduled; the play will expire as a turnover', 'warning');
  return { issues, snapshots };
}

export function commitPlan(state: GameState, plan: PlayPlan): GameState {
  if (state.status !== 'playing' || state.mode !== 'planning') throw new Error('Plans can only be committed while planning');
  const errors = validatePlan(state, plan).issues.filter(i => i.severity === 'error');
  if (errors.length) throw new Error(errors.map(i => `Step ${i.step + 1}: ${i.message}`).join('; '));
  const next = structuredClone(state);
  next.mode = 'executing'; next.strategyOpen = false;
  next.playback = { plan: structuredClone(plan), cursor: 0 };
  next.events.push({ type: 'play-committed', phase: next.phaseNumber, team: plan.team, slots: plan.slots });
  return next;
}

export function stepPlay(state: GameState): GameState {
  if (state.mode !== 'executing' || !state.playback || state.status !== 'playing') throw new Error('No committed play to execute');
  const { plan, cursor } = state.playback;
  const actions = Object.values(plan.rows).map(row => row[cursor]);
  let next = plan.slots ? applyPlannedStep(state, actions, cursor) : expirePlannedPhase(state);
  if (next.status === 'over' || next.phaseNumber !== state.phaseNumber) {
    next.events.push({ type: 'play-ended', phase: next.phaseNumber, reason: next.status === 'over' ? 'game-over' : 'shot-or-turnover',
      cancelledSteps: Math.max(0, plan.slots - cursor - 1) });
  } else if (cursor + 1 >= plan.slots) {
    next = expirePlannedPhase(next);
    next.events.push({ type: 'play-ended', phase: next.phaseNumber, reason: 'timeline-exhausted', cancelledSteps: 0 });
  } else {
    next.playback = { plan: structuredClone(plan), cursor: cursor + 1 };
  }
  return next;
}

export function chooseOffensivePlan(state: GameState): PlayPlan {
  const plan = emptyPlan(state);
  for (let step = 0; step < plan.slots; step++) {
    const before = validatePlan(state, plan).snapshots[step];
    const action = chooseOffensiveAction(before);
    if (!action || action.type === 'end-possession') break;
    const assignment: PlannedAction = action.type === 'drive' || action.type === 'move'
      ? { type: 'move', athlete: action.athlete, to: action.to as HexId }
      : action.type === 'pass' ? { type: 'pass', athlete: action.athlete, to: action.to }
      : { type: 'shoot', athlete: action.athlete };
    plan.rows[assignment.athlete][step] = assignment;
    if (assignment.type === 'shoot') break;
  }
  return plan;
}
