import { createGame, selectStrategy } from '../src/engine.js';
import { emptyPlan, validatePlan, commitPlan, stepPlay, chooseOffensivePlan } from '../src/plans.js';
import type { GameState, PlannedAction, PlayPlan, Strategy } from '../src/types.js';

export class GameSession {
  state: GameState;
  selectedId: string;
  selectedStep = 0;
  draft: PlayPlan;

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
    this.selectedId = id;
  }

  selectSlot(id: string, step: number): void {
    this.assertEditable(); this.selectPlayer(id);
    if (!Number.isInteger(step) || step < 0 || step >= this.draft.slots) throw new Error('Unknown timeline step');
    this.selectedStep = step;
  }

  assign(action: PlannedAction): void {
    this.assertEditable();
    if (action.athlete !== this.selectedId) throw new Error('Assignment must belong to selected player');
    this.draft.rows[this.selectedId][this.selectedStep] = structuredClone(action);
    this.selectedStep = Math.min(this.draft.slots - 1, this.selectedStep + 1);
  }

  clearSlot(): void {
    this.assertEditable();
    this.draft.rows[this.selectedId][this.selectedStep] = { type: 'hold', athlete: this.selectedId };
  }
  clearPlan(): void { this.assertEditable(); this.draft = emptyPlan(this.state); this.selectedStep = 0; }

  shiftSlot(direction: -1 | 1): void {
    this.assertEditable(); const next = this.selectedStep + direction;
    if (next < 0 || next >= this.draft.slots) return;
    const row = this.draft.rows[this.selectedId];
    [row[this.selectedStep], row[next]] = [row[next], row[this.selectedStep]];
    this.selectedStep = next;
  }

  commit(): void { this.assertEditable(); this.state = commitPlan(this.state, this.draft); this.selectedStep = 0; }
  chooseStrategy(strategy: Strategy): void { this.state = selectStrategy(this.state, strategy); }

  startOpponentPlay(): void {
    if (this.state.possession !== 'ai' || this.state.mode !== 'planning') throw new Error('Opponent is not planning');
    this.state = commitPlan(this.state, chooseOffensivePlan(this.state));
  }

  step(): void {
    this.state = stepPlay(this.state);
    if (this.state.mode === 'planning') {
      this.draft = emptyPlan(this.state); this.selectedStep = 0;
      if (this.state.possession === 'human') this.selectedId = this.state.ballHolder;
    }
  }

  private assertEditable(): void { if (!this.canEdit) throw new Error('Actions can only be assigned during your planning phase'); }
}
