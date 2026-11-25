/** Axial coordinates are encoded as q,r keys so state stays JSON serializable. */
export type HexId = `${number},${number}`;
export interface Hex { q: number; r: number }
export type ShotArea = 'three' | 'midrange' | 'rim';
export interface CourtCell extends Hex { id: HexId; area: ShotArea; underRim: boolean; paint: boolean }

export const RIM: HexId = '0,0';
export const CHECK_POSITIONS: { offense: HexId[]; defense: HexId[] } = {
  offense: ['-2,4', '-4,3', '1,3'], defense: ['-1,3', '-3,2', '1,2'],
};
// Squared Euclidean radius in axial units: q² + qr + r².
export const THREE_DISTANCE_SQUARED = 9.72;
const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const hexKey = ({ q, r }: Hex): HexId => `${q},${r}`;
export function parseHex(id: HexId): Hex {
  if (!/^-?\d+,-?\d+$/.test(id)) throw new Error('Invalid hex coordinate');
  const [q, r] = id.split(',').map(Number);
  if (!Number.isSafeInteger(q) || !Number.isSafeInteger(r)) throw new Error('Invalid hex coordinate');
  return { q, r };
}

/** Cube distance: s = -q-r. No pixel distances are used for movement/coverage. */
export function hexDistance(a: Hex, b: Hex): number {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r));
}

export function classifyHex(hex: Hex): ShotArea {
  if (hexDistance(hex, { q: 0, r: 0 }) <= 1) return 'rim';
  // A cell whose center lies on the arc is a two; only strictly outside is three.
  return (hex.q ** 2 + hex.q * hex.r + hex.r ** 2) > THREE_DISTANCE_SQUARED
    ? 'three' : 'midrange';
}

function buildCells(): Record<HexId, CourtCell> {
  const cells: Record<HexId, CourtCell> = {};
  for (let r = 0; r <= 6; r++) for (let q = -7; q <= 4; q++) {
    // Whole pointy-top hexes fit inside the half-court rectangle.
    if (Math.abs(q + r / 2) > 4) continue;
    const id = hexKey({ q, r });
    cells[id] = { q, r, id, area: classifyHex({ q, r }), underRim: id === RIM,
      paint: r <= 2 && Math.abs(q + r / 2) <= 1.5 };
  }
  return cells;
}
export const CELLS = buildCells();

export function cell(id: HexId): CourtCell {
  if (!Object.hasOwn(CELLS, id)) throw new Error('Hex is outside the court');
  return CELLS[id];
}

export function neighbors(id: HexId): HexId[] {
  const origin = cell(id);
  return DIRECTIONS.map(d => hexKey({ q: origin.q + d.q, r: origin.r + d.r }))
    .filter(key => Object.hasOwn(CELLS, key));
}

export function distance(from: HexId, to: HexId): number {
  return hexDistance(cell(from), cell(to));
}

export const COURT: Record<HexId, HexId[]> = Object.fromEntries(
  Object.keys(CELLS).map(id => [id, neighbors(id as HexId)]),
);

export function cellLabel(id: HexId): string {
  const c = cell(id);
  return `${c.underRim ? 'Under rim' : c.area === 'three' ? 'Three-point' : c.area === 'rim' ? 'At rim' : c.paint ? 'Paint' : 'Midrange'} (${c.q}, ${c.r})`;
}

