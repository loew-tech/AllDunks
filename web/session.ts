import { createGame, selectStrategy } from '../src/engine.js';
import { emptyPlan, validatePlan, commitPlan, stepPlay, chooseOffensivePlan } from '../src/plans.js';
import type { GameEvent, GameState, PlannedAction, PlayPlan, Strategy, Team } from '../src/types.js';

export interface StepReport { step: number; phaseNumber: number; team: Team; complete: boolean; events: GameEvent[] }

export class GameSession {
  state: GameState;
  selectedId: string;
  selectedStep = 0;
  cycleComplete = false;
  draft: PlayPlan;
  lastStepReport: StepReport | null = null;
  lastOpponentReport: StepReport | null = null;

  constructor(seed = 42) {
    this.state = createGame({ seed });
    this.selectedId = this.state.ballHolder;
    this.draft = emptyPlan(this.state);
  }

  get canEdit(): boolean { return this.state.mode === 'planning' && this.state.possession === 'human' && this.state.status === 'playing'; }
  get validation() { return validatePlan(this.state, this.draft); }
  get preview(): GameState { return this.canEdit ? this.validation.snapshots[this.selectedStep] ?? this.state : this.state; }

  selectPlayer(id: string): void {
    if (!this.state.players.some(p => p.id === id && p.team === 'human')) throw new Error('Select one of your players');
    this.selectedId = id; this.cycleComplete = false;
  }

  selectSlot(id: string, step: number): void {
    this.assertEditable(); this.selectPlayer(id);
    if (!Number.isInteger(step) || step < 0 || step >= this.draft.slots) throw new Error('Unknown timeline step');
    this.selectedStep = step;
  }

  assign(action: PlannedAction): void {
    this.assertEditable();
    if (action.athlete !== this.selectedId) throw new Error('Assignment must belong to selected player');
    this.lastStepReport = null;
    this.lastOpponentReport = null;
    this.draft.rows[this.selectedId][this.selectedStep] = structuredClone(action);
    const players = this.state.players.filter(p => p.team === 'human');
    const index = players.findIndex(p => p.id === this.selectedId);
    if (index < players.length - 1) this.selectedId = players[index + 1].id;
    else if (this.selectedStep < this.draft.slots - 1) {
      this.selectedId = players[0].id; this.selectedStep++;
    } else this.cycleComplete = true;
  }

  clearSlot(): void {
    this.assertEditable();
    this.draft.rows[this.selectedId][this.selectedStep] = { type: 'hold', athlete: this.selectedId };
  }
  clearPlan(): void { this.assertEditable(); this.draft = emptyPlan(this.state); this.selectedStep = 0; this.cycleComplete = false; this.selectedId = this.state.players.find(p => p.team === 'human')!.id; }

  shiftSlot(direction: -1 | 1): void {
    this.assertEditable(); const next = this.selectedStep + direction;
    if (next < 0 || next >= this.draft.slots) return;
    const row = this.draft.rows[this.selectedId];
    [row[this.selectedStep], row[next]] = [row[next], row[this.selectedStep]];
    this.selectedStep = next;
  }

  commit(): void { this.assertEditable(); this.state = commitPlan(this.state, this.draft); this.selectedStep = 0; this.lastStepReport = null; }
  chooseStrategy(strategy: Strategy): void { this.state = selectStrategy(this.state, strategy); }

  startOpponentPlay(): void {
    if (this.state.possession !== 'ai' || this.state.mode !== 'planning') throw new Error('Opponent is not planning');
    this.state = commitPlan(this.state, chooseOffensivePlan(this.state));
    this.lastStepReport = null;
  }

  simulateOpponentPossession(): void {
    if (this.state.status !== 'playing' || this.state.possession !== 'ai') return;
    const before = this.state;
    let steps = 0;
    while (this.state.status === 'playing' && this.state.possession === 'ai') {
      if (++steps > 1000) throw new Error('Opponent simulation exceeded its step limit');
      if (this.state.mode === 'planning') this.startOpponentPlay();
      this.step();
    }
    this.lastOpponentReport = { step: steps, phaseNumber: before.phaseNumber,
      team: 'ai', complete: true, events: this.state.events.slice(before.events.length) };
  }

  step(): void {
    const before = this.state;
    this.state = stepPlay(this.state);
    this.lastStepReport = { step: (before.playback?.cursor ?? 0) + 1, phaseNumber: before.phaseNumber,
      team: before.possession, complete: this.state.mode !== 'executing', events: this.state.events.slice(before.events.length) };
    if (this.state.mode === 'planning') {
      this.draft = emptyPlan(this.state); this.selectedStep = 0; this.cycleComplete = false;
      if (this.state.possession === 'human') this.selectedId = this.state.players.find(p => p.team === 'human')!.id;
    }
  }

  private assertEditable(): void { if (!this.canEdit) throw new Error('Actions can only be assigned during your planning phase'); }
}
