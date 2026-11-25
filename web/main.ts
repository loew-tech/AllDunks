import { driveRisk, legalActions, passProbability, shotPreview } from '../src/engine.js';
import type { Action, GameEvent, Strategy, HexId } from '../src/types.js';
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

const cells = Object.fromEntries(Object.values(CELLS).map(c => [c.id, {
  ...hexToPixel(c), name: cellLabel(c.id), short: `${c.q},${c.r}`,
}])) as Record<HexId, { x: number; y: number; name: string; short: string }>;
const strategyNames: Record<Strategy, string> = {
  balanced: 'Balanced', 'protect-paint': 'Protect the paint', 'pressure-perimeter': 'Pressure the perimeter',
};
const escape = (value: unknown): string => String(value).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const percent = (value: number) => `${Math.round(value * 100)}%`;
const playerName = (id: string) => escape(session.state.players.find(p => p.id === id)?.name ?? id);
const isHumanTurn = () => session.state.possession === 'human' && session.state.status === 'playing';

function courtMarkup(actions: Action[]): string {
  const s = session.state;
  const moves = actions.filter(a => (a.type === 'move' || a.type === 'drive') && a.athlete === session.selectedId);
  const available = new Set(moves.map(a => a.to));
  const targets = Object.values(CELLS).map(c => {
    const legal = isHumanTurn() && available.has(c.id);
    const center = cells[c.id];
    const selected = s.positions[session.selectedId] === c.id;
    const defenders = s.players.filter(p => p.team !== s.possession && distance(s.positions[p.id], c.id) <= 1).length;
    const occupied = Object.values(s.positions).includes(c.id);
    return `<g class="hex-cell ${c.area} ${c.paint ? 'paint' : ''} ${c.underRim ? 'under-rim' : ''} ${legal ? 'available' : ''} ${selected ? 'selected-cell' : ''} ${occupied ? 'occupied' : ''}"
      ${legal ? `role="button" tabindex="0" data-hex="${c.id}" aria-label="Move to ${center.name}, one move${defenders ? ', defended' : ', undefended'}"` : ''}>
      <title>${center.name} · ${c.area === 'three' ? '3 points' : '2 points'}${c.underRim ? ' · open dunk eligible' : ''} · ${defenders} defenders in range</title>
      <polygon points="${polygonPoints(c.id)}"/>
      <text class="hex-coordinate" text-anchor="middle" x="${center.x}" y="${center.y + 31}">${center.short}</text>
      ${legal ? `<text class="hex-cost" text-anchor="middle" x="${center.x}" y="${center.y + 5}">1</text>` : ''}
      ${legal && defenders ? `<circle class="coverage-marker" cx="${center.x + 24}" cy="${center.y - 20}" r="5"/>` : ''}
    </g>`;
  }).join('');
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
      <text class="token-name" text-anchor="middle" y="${shared && p.team === 'human' ? -61 : -39}">${escape(p.name)}</text>
      ${hasBall ? '<circle class="ball" cx="24" cy="-15" r="10"/><path d="M14 -15h20M24 -25v20" stroke="#653a1c" fill="none" stroke-width="1.2"/>' : ''}
    </g>`;
  }).join('');
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
    <text x="450" y="30" text-anchor="middle" class="court-key">RIM (0,0) · 2 POINTS INSIDE ARC / 3 OUTSIDE</text>
    <path style="pointer-events:none" d="M409 65H491" stroke="#fff5d6" stroke-width="7"/><circle cx="450" cy="86" r="16" fill="none" stroke="#f56632" stroke-width="5"/>
    ${tokens}
  </svg>`;
}

function rosterMarkup(): string {
  const s = session.state, selected = s.players.find(p => p.id === session.selectedId)!;
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

function controlsMarkup(actions: Action[]): string {
  const s = session.state;
  if (s.status === 'over') return `<section class="panel control-panel"><div class="eyebrow">Final · first to 21</div>
    <h2 style="font-size:1.6rem;margin-top:10px">${s.winner === 'human' ? 'Your court.' : 'Run it back.'}</h2>
    <p class="final-score">${s.scores.human} : ${s.scores.ai}</p><p class="howto">${s.winner === 'human' ? 'You took the win.' : 'The visitors took this one.'} Start a new game to try a different approach.</p>
    <button class="primary" data-command="new-game">Play again</button></section>`;
  if (s.possession === 'ai') return `<section class="panel control-panel"><h2>On defense <small>AI possession</small></h2>
    <p class="notice">${s.phase === 'rebound' ? 'Opponent offensive rebound. Reduced moves; your strategy carries over.' : 'Your players defend automatically. Pick a coverage, then advance the opponent.'}</p>
    <div class="strategy-buttons" role="group" aria-label="Defensive strategy">${(Object.keys(strategyNames) as Strategy[]).map(key =>
      `<button data-strategy="${key}" class="${s.strategy === key ? 'active' : ''}" aria-pressed="${s.strategy === key}" ${!s.strategyOpen || running ? 'disabled' : ''}>${strategyNames[key]}</button>`).join('')}</div>
    <div class="action-buttons"><button class="primary" data-command="play-ai">${running ? 'Pause opponent' : 'Play opponent possession'}</button>
    <button data-command="step-ai" ${running ? 'disabled' : ''}>Next AI action <small>one step</small></button></div>
    <p class="howto" style="font-size:.8rem;margin-top:12px">${s.strategyOpen ? 'Strategy locks after the first action.' : 'Coverage is locked for this possession.'} You take over when possession changes.</p></section>`;

  const selected = s.players.find(p => p.id === session.selectedId)!;
  const holder = s.ballHolder === selected.id;
  const preview = shotPreview(s, selected.id);
  const shot = actions.findIndex(a => a.type === 'shoot' && a.athlete === selected.id);
  const moveButtons = actions.map((a, i) => ({ a, i })).filter(({ a }) =>
    (a.type === 'move' || a.type === 'drive') && a.athlete === selected.id).map(({ a, i }) => {
    if (a.type !== 'move' && a.type !== 'drive') return '';
    const risk = a.type === 'drive' ? driveRisk(s, selected.id, a.to) : 0;
    return `<button data-action="${i}">${cells[a.to].name}<small>${risk ? `${percent(risk)} turnover · ` : ''}1 move</small></button>`;
  }).join('');
  const passButtons = holder ? actions.map((a, i) => ({ a, i })).filter(({ a }) => a.type === 'pass').map(({ a, i }) => {
    if (a.type !== 'pass') return '';
    return `<button data-action="${i}" title="${escape(a.warning ?? 'Pass costs one move')}">To ${playerName(a.to)}<small>${a.warning ? 'NO MOVES · violation' : percent(passProbability(s, a.to))} · 1 move</small></button>`;
  }).join('') : '';
  const label = preview.dunk ? 'Open dunk' : preview.kind === 'three' ? 'Three-pointer' : preview.kind === 'rim' ? 'Shot at the rim' : 'Midrange shot';
  return `<section class="panel control-panel"><h2>${escape(selected.name)} <small>${holder ? 'Ball handler' : 'Off the ball'}</small></h2>
    ${s.phase === 'rebound' ? '<p class="notice warm">Second chance. Moves reset to ⅔ of normal stamina, rounded down.</p>' : ''}
    ${holder ? `<div class="shot-card"><div><h3>${label}</h3><p>${preview.points} points · ${preview.contributors.length ? `${preview.contributors.length} defender${preview.contributors.length > 1 ? 's' : ''} contesting` : 'Undefended'}</p></div><div class="shot-chance">${percent(preview.probability)}</div></div>
    <div class="action-buttons"><button class="primary" data-action="${shot}" ${shot < 0 ? 'disabled' : ''}>${preview.dunk ? 'Dunk' : 'Take the shot'}<small>1 move</small></button></div>`
    : `<p class="notice">Move ${escape(selected.name)} into space, or select ${playerName(s.ballHolder)} to pass or shoot.</p><button class="subtle" data-player="${s.ballHolder}">Select ball handler</button>`}
    <div class="actions-label">${holder ? 'Drive to a hex' : 'Move to a hex'}</div>
    <div class="action-buttons">${moveButtons || '<p class="howto">No movement available.</p>'}</div>
    ${holder ? `<div class="actions-label">Pass the ball</div><div class="action-buttons">${passButtons || '<p class="howto">No moves left to pass.</p>'}</div>` : ''}
    <div class="actions-label">Possession</div><div class="action-buttons"><button class="subtle" data-command="end-possession">End possession<small>turnover</small></button></div></section>`;
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
    case 'phase-violation': return `${playerName(e.athlete)} is out of moves. Possession turns over.`;
    case 'strategy': return `Coverage set to ${strategyNames[e.strategy].toLowerCase()}.`;
    case 'match-over': return `${e.winner === 'human' ? 'You win' : 'Opponent wins'}, ${e.scores.human}–${e.scores.ai}.`;
    default: return null;
  }
}

function render(): void {
  const s = session.state, actions = legalActions(s);
  const selected = s.players.find(p => p.id === session.selectedId)!;
  const label = s.status === 'over' ? 'Game over' : s.phase === 'rebound' ? 'Rebound phase · ⅔ moves' : `Phase ${s.phaseNumber} · ${s.possession === 'human' ? 'Your offense' : 'Your defense'}`;
  const caption = s.status === 'over' ? 'Game finished. Play again to start a fresh matchup.' : isHumanTurn()
    ? `${selected.name} selected. Click a highlighted hex to ${selected.id === s.ballHolder ? 'drive' : 'move'}, or use the action panel. Coordinates are (q, r); every action costs one move.`
    : running ? 'Opponent possession is playing. Pause at any time to inspect the court.' : 'Choose your defensive coverage and advance the opponent in the action panel.';
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
    <div class="game-layout"><div><section class="court-panel"><div class="court-heading"><div><h1>${isHumanTurn() ? 'Make your next move.' : s.status === 'over' ? 'Final whistle.' : 'Get a stop.'}</h1><p>Hex court · 1 move per cell · orange dots mark covered destinations.</p></div><div class="legend"><span><b></b>Your team</span><span><b></b>Opponent</span></div></div>
      ${courtMarkup(actions)}<div class="court-caption">${escape(caption)}</div></section>
      <div class="below-court"><section class="panel"><h2>Play-by-play <small>Latest first</small></h2><ol class="log">${log.map(e => `<li><span class="log-phase">P${e.phase}</span>${e.text}</li>`).join('')}</ol></section>
      <section class="panel howto"><h2>The game plan <small>How to play</small></h2><p><strong>Select a mint player</strong> to see their moves. Click a highlighted hex or choose a move in the action panel.</p>
      <p><strong>Create a shot.</strong> Pass, drive, or move off the ball. The defense can make one response after each setup action.</p>
      <details><summary>Stamina, rebounds &amp; dunks</summary><ul><li>Each player has their own move budget for the phase; shooting costs one too.</li><li>After an offensive rebound, everyone resets to ⅔ of normal stamina, rounded down.</li><li>Undefended directly under the rim? The shot is a guaranteed dunk. With a defender nearby, it is a normal shot at the rim.</li><li>A completed pass to a player with no moves ends the possession.</li><li>All possession changes reset to a check at the top. First to reach 21 wins.</li></ul></details>
      <div class="toolbar-bottom"><label for="seed">Game seed</label><input id="seed" type="number" step="1" value="${seed}" aria-label="Game seed"><button data-command="new-game">Restart with seed</button></div></section></div>
    </div><aside class="sidebar">${rosterMarkup()}${controlsMarkup(actions)}
      <section class="panel"><h2>Scouting report <small>Opponent</small></h2>${s.players.filter(p => p.team === 'ai').map(p => `<div class="opponent-row"><span>${escape(p.name)} · ${p.height} cm</span><span>${s.remaining[p.id]} moves</span></div>`).join('')}</section>
    </aside></div><div class="screen-reader" aria-live="polite" aria-atomic="true">${log[0]?.text ?? 'Game ready'}</div>
  </div>`;
}

function stopOpponent(): void {
  running = false;
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

function stepOpponent(): void {
  if (session.state.possession !== 'ai' || session.state.status !== 'playing') { stopOpponent(); render(); return; }
  try {
    session.nextOpponentAction();
    if (session.state.possession !== 'ai' || session.state.status !== 'playing') stopOpponent();
  } catch (e) { error = e instanceof Error ? e.message : 'Unable to play action'; stopOpponent(); }
  render();
  if (running) timer = setTimeout(stepOpponent, 650);
}

function activate(target: Element): void {
  error = '';
  try {
    const player = target.getAttribute('data-player');
    const hex = target.getAttribute('data-hex') as HexId | null;
    const strategy = target.getAttribute('data-strategy') as Strategy | null;
    const actionIndex = target.getAttribute('data-action');
    const command = target.getAttribute('data-command');
    if (player) session.selectPlayer(player);
    else if (hex && isHumanTurn()) {
      const move = legalActions(session.state).find(a => (a.type === 'move' || a.type === 'drive') && a.athlete === session.selectedId && a.to === hex);
      if (move) session.play(move);
    } else if (strategy && !running) session.chooseStrategy(strategy);
    else if (actionIndex !== null && isHumanTurn()) {
      const action = legalActions(session.state)[Number(actionIndex)];
      if (action) session.play(action);
    } else if (command === 'new-game') {
      const input = root.querySelector<HTMLInputElement>('#seed');
      const nextSeed = Number(input?.value ?? seed);
      if (!Number.isSafeInteger(nextSeed)) throw new Error('Enter a whole number for the game seed.');
      stopOpponent(); seed = nextSeed; session = new GameSession(seed);
    } else if (command === 'end-possession') session.play({ type: 'end-possession' });
    else if (command === 'step-ai' && !running) { stepOpponent(); return; }
    else if (command === 'play-ai') {
      if (running) stopOpponent();
      else { running = true; stepOpponent(); return; }
    }
  } catch (e) { error = e instanceof Error ? e.message : 'Unable to play action'; }
  render();
}

const actionable = '[data-player],[data-hex],[data-action],[data-command],[data-strategy]';
root.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const target = event.target.closest(actionable);
  if (target && !target.hasAttribute('disabled')) activate(target);
});
root.addEventListener('keydown', event => {
  if (!['Enter', ' '].includes(event.key) || !(event.target instanceof Element)) return;
  // Native buttons already implement keyboard activation.
  const target = event.target.closest<SVGElement>('svg [role="button"]');
  if (target) { event.preventDefault(); activate(target); }
});
window.addEventListener('pagehide', stopOpponent);
render();
