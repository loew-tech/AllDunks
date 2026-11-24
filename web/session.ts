import { applyAction, chooseOffensiveAction, createGame, selectStrategy } from '../src/engine.js';
import type { Action, GameState, Strategy } from '../src/types.js';

/** UI turn boundary: opponent actions are advanced explicitly, never on render. */
export class GameSession {
  state: GameState;
  selectedId: string;

  constructor(seed = 42) {
    this.state = createGame({ seed });
    this.selectedId = this.state.ballHolder;
  }

  selectPlayer(id: string): void {
    if (!this.state.players.some(p => p.id === id && p.team === 'human')) throw new Error('Select one of your players');
    this.selectedId = id;
  }

  play(action: Action): void {
    if (this.state.possession !== 'human') throw new Error('Wait for your possession');
    this.advance(action);
  }

  chooseStrategy(strategy: Strategy): void {
    this.state = selectStrategy(this.state, strategy);
  }

  nextOpponentAction(): void {
    if (this.state.possession !== 'ai' || this.state.status !== 'playing') throw new Error('Opponent is not playing');
    const action = chooseOffensiveAction(this.state);
    if (!action) throw new Error('No opponent action available');
    this.advance(action);
  }

  private advance(action: Action): void {
    const before = this.state;
    this.state = applyAction(before, action);
    if (this.state.possession === 'human'
      && (before.possession !== 'human' || before.ballHolder !== this.state.ballHolder)) {
      this.selectedId = this.state.ballHolder;
    }
  }
}
