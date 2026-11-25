import { cellLabel } from '../src/court.js';
import type { GameState } from '../src/types.js';
import type { GameSession, StepReport } from './session.js';

const escape = (v: unknown): string => String(v).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const playIcon = '<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3L21 12L6 21Z" fill="currentColor"/></svg>';
export const pauseIcon = '<svg class="play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3h5v18H5zM14 3h5v18h-5z" fill="currentColor"/></svg>';
export const DEFAULT_STEP_DELAY = 1800;

export function courtPlayButton(session: GameSession, running: boolean): string {
  const s = session.state;
  if (s.status === 'over') return '<button class="play-button" disabled>Game over</button>';
  if (s.mode === 'executing') return `<button class="play-button" data-command="toggle-play">${running ? pauseIcon : playIcon}<span>${running ? 'Pause' : 'Play'}</span></button>`;
  if (s.possession === 'ai') return `<button class="play-button" data-command="run-ai">${playIcon}<span>Play opponent</span></button>`;
  const invalid = session.validation.issues.some(i => i.severity === 'error');
  return `<button class="play-button" data-command="run-plan" ${invalid ? 'disabled' : ''}>${playIcon}<span>Play</span></button>`;
}

export interface FeedbackLine { text: string; important: boolean }
export function stepFeedback(state: GameState, report: StepReport): { title: string; lines: FeedbackLine[] } {
  const name = (id: string) => state.players.find(p => p.id === id)?.name ?? id;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const lines: FeedbackLine[] = [];
  let title = report.complete ? 'Play complete' : 'Step complete';
  const add = (text: string, important = false) => lines.push({ text, important });
  for (const e of report.events) switch (e.type) {
    case 'hold': add(`${name(e.athlete)} holds position.`); break;
    case 'action': if (e.actionType === 'move') add(`${name(e.athlete)} moves to ${cellLabel(e.to as Parameters<typeof cellLabel>[0])}.`); break;
    case 'drive': add(e.success ? `${name(e.athlete)} drives to ${cellLabel(e.to)}.` : `${name(e.athlete)} loses the ball. Turnover.`, !e.success); if (!e.success) title = 'Turnover'; break;
    case 'pass': add(e.success ? `${name(e.athlete)} passes to ${name(e.receiver)}. Complete (${pct(e.probability)} chance).`
      : `${name(e.athlete)}'s pass is intercepted (${pct(e.probability)} completion chance). Turnover.`, true); if (!e.success) title = 'Turnover'; break;
    case 'defensive-reaction': if ('athlete' in e) add(`Defense: ${name(e.athlete)} shifts to ${cellLabel(e.to)}.`); break;
    case 'shot': {
      title = e.made ? (e.dunk ? 'Dunk!' : 'Basket!') : 'Missed shot';
      const coverage = e.contributors.length ? `Contested by ${e.contributors.map(d => name(d.id)).join(', ')}.` : 'Undefended.';
      add(e.dunk ? `${name(e.athlete)} dunks for 2 points. Guaranteed open finish.`
        : `${name(e.athlete)} ${e.made ? `scores ${e.points} points` : `misses the ${e.points}-point shot`}. ${coverage} Actual chance: ${pct(e.probability)}.`, true); break;
    }
    case 'rebound': add(`${name(e.athlete)} gets the ${state.players.find(p => p.id === e.athlete)?.team === report.team ? 'offensive' : 'defensive'} rebound.`, true); break;
    case 'phase-start': add(e.phaseType === 'rebound' ? 'Second chance: new plan, two-thirds stamina rounded down.' : `${e.possession === 'human' ? 'Your' : 'Opponent'} possession. Full moves restored.`, true); break;
    case 'phase-violation': title = 'Play clock expired'; add(`${e.reason ?? 'Phase expired'}. Turnover.`, true); break;
    case 'skipped-action': add(`${name(e.athlete)} cannot act: ${e.reason}.`, true); break;
    case 'play-ended': if (e.cancelledSteps) add(`${e.cancelledSteps} remaining steps cancelled.`); break;
    case 'match-over': title = e.winner === 'human' ? 'You win!' : 'Opponent wins'; add(`Final score: ${e.scores.human}-${e.scores.ai}.`, true); break;
  }
  return { title, lines };
}

export function resultMarkup(session: GameSession): string {
  const opponent = session.lastOpponentReport;
  const summary = opponent ? `<section class="step-results" role="status" aria-live="polite" aria-label="Opponent possession result"><div class="step-results-heading"><strong>Opponent possession simulated</strong><span>Score: ${session.state.scores.human}–${session.state.scores.ai}</span></div><ul>${stepFeedback(session.state, opponent).lines.filter(l => l.important).map(l => `<li class="key-event">${escape(l.text)}</li>`).join('')}</ul></section>` : '';
  if (!session.lastStepReport) return summary;
  const report = session.lastStepReport, feedback = stepFeedback(session.state, report);
  // Put outcomes first so shots and rebounds remain visible without scrolling the log.
  const ordered = [...feedback.lines.filter(l => l.important), ...feedback.lines.filter(l => !l.important)];
  return `${summary}<section class="step-results" role="status" aria-live="polite" aria-atomic="true" aria-label="Play results">
    <div class="step-results-heading"><strong>${escape(feedback.title)}</strong><span>Phase ${report.phaseNumber} · Step ${report.step}${report.complete ? ' · Play ended' : ''}</span></div>
    <ul>${ordered.map(l => `<li class="${l.important ? 'key-event' : ''}">${escape(l.text)}</li>`).join('')}</ul>
  </section>`;
}
