export type Team = 'human' | 'ai';
export type Zone = 'T' | 'LW' | 'RW' | 'LC' | 'RC' | 'H' | 'LE' | 'RE' | 'LB' | 'RB' | 'R';
export type Phase = 'normal' | 'rebound';
export type Strategy = 'balanced' | 'protect-paint' | 'pressure-perimeter';

export interface PlayerProfile {
  name: string;
  stamina: number;
  height: number;
  shooting: number;
  finishing: number;
  passing: number;
  defense: number;
  rebounding: number;
}
export interface Player extends PlayerProfile { id: string; team: Team }

export type Action =
  | { type: 'move' | 'drive'; athlete: string; to: Zone }
  | { type: 'pass'; athlete: string; to: string; warning?: string | null }
  | { type: 'shoot'; athlete: string; to?: never }
  | { type: 'end-possession'; athlete?: never; to?: never };

export interface ShotPreview {
  kind: 'three' | 'midrange' | 'rim';
  dunk: boolean;
  points: 2 | 3;
  baseChance: number;
  probability: number;
  contributors: { id: string; pressure: number }[];
}
export interface ReboundWeight { id: string; weight: number; heightFactor: number }
export interface DefensiveReaction { athlete: string; to: Zone }

export interface EventDetails {
  'phase-start': { phaseType: Phase; possession: Team; remaining: Record<string, number> };
  'possession-change': { reason: string; possession: Team };
  strategy: { strategy: Strategy };
  rebound: { athlete: string; roll: number; weights: ReboundWeight[] };
  'defensive-reaction': ({ hold: true } | DefensiveReaction) & { cost: number };
  action: { actionType: Action['type']; athlete: string; to?: string; warning?: string | null; cost: number };
  shot: ShotPreview & { athlete: string; roll: number | null; made: boolean };
  pass: { athlete: string; receiver: string; probability: number; roll: number; success: boolean };
  drive: { athlete: string; to: Zone; turnoverProbability: number; roll: number | null; success: boolean };
  'match-over': { winner: Team; scores: Record<Team, number> };
  'phase-violation': { athlete: string };
}
export type GameEvent = {
  [K in keyof EventDetails]: EventDetails[K] & { type: K; phase: number }
}[keyof EventDetails];

export interface GameState {
  players: Player[];
  scores: Record<Team, number>;
  possession: Team;
  ballHolder: string;
  positions: Record<string, Zone>;
  remaining: Record<string, number>;
  phase: Phase;
  phaseNumber: number;
  strategy: Strategy;
  strategyOpen: boolean;
  rng: number;
  status: 'playing' | 'over';
  winner: Team | null;
  events: GameEvent[];
}
