import { cell, THREE_DISTANCE_SQUARED } from '../src/court.js';
import type { Hex, HexId } from '../src/court.js';

export const HEX_SIZE = 50;
export const THREE_RADIUS = HEX_SIZE * Math.sqrt(3 * THREE_DISTANCE_SQUARED);
export const RIM_ORIGIN = { x: 450, y: 120 };

export function hexToPixel({ q, r }: Hex): { x: number; y: number } {
  return { x: RIM_ORIGIN.x + HEX_SIZE * Math.sqrt(3) * (q + r / 2), y: RIM_ORIGIN.y + HEX_SIZE * 1.5 * r };
}

export function polygonPoints(id: HexId): string {
  const center = hexToPixel(cell(id));
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (60 * i - 30) * Math.PI / 180;
    return `${center.x + HEX_SIZE * Math.cos(angle)},${center.y + HEX_SIZE * Math.sin(angle)}`;
  }).join(' ');
}
