import type { Player, PlayerProfile } from './types.js';

/** Ratings are 0–100; height is centimeters. Array order sets check-ball roles. */
const profile = (name: string, stamina: number, height: number, shooting: number, finishing: number, passing: number, defense: number, rebounding: number): PlayerProfile =>
  ({ name, stamina, height, shooting, finishing, passing, defense, rebounding });

// Extremes are 2/20 profiles (10%); they are not forced into the default six.
export const PLAYER_POOL: PlayerProfile[] = [
  profile('Crossover', 6, 186, 76, 60, 84, 58, 35),
  profile('Cornerstone', 5, 198, 78, 70, 65, 70, 62),
  profile('Anchor', 4, 211, 38, 86, 48, 83, 88),
  profile('Tempo', 6, 188, 72, 65, 86, 61, 38),
  profile('Switch', 5, 200, 73, 75, 63, 75, 66),
  profile('Glass', 4, 209, 42, 83, 50, 85, 87),
  profile('Relay', 6, 190, 68, 67, 85, 64, 43),
  profile('Arc', 5, 194, 86, 55, 70, 59, 42),
  profile('Post', 4, 213, 35, 89, 47, 81, 90),
  profile('Cutter', 6, 193, 58, 80, 67, 65, 50),
  profile('Wing', 5, 202, 74, 73, 62, 72, 68),
  profile('Wall', 4, 208, 40, 78, 54, 89, 86),
  profile('Pilot', 6, 184, 74, 58, 90, 57, 30),
  profile('Range', 5, 196, 88, 52, 67, 58, 44),
  profile('Pivot', 4, 210, 46, 85, 62, 78, 84),
  profile('Stride', 6, 195, 64, 76, 71, 67, 48),
  profile('Utility', 5, 201, 68, 72, 72, 74, 70),
  profile('Board', 4, 212, 36, 81, 51, 84, 93),
  profile('Tower', 3, 216, 24, 92, 40, 92, 96),
  profile('Flash', 7, 179, 75, 58, 85, 52, 24),
];

export function defaultRoster(): Player[] {
  return PLAYER_POOL.slice(0, 6).map((p, i) => ({
    ...p, id: `${i < 3 ? 'human' : 'ai'}-${i % 3}`, team: i < 3 ? 'human' : 'ai',
  }));
}
