import type { Action, DefensiveReaction, EventDetails, GameEvent, GameState, Phase, Player, ShotPreview, Strategy, Team, Zone } from './types.js';
export type * from './types.js';
import { defaultRoster } from './roster.js';

export const COURT: Record<Zone, Zone[]> = {
  T: ['LW', 'RW', 'H'], LW: ['T', 'LC', 'LE'], RW: ['T', 'RC', 'RE'],
  LC: ['LW', 'LB'], RC: ['RW', 'RB'], H: ['T', 'LE', 'RE'],
  LE: ['LW', 'H', 'LB'], RE: ['RW', 'H', 'RB'],
  LB: ['LC', 'LE', 'R'], RB: ['RC', 'RE', 'R'], R: ['LB', 'RB'],
};
export const STRATEGIES: Strategy[] = ['balanced', 'protect-paint', 'pressure-perimeter'];
export const TUNING = {
  targetScore: 21,
  shot: { three: [0.20, 0.30], midrange: [0.30, 0.35], rim: [0.45, 0.40] },
  contest: { same: 0.12, adjacent: 0.06, defense: 0.10 },
  heightPressurePerCm: 0.002, heightPressureCap: 0.04,
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const other = (team: Team): Team => team === 'human' ? 'ai' : 'human';
const members = (s: GameState, team: Team) => s.players.filter(p => p.team === team);
const athlete = (s: GameState, id: string): Player => {
  const player = s.players.find(p => p.id === id);
  if (!player) throw new Error('Unknown athlete');
  return player;
};
function emit<K extends keyof EventDetails>(s: GameState, type: K, details: EventDetails[K]): void {
  // The generic key correlates the payload with its discriminant.
  s.events.push({ ...details, type, phase: s.phaseNumber } as GameEvent);
}

export function distance(from: Zone, to: Zone): number {
  if (!COURT[from] || !COURT[to]) throw new Error('Unknown court zone');
  const queue: [Zone, number][] = [[from, 0]];
  const seen = new Set<Zone>([from]);
  for (let i = 0; i < queue.length; i++) {
    const [zone, steps] = queue[i];
    if (zone === to) return steps;
    for (const next of COURT[zone]) if (!seen.has(next)) {
      seen.add(next); queue.push([next, steps + 1]);
    }
  }
  throw new Error('Disconnected court');
}

export function phaseAllowance(stamina: number, phase: Phase = 'normal'): number {
  return phase === 'rebound' ? Math.floor(stamina * 2 / 3) : stamina;
}

function validateRoster(players: Player[]): void {
  if (!Array.isArray(players) || players.length !== 6) throw new Error('Roster requires six athletes');
  const ids = new Set();
  for (const p of players) {
    if (typeof p.id !== 'string' || !p.id || ids.has(p.id)) throw new Error('Unique athlete IDs required');
    ids.add(p.id);
    if (!['human', 'ai'].includes(p.team)) throw new Error('Unknown team');
    if (!Number.isInteger(p.stamina) || p.stamina < 3 || p.stamina > 7) throw new Error('Stamina must be 3–7');
    if (!Number.isFinite(p.height) || p.height < 140 || p.height > 250) throw new Error('Height must be 140–250 cm');
    for (const key of ['shooting', 'finishing', 'passing', 'defense', 'rebounding'] as const) {
      if (!Number.isInteger(p[key]) || p[key] < 0 || p[key] > 100) throw new Error(`Invalid ${key} rating`);
    }
  }
  for (const team of ['human', 'ai']) if (players.filter(p => p.team === team).length !== 3)
    throw new Error('Each team requires three athletes');
}

export function createGame({ seed = 1, players = defaultRoster() }: { seed?: number; players?: Player[] } = {}): GameState {
  validateRoster(players);
  if (!Number.isInteger(seed)) throw new Error('Seed must be an integer');
  const state: GameState = {
    players: structuredClone(players), scores: { human: 0, ai: 0 },
    possession: 'human', ballHolder: players[0].id, positions: {}, remaining: {},
    phase: 'normal', phaseNumber: 0, strategy: 'balanced', strategyOpen: false,
    rng: seed >>> 0, status: 'playing', winner: null, events: [],
  };
  startPhase(state, 'normal', true);
  return state;
}

function startPhase(s: GameState, phase: Phase, reset: boolean): void {
  s.phase = phase; s.phaseNumber++;
  for (const p of s.players) s.remaining[p.id] = phaseAllowance(p.stamina, phase);
  if (reset) {
    for (const team of ['human', 'ai'] as const) {
      const zones: Zone[] = team === s.possession ? ['T', 'LW', 'RW'] : ['H', 'LE', 'RE'];
      members(s, team).forEach((p, i) => { s.positions[p.id] = zones[i]; });
    }
    s.ballHolder = members(s, s.possession)[0].id;
    s.strategyOpen = s.possession === 'ai';
  }
  emit(s, 'phase-start', { phaseType: phase, possession: s.possession, remaining: { ...s.remaining } });
}

function changePossession(s: GameState, reason: string): void {
  s.possession = other(s.possession);
  emit(s, 'possession-change', { reason, possession: s.possession });
  startPhase(s, 'normal', true);
}

// A serializable LCG; unsigned arithmetic makes every seed reproducible in browsers and Node.
function draw(s: GameState): number {
  s.rng = (Math.imul(1664525, s.rng) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}

export function selectStrategy(state: GameState, strategy: Strategy): GameState {
  if (state.status !== 'playing' || !state.strategyOpen) throw new Error('Choose strategy before opponent possession begins');
  if (!STRATEGIES.includes(strategy)) throw new Error('Unknown defensive strategy');
  const s = structuredClone(state);
  s.strategy = strategy;
  emit(s, 'strategy', { strategy });
  return s;
}

export function contestingDefenders(s: GameState, shooterId: string): Player[] {
  const p = athlete(s, shooterId);
  return members(s, other(p.team)).filter(d => distance(s.positions[d.id], s.positions[p.id]) <= 1);
}

export function shotPreview(s: GameState, shooterId: string = s.ballHolder): ShotPreview {
  const p = athlete(s, shooterId);
  if (!p) throw new Error('Unknown shooter');
  const zone = s.positions[p.id];
  const kind = ['T', 'LW', 'RW', 'LC', 'RC'].includes(zone) ? 'three'
    : ['R', 'LB', 'RB'].includes(zone) ? 'rim' : 'midrange';
  const defenders = contestingDefenders(s, p.id);
  const dunk = zone === 'R' && defenders.length === 0;
  const [base, scale] = TUNING.shot[kind];
  const baseChance = base + scale * (kind === 'rim' ? p.finishing : p.shooting) / 100;
  const contributors = defenders.map(d => ({
    id: d.id,
    pressure: (s.positions[d.id] === zone ? TUNING.contest.same : TUNING.contest.adjacent)
      + TUNING.contest.defense * d.defense / 100
      + (kind === 'rim' ? clamp((d.height - p.height) * TUNING.heightPressurePerCm,
        -TUNING.heightPressureCap, TUNING.heightPressureCap) : 0),
  })).sort((a, b) => b.pressure - a.pressure || a.id.localeCompare(b.id));
  const penalty = contributors.reduce((sum, d, i) => sum + d.pressure * (i === 0 ? 1 : 0.5), 0);
  return { kind, dunk, points: kind === 'three' ? 3 : 2, baseChance,
    probability: dunk ? 1 : clamp(baseChance - penalty, 0.05, 0.95), contributors };
}

export function passProbability(s: GameState, receiverId: string): number {
  const p = athlete(s, s.ballHolder);
  const receiver = athlete(s, receiverId);
  if (!receiver || receiver.team !== p.team || receiver.id === p.id) throw new Error('Invalid receiver');
  const pressure = contestingDefenders(s, receiver.id).length;
  return clamp(0.98 - 0.025 * Math.max(0, distance(s.positions[p.id], s.positions[receiver.id]) - 1)
    - 0.10 * (1 - p.passing / 100) - 0.06 * pressure, 0.55, 0.98);
}

export function driveRisk(s: GameState, id: string, to: Zone): number {
  const p = athlete(s, id);
  const defenders = members(s, other(p.team)).filter(d => distance(s.positions[d.id], to) <= 1);
  return defenders.length ? clamp(0.04 + 0.12 * Math.max(...defenders.map(d => d.defense / 100))
    + 0.04 * (defenders.length - 1), 0.04, 0.30) : 0;
}

export function reboundWeights(s: GameState) {
  return [...s.players].sort((a, b) => a.id.localeCompare(b.id)).map(p => {
    const proximity = [4, 3, 2, 1][Math.min(3, distance(s.positions[p.id], 'R'))];
    const heightFactor = clamp(1 + (p.height - 195) * 0.01, 0.75, 1.25);
    return { id: p.id, weight: (1 + p.rebounding) * proximity * heightFactor, heightFactor };
  });
}

function resolveRebound(s: GameState): void {
  const weights = reboundWeights(s), roll = draw(s);
  const total = weights.reduce((sum, p) => sum + p.weight, 0);
  let target = roll * total;
  const winner = weights.find(p => (target -= p.weight) < 0) ?? weights[weights.length - 1];
  emit(s, 'rebound', { athlete: winner.id, roll, weights });
  if (athlete(s, winner.id).team === s.possession) {
    s.ballHolder = winner.id;
    startPhase(s, 'rebound', false);
  } else changePossession(s, 'defensive-rebound');
}

function canMove(s: GameState, p: Player, to: Zone): boolean {
  return s.remaining[p.id] > 0 && COURT[s.positions[p.id]].includes(to)
    && !members(s, p.team).some(m => m.id !== p.id && s.positions[m.id] === to);
}

export function legalActions(s: GameState): Action[] {
  if (s.status !== 'playing') return [];
  const actions: Action[] = [];
  for (const p of members(s, s.possession)) {
    if (s.remaining[p.id] <= 0) continue;
    for (const to of COURT[s.positions[p.id]]) if (canMove(s, p, to))
      actions.push({ type: p.id === s.ballHolder ? 'drive' : 'move', athlete: p.id, to });
    if (p.id === s.ballHolder) {
      actions.push({ type: 'shoot', athlete: p.id });
      for (const receiver of members(s, p.team).filter(m => m.id !== p.id))
        actions.push({ type: 'pass', athlete: p.id, to: receiver.id, warning:
          s.remaining[receiver.id] === 0 ? 'Receiver has no moves; completed pass ends possession' : null });
    }
  }
  actions.push({ type: 'end-possession' });
  return actions;
}

function validateAction(s: GameState, action: Action | null | undefined): Action {
  if (s.status !== 'playing') throw new Error('Match is over');
  if (!action || typeof action !== 'object') throw new Error('Action required');
  const match = legalActions(s).find(a => a.type === action.type
    && a.athlete === action.athlete && a.to === action.to);
  if (!match) throw new Error('Illegal action');
  return match;
}

function defensiveMetric(s: GameState): number[] {
  const threats = members(s, s.possession).map(p => {
    if (s.remaining[p.id] === 0) return 0;
    const preview = shotPreview(s, p.id);
    const strategy = s.possession === 'ai' ? s.strategy : 'balanced';
    const multiplier = (strategy === 'protect-paint' && preview.kind === 'rim')
      || (strategy === 'pressure-perimeter' && preview.kind === 'three') ? 1.2 : 1;
    return preview.points * preview.probability * multiplier;
  }).sort((a, b) => b - a);
  const offense = members(s, s.possession), defense = members(s, other(s.possession));
  const matchupDistance = defense.reduce((sum, p, i) =>
    sum + distance(s.positions[p.id], s.positions[offense[i].id]), 0);
  return [...threats, threats.reduce((a, b) => a + b, 0), matchupDistance];
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-10) return a[i] < b[i];
  }
  return false;
}

export function chooseDefensiveReaction(s: GameState): DefensiveReaction | null {
  let best: DefensiveReaction | null = null;
  let metric = [...defensiveMetric(s), 0];
  const defenders = [...members(s, other(s.possession))].sort((a, b) => a.id.localeCompare(b.id));
  for (const p of defenders) for (const to of [...COURT[s.positions[p.id]]].sort()) {
    if (!canMove(s, p, to)) continue;
    const candidate = { ...s, positions: { ...s.positions, [p.id]: to } };
    const nextMetric = [...defensiveMetric(candidate), 1];
    if (lexLess(nextMetric, metric)) { metric = nextMetric; best = { athlete: p.id, to }; }
  }
  return best;
}

function defensiveReaction(s: GameState): void {
  const reaction = chooseDefensiveReaction(s);
  if (reaction) {
    s.positions[reaction.athlete] = reaction.to;
    s.remaining[reaction.athlete]--;
  }
  emit(s, 'defensive-reaction', reaction ? { ...reaction, cost: 1 } : { hold: true, cost: 0 });
}

/** Pure transition: invalid actions throw without changing state or random sequence. */
export function applyAction(state: GameState, action: Action | null | undefined): GameState {
  const valid = validateAction(state, action);
  const s = structuredClone(state);
  s.strategyOpen = false;
  if (valid.type === 'end-possession') { changePossession(s, 'voluntary'); return s; }
  s.remaining[valid.athlete]--;
  emit(s, 'action', { ...valid, actionType: valid.type, cost: 1 });
  if (valid.type === 'shoot') {
    const preview = shotPreview(s);
    const roll = preview.dunk ? null : draw(s);
    const made = preview.dunk || (roll !== null && roll < preview.probability);
    emit(s, 'shot', { athlete: s.ballHolder, ...preview, roll, made });
    if (made) {
      s.scores[s.possession] += preview.points;
      if (s.scores[s.possession] >= TUNING.targetScore) {
        s.status = 'over'; s.winner = s.possession;
        emit(s, 'match-over', { winner: s.winner, scores: { ...s.scores } });
      } else changePossession(s, 'made-basket');
    } else resolveRebound(s);
    return s;
  }
  if (valid.type === 'pass') {
    const probability = passProbability(s, valid.to), roll = draw(s);
    emit(s, 'pass', { athlete: valid.athlete, receiver: valid.to, probability, roll, success: roll < probability });
    if (roll >= probability) { changePossession(s, 'interception'); return s; }
    s.ballHolder = valid.to;
  } else {
    if (valid.type === 'drive') {
      const risk = driveRisk(s, valid.athlete, valid.to), roll = risk === 0 ? null : draw(s);
      emit(s, 'drive', { athlete: valid.athlete, to: valid.to, turnoverProbability: risk, roll,
        success: roll === null || roll >= risk });
      if (roll !== null && roll < risk) { changePossession(s, 'drive-turnover'); return s; }
    }
    s.positions[valid.athlete] = valid.to;
  }
  defensiveReaction(s);
  if (s.remaining[s.ballHolder] === 0) {
    emit(s, 'phase-violation', { athlete: s.ballHolder });
    changePossession(s, 'phase-violation');
  }
  return s;
}

/** Baseline one-action offense. Setup is valued after the defense's legal reply. */
export function chooseOffensiveAction(s: GameState): Action | null {
  const actions = legalActions(s);
  if (!actions.length) return null;
  let best = actions.find(a => a.type === 'shoot') ?? actions[actions.length - 1];
  let bestValue = best.type === 'shoot' ? shotPreview(s).points * shotPreview(s).probability : -1;
  for (const action of actions) {
    if (action.type !== 'drive' && action.type !== 'pass') continue;
    const receiverId = action.type === 'pass' ? action.to : s.ballHolder;
    if (s.remaining[receiverId] - (action.type === 'drive' ? 1 : 0) < 1) continue;
    const candidate = { ...s, positions: { ...s.positions }, remaining: { ...s.remaining }, ballHolder: receiverId };
    candidate.remaining[action.athlete]--;
    if (action.type === 'drive') candidate.positions[action.athlete] = action.to;
    const reaction = chooseDefensiveReaction(candidate);
    if (reaction) candidate.positions[reaction.athlete] = reaction.to;
    const chance = action.type === 'pass' ? passProbability(s, action.to) : 1 - driveRisk(s, action.athlete, action.to);
    const preview = shotPreview(candidate);
    // Discount setup costs to prevent endless equal-value passing.
    const value = chance * preview.points * preview.probability - 0.04;
    if (value > bestValue + 1e-10) { best = action; bestValue = value; }
  }
  return best;
}
