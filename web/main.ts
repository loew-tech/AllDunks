import { possessionEvents } from './possession-log.js';
import { actionFrames } from './action-frames.js';
import type { GameState } from '../src/types.js';
import { courtPlayButton, stepFeedback, DEFAULT_STEP_DELAY } from './playback-feedback.js';
import { assignmentOptions, controlsMarkup, timelineMarkup, strategyNames, escape } from './planner-controls.js';
import type { PlannedAction, GameEvent, Strategy, HexId } from '../src/types.js';
import { CELLS, cellLabel, distance } from '../src/court.js';
import { hexToPixel, polygonPoints, THREE_RADIUS } from './court-view.js';
import { GameSession } from './session.js';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing game root');
const root = app;
let session = new GameSession();
let running = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let error = '';
let seed = 42;
let speed = 1;
let visualState: GameState | null = null;
let popup = '';
let animating = false;
let animationVersion = 0;
let commentaryTab: 'human' | 'ai' = 'human';
const commentaryScroll = { human: 0, ai: 0 };

const cells = Object.fromEntries(Object.values(CELLS).map(c => [c.id, {
  ...hexToPixel(c), name: cellLabel(c.id), short: `${c.q},${c.r}`,
}])) as Record<HexId, { x: number; y: number; name: string; short: string }>;
const percent = (value: number) => `${Math.round(value * 100)}%`;
const playerName = (id: string) => escape(session.state.players.find(p => p.id === id)?.name ?? id);
const isHumanTurn = () => session.canEdit;

function courtMarkup(actions: PlannedAction[]): string {
  const s = visualState ?? session.preview;
  const moves = actions.filter((a): a is Extract<PlannedAction, {type:'move'}> => a.type === 'move' && a.athlete === session.selectedId);
  const available = new Set(moves.map(a => a.to));
  const targets = Object.values(CELLS).map(c => {
    const legal = isHumanTurn() && available.has(c.id);
    const center = cells[c.id];
    const selected = s.positions[session.selectedId] === c.id;
    const defenders = s.players.filter(p => p.team !== s.possession && distance(s.positions[p.id], c.id) <= 1).length;
    const occupied = Object.values(s.positions).includes(c.id);
    return `<g class="hex-cell ${c.area} ${c.paint ? 'paint' : ''} ${c.underRim ? 'under-rim' : ''} ${legal ? 'available' : ''} ${selected ? 'selected-cell' : ''} ${selected && session.canEdit ? 'active-planner' : ''} ${occupied ? 'occupied' : ''}"
      ${legal ? `role="button" tabindex="0" data-hex="${c.id}" aria-label="Move to ${center.name}, one move${defenders ? ', defended' : ', undefended'}"` : ''}>
      <title>${center.name} · ${c.area === 'three' ? '3 points' : '2 points'}${c.underRim ? ' · open dunk eligible' : ''} · ${defenders} defenders in range</title>
      <polygon points="${polygonPoints(c.id)}"/>
      <text class="hex-coordinate" text-anchor="middle" x="${center.x}" y="${center.y + 31}">${center.short}</text>
      ${legal ? `<text class="hex-cost" text-anchor="middle" x="${center.x}" y="${center.y + 5}">1</text>` : ''}
      ${legal && defenders ? `<circle class="coverage-marker" cx="${center.x + 24}" cy="${center.y - 20}" r="5"/>` : ''}
    </g>`;
  }).join('');
  const routes = session.canEdit ? s.players.filter(p => p.team === 'human').map(p => {
    const snapshots = session.validation.snapshots;
    const points = snapshots.map(v => cells[v.positions[p.id]]).map(c => `${c.x},${c.y}`).join(' ');
    return `<polyline class="planned-route" points="${points}"/>`;
  }).join('') : '';
  const tokens = s.players.map((p, i) => {
    const z = cells[s.positions[p.id]];
    const shared = s.players.some(other => other.id !== p.id && s.positions[other.id] === s.positions[p.id]);
    const offset = shared ? (p.team === 'human' ? -24 : 24) : 0;
    const selected = p.id === session.selectedId;
    const hasBall = p.id === s.ballHolder;
    const title = `${p.name}, ${p.team === 'human' ? 'your player' : 'opponent'}, ${z.name}, ${s.remaining[p.id]} moves remaining${hasBall ? ', has ball' : ''}`;
    return `<g class="player-token ${p.team} ${selected ? 'selected' : ''}" transform="translate(${z.x + offset} ${z.y})"
      ${p.team === 'human' ? `role="button" tabindex="0" data-player="${p.id}" aria-label="Select ${escape(title)}" aria-pressed="${selected}"` : `aria-label="${escape(title)}" role="img"`}>
      <title>${escape(title)}</title>${selected ? '<circle class="selection" r="31"/>' : ''}
      <circle class="token-body" r="25"/><text class="token-number" text-anchor="middle" y="7">${i % 3 + 1}</text>
      <rect x="-17" y="22" width="34" height="18" rx="6" fill="#20372c"/>
      <text class="token-stamina" text-anchor="middle" y="35">${s.remaining[p.id]}/${p.stamina}</text>
      <text class="token-name" text-anchor="middle" y="${selected && session.canEdit ? 58 : shared && p.team === 'human' ? -61 : -39}">${escape(p.name)}</text>
      ${hasBall ? '<circle class="ball" cx="24" cy="-15" r="10"/><path d="M14 -15h20M24 -25v20" stroke="#653a1c" fill="none" stroke-width="1.2"/>' : ''}
    </g>`;
  }).join('');
  const activeCenter = cells[s.positions[session.selectedId]];
  const activeShared = s.players.some(p => p.id !== session.selectedId && s.positions[p.id] === s.positions[session.selectedId]);
  const holdControl = session.canEdit ? `<g class="court-hold" role="button" tabindex="0"
    data-command="hold-active" aria-label="Hold for ${escape(s.players.find(p => p.id === session.selectedId)!.name)}, step ${session.selectedStep + 1}"
    transform="translate(${activeCenter.x + (activeShared ? -24 : 0)} ${activeCenter.y - 54})">
    <rect x="-42" y="-18" width="84" height="36" rx="10"/>
    <text text-anchor="middle" y="6">HOLD</text><title>Hold this step for free, then select the next teammate</title>
  </g>` : '';
  return `<svg class="court" viewBox="0 0 900 670" role="group" aria-label="Half court. Mint players are your team. Highlighted hexes are legal moves; orange dots indicate defensive coverage.">
    <defs><pattern id="boards" width="90" height="44" patternUnits="userSpaceOnUse">
      <rect width="90" height="44" fill="#bc8652"/><path d="M0 0H90M0 44H90M0 0V44" stroke="#855e3d" stroke-width="1" opacity=".35"/>
      <path d="M5 8h73M12 11h56M20 32h60" stroke="#e7b67e" stroke-width="1" opacity=".12"/>
    </pattern></defs>
    <rect width="900" height="670" fill="url(#boards)"/>
    <rect x="35" y="45" width="830" height="590" rx="2" class="court-line"/>
    <path d="M310 45V305H590V45" fill="#8c5f3d" opacity=".3"/>
    <path d="M310 45V305H590V45M180 45V120A270 270 0 0 0 720 120V45" class="court-line"/>
    <circle cx="450" cy="305" r="65" class="court-line"/>
    <path d="M395 120A55 55 0 0 0 505 120M370 635A80 80 0 0 1 530 635" class="court-line"/>
    <text x="450" y="485" text-anchor="middle" fill="#5c422f" opacity=".33" style="font:900 52px system-ui;letter-spacing:-3px">ALLDUNKS</text>
    ${targets}
    <path d="M${450 - THREE_RADIUS} 45V120A${THREE_RADIUS} ${THREE_RADIUS} 0 0 0 ${450 + THREE_RADIUS} 120V45" class="scoring-arc"/>
    <text x="450" y="653" text-anchor="middle" class="court-key">RIM (0,0) · 2 POINTS INSIDE ARC / 3 OUTSIDE</text>
    <path style="pointer-events:none" d="M409 65H491" stroke="#fff5d6" stroke-width="7"/><circle cx="450" cy="86" r="16" fill="none" stroke="#f56632" stroke-width="5"/>
    ${routes}${tokens}${holdControl}
  </svg>`;
}

function rosterMarkup(): string {
  const s = session.preview, selected = s.players.find(p => p.id === session.selectedId)!;
  return `<section class="panel"><h2>Your three <small>Select a player</small></h2><div class="roster">${s.players.filter(p => p.team === 'human').map((p, i) => {
    const allowance = s.phase === 'rebound' ? Math.floor(p.stamina * 2 / 3) : p.stamina;
    return `<button class="player-card ${p.id === session.selectedId ? 'selected' : ''}" data-player="${p.id}" aria-pressed="${p.id === session.selectedId}">
      <span class="jersey">${i + 1}</span><span><span class="player-name">${escape(p.name)}${s.ballHolder === p.id ? ' · BALL' : ''}</span>
      <span class="player-info" style="display:block">${p.height} cm · ${cells[s.positions[p.id]].name}</span>
      <span class="move-dots" aria-hidden="true">${Array.from({ length: allowance }, (_, j) => `<i class="${j < s.remaining[p.id] ? 'full' : ''}"></i>`).join('')}</span></span>
      <span class="moves">${s.remaining[p.id]} / ${allowance}<small>moves</small></span></button>`;
  }).join('')}</div><div class="statline" aria-label="Selected player ratings">
    ${(['shooting', 'finishing', 'defense', 'rebounding'] as const).map((key, i) => `<div><small>${['SHOT', 'FINISH', 'DEFENSE', 'REBOUND'][i]}</small><strong>${selected[key]}</strong></div>`).join('')}
    </div></section>`;
}

function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case 'shot': return `${playerName(e.athlete)} ${e.made ? 'scores' : 'misses'}${e.dunk ? ' an open dunk' : ` a ${e.points}-point shot`} · ${percent(e.probability)} chance.`;
    case 'rebound': return `${playerName(e.athlete)} gets the rebound.`;
    case 'pass': return `${playerName(e.athlete)} ${e.success ? `finds ${playerName(e.receiver)}` : 'has the pass intercepted'} · ${percent(e.probability)} pass chance.`;
    case 'drive': return `${playerName(e.athlete)} ${e.success ? `drives to ${cells[e.to].name}` : 'loses the ball on the drive'}.`;
    case 'action': return e.actionType === 'move' ? `${playerName(e.athlete)} moves to ${cells[e.to as HexId].name}.` : null;
    case 'defensive-reaction': return 'athlete' in e ? `${playerName(e.athlete)} adjusts to ${cells[e.to].name} · 1 defensive move.` : null;
    case 'phase-start': return `${e.possession === 'human' ? 'Your' : 'Opponent'} ${e.phaseType === 'rebound' ? 'rebound phase · reduced moves' : 'possession · full moves'}.`;
    case 'phase-violation': return `${escape(e.reason ?? 'Phase expired')}. Possession turns over.`;
    case 'skipped-action': return `${playerName(e.athlete)} skips step ${e.step + 1}: ${escape(e.reason)}.`;
    case 'timeline-step': return `Executing step ${e.step + 1}.`;
    case 'play-committed': return `${e.team === 'human' ? 'Your' : 'Opponent'} play committed · ${e.slots} steps.`;
    case 'play-ended': return `Play ended${e.cancelledSteps ? ` · ${e.cancelledSteps} remaining steps cancelled` : ''}.`;
    case 'strategy': return `Coverage set to ${strategyNames[e.strategy].toLowerCase()}.`;
    case 'match-over': return `${e.winner === 'human' ? 'You win' : 'Opponent wins'}, ${e.scores.human}–${e.scores.ai}.`;
    default: return null;
  }
}

function commentaryMarkup(state: GameState): string {
  const log = possessionEvents(state.events, commentaryTab).map(e => ({ phase: e.phase, text: eventText(e) }))
    .filter(e => e.text !== null).slice(-80).reverse();
  const report = commentaryTab === 'ai' ? session.lastOpponentReport : session.lastStepReport;
  const feedback = !animating && report?.team === commentaryTab ? stepFeedback(state, report) : null;
  return `<aside class="panel commentary-panel" aria-label="Possession play-by-play"><h2>Play-by-play <small>Latest first</small></h2>
    <div class="commentary-tabs" role="tablist" aria-label="Possession">
      ${(['human','ai'] as const).map(team => `<button id="commentary-tab-${team}" role="tab" aria-selected="${commentaryTab===team}" aria-controls="commentary-content" tabindex="${commentaryTab===team?0:-1}" data-commentary-tab="${team}">${team==='human'?'Your possession':'Opponent'}</button>`).join('')}
    </div>
    <div id="commentary-content" class="commentary-content" role="tabpanel" tabindex="0" aria-labelledby="commentary-tab-${commentaryTab}">
      ${feedback ? `<section class="commentary-result"><strong>${escape(feedback.title)}</strong><ul>${feedback.lines.filter(l=>l.important).map(l=>`<li>${escape(l.text)}</li>`).join('')}</ul></section>` : ''}
      <ol class="log">${log.map(e=>`<li><span class="log-phase">P${e.phase}</span>${e.text}</li>`).join('') || `<li>${commentaryTab==='human'?'Your play events will appear here.':'No opponent possession yet.'}</li>`}</ol>
    </div></aside>`;
}

function render(): void {
  const focusedTab = root.querySelector('[data-commentary-tab]:focus')?.getAttribute('data-commentary-tab');
  const oldCommentary = root.querySelector<HTMLElement>('.commentary-content');
  if (oldCommentary) commentaryScroll[oldCommentary.getAttribute('aria-labelledby') === 'commentary-tab-ai' ? 'ai' : 'human'] = oldCommentary.scrollTop;
  const previousTimelineScroll = root.querySelector('.timeline-scroll')?.scrollLeft ?? 0;
  const s = visualState ?? session.state, actions = assignmentOptions(session);
  const selected = s.players.find(p => p.id === session.selectedId)!;
  const label = s.status === 'over' ? 'Game over' : s.phase === 'rebound' ? 'Rebound phase · ⅔ moves' : `Phase ${s.phaseNumber} · ${s.mode === 'executing' ? 'Executing' : 'Planning'}`;
  const caption = s.status === 'over' ? 'Game finished. Play again to start a fresh matchup.' : isHumanTurn()
    ? `${selected.name} is active (gold hex). Choose an action or Hold above the player. Planning cycles through all three players before the next step.`
    : s.mode === 'executing' ? 'Committed play. Use playback controls to run, pause, or step; assignments are locked.' : 'Choose defensive coverage, then run the opponent’s committed play.';
  const log = s.events.map(e => ({ phase: e.phase, text: eventText(e) })).filter(e => e.text !== null).slice(-24).reverse();
  root.innerHTML = `<div class="shell">
    <header class="topbar"><div class="brand" aria-label="AllDunks"><i aria-hidden="true"></i>ALL<span>DUNKS</span></div>
      <div class="top-tools"><span class="eyebrow">Half-court tactics · 3 on 3</span><button class="subtle" data-command="new-game">New game</button></div></header>
    <section class="scorebar" aria-label="Scoreboard">
      <div class="score-team home"><div class="score-number">${s.scores.human.toString().padStart(2, '0')}</div><div><div class="team-name">HOME COURT</div><div class="team-label">Your team · mint</div></div></div>
      <div class="game-meta"><div class="eyebrow">First to 21 · 2s &amp; 3s</div><div class="phase-pill ${s.phase === 'rebound' ? 'rebound' : ''}">${label}</div></div>
      <div class="score-team away"><div><div class="team-name">VISITORS</div><div class="team-label">AI team · orange</div></div><div class="score-number">${s.scores.ai.toString().padStart(2, '0')}</div></div>
    </section>
    ${error ? `<p role="alert" class="notice error">${escape(error)}</p>` : ''}
    <div class="game-layout">${commentaryMarkup(s)}<div class="court-column"><section class="court-panel"><div class="court-playbar">${courtPlayButton(session, running)}<span>${s.mode === 'executing' ? 'Watch each step and its results' : 'Run the assigned play'}</span></div><div class="court-heading"><div><h1>${isHumanTurn() ? escape(selected.name) + ': choose an action' : s.status === 'over' ? 'Final whistle.' : s.mode === 'executing' ? 'Play in motion.' : 'Get a stop.'}</h1><p>${session.canEdit ? `Step ${session.selectedStep + 1} of ${session.draft.slots} · Player ${s.players.filter(p => p.team === 'human').findIndex(p => p.id === session.selectedId) + 1} of 3 · Hold is free` : 'Hex court · orange dots mark covered destinations'}</p></div><div class="legend"><span><b></b>Your team</span><span><b></b>Opponent</span></div></div>
      <div class="court-stage">${courtMarkup(actions)}${popup ? `<div class="court-popup" role="status" aria-live="assertive">${escape(popup)}</div>` : ''}</div><div class="court-caption">${escape(caption)}</div></section>
      ${timelineMarkup(session)}<div class="below-court"><section class="panel howto"><h2>The game plan <small>How to play</small></h2><p><strong>Follow the gold hex</strong> to the active player. Assign an action or use Hold above them; the next teammate becomes active automatically. After all three, planning advances one step. You can still click timeline slots to edit.</p>
      <p><strong>Create a shot.</strong> Assign actions for all three players, then run the play. Each step resolves movement, passing, one defensive response, then shooting.</p>
      <details><summary>Stamina, rebounds &amp; dunks</summary><ul><li>Each player has their own move budget for the phase; shooting costs one too.</li><li>After an offensive rebound, everyone resets to ⅔ of normal stamina, rounded down.</li><li>Undefended directly under the rim? The shot is a guaranteed dunk. With a defender nearby, it is a normal shot at the rim.</li><li>Holds cost nothing. A player may hold for every slot. If the timeline ends without a shot, possession turns over.</li><li>Possession changes generate a spaced starting formation with a check near the top. First to reach 21 wins.</li></ul></details>
      <div class="toolbar-bottom"><label for="seed">Game seed</label><input id="seed" type="number" step="1" value="${seed}" aria-label="Game seed"><button data-command="new-game">Restart with seed</button></div></section></div>
    </div><aside class="sidebar">${rosterMarkup()}${controlsMarkup(session, actions, running, speed)}
      <section class="panel"><h2>Scouting report <small>Opponent</small></h2>${s.players.filter(p => p.team === 'ai').map(p => `<div class="opponent-row"><span>${escape(p.name)} · ${p.height} cm</span><span>${s.remaining[p.id]} moves</span></div>`).join('')}</section>
    </aside></div><div class="screen-reader" aria-live="polite" aria-atomic="true">${log[0]?.text ?? 'Game ready'}</div>
  </div>`;
  const timelineScroll = root.querySelector('.timeline-scroll');
  if (timelineScroll) timelineScroll.scrollLeft = previousTimelineScroll;
  const commentary = root.querySelector('.commentary-content');
  if (commentary) commentary.scrollTop = commentaryScroll[commentaryTab];
  if (focusedTab) root.querySelector<HTMLElement>(`[data-commentary-tab="${focusedTab}"]`)?.focus({preventScroll:true});
}

function stopPlayback(): void {
  running = false;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function startPlayback(): void {
  running = true;
  // Show the committed starting positions before executing the first step.
  if (session.state.playback?.cursor === 0) {
    render();
    timer = setTimeout(stepPlayback, 650 / speed);
  } else {
    void stepPlayback();
  }
}

async function stepPlayback(): Promise<void> {
  if (animating) return;
  if (session.state.mode !== 'executing') { stopPlayback(); render(); return; }
  try {
    const before = session.state;
    session.step();
    const version = animationVersion;
    animating = true;
    for (const frame of actionFrames(before, session.lastStepReport?.events ?? [])) {
      visualState = frame.state; popup = frame.text; render();
      await new Promise(resolve => setTimeout(resolve, frame.duration / speed));
      if (version !== animationVersion) return;
    }
    visualState = null; popup = ''; animating = false;
    if (session.state.mode !== 'executing') {
      stopPlayback();
      if (session.state.possession === 'ai' && session.state.status === 'playing') {
        const humanReport = session.lastStepReport;
        session.simulateOpponentPossession();
        session.lastStepReport = humanReport;
      }
    }
  } catch (e) { error = e instanceof Error ? e.message : 'Unable to execute step'; animating = false; visualState = null; popup = ''; stopPlayback(); }
  render();
  if (running) timer = setTimeout(stepPlayback, DEFAULT_STEP_DELAY / speed);
}

function activate(target: Element): void {
  const tab = target.getAttribute('data-commentary-tab');
  if (tab === 'human' || tab === 'ai') { commentaryTab = tab; render(); root.querySelector<HTMLElement>(`[data-commentary-tab="${tab}"]`)?.focus({preventScroll:true}); return; }
  if (animating && target.getAttribute('data-command') !== 'new-game' && target.getAttribute('data-command') !== 'toggle-play') return;
  error = '';
  try {
    const player = target.getAttribute('data-player');
    const hex = target.getAttribute('data-hex') as HexId | null;
    const strategy = target.getAttribute('data-strategy') as Strategy | null;
    const assignment = target.getAttribute('data-assignment');
    const slot = target.getAttribute('data-slot');
    const command = target.getAttribute('data-command');
    if (slot !== null && session.canEdit) session.selectSlot(target.getAttribute('data-slot-player')!, Number(slot));
    else if (player) session.selectPlayer(player);
    else if (hex && session.canEdit) session.assign({ type: 'move', athlete: session.selectedId, to: hex });
    else if (strategy && !running) session.chooseStrategy(strategy);
    else if (assignment !== null && session.canEdit) {
      const action = assignmentOptions(session)[Number(assignment)];
      if (action) session.assign(action);
    } else if (command === 'new-game') {
      const nextSeed = Number(root.querySelector<HTMLInputElement>('#seed')?.value ?? seed);
      if (!Number.isSafeInteger(nextSeed)) throw new Error('Enter a whole number for the game seed.');
      animationVersion++; animating = false; visualState = null; popup = '';
      stopPlayback(); seed = nextSeed; session = new GameSession(seed);
    } else if (command === 'hold-active') session.assign({ type: 'hold', athlete: session.selectedId });
    else if (command === 'clear-slot') session.clearSlot();
    else if (command === 'clear-plan') session.clearPlan();
    else if (command === 'earlier') session.shiftSlot(-1);
    else if (command === 'later') session.shiftSlot(1);
    else if (command === 'commit-plan' || command === 'run-plan') {
      session.commit();
      if (command === 'run-plan') { startPlayback(); return; }
    } else if (command === 'commit-ai' || command === 'run-ai') {
      session.startOpponentPlay();
      if (command === 'run-ai') { startPlayback(); return; }
    } else if (command === 'next-step' && !running) { stepPlayback(); return; }
    else if (command === 'toggle-play') {
      if (running) stopPlayback();
      else { startPlayback(); return; }
    }
  } catch (e) { error = e instanceof Error ? e.message : 'Unable to assign action'; }
  render();
}

const actionable = '[data-commentary-tab],[data-player],[data-hex],[data-assignment],[data-command],[data-strategy],[data-slot]';
root.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest(actionable);
  if (target && !target.hasAttribute('disabled')) activate(target);
});
root.addEventListener('keydown', event => {
  if (event.target instanceof Element && event.target.matches('[data-commentary-tab]') && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();
    const next = event.key === 'Home' ? 'human' : event.key === 'End' ? 'ai' : commentaryTab === 'human' ? 'ai' : 'human';
    const button = root.querySelector(`[data-commentary-tab="${next}"]`);
    if (button) activate(button);
    return;
  }
  if (!['Enter', ' '].includes(event.key) || !(event.target instanceof Element)) return;
  // Native buttons already implement keyboard activation.
  const target = event.target.closest<SVGElement>('svg [role="button"]');
  if (target) { event.preventDefault(); activate(target); }
});
root.addEventListener('change', event => {
  if (event.target instanceof HTMLSelectElement && event.target.id === 'playback-speed') speed = Number(event.target.value);
});
window.addEventListener('pagehide', () => { animationVersion++; stopPlayback(); });
render();
