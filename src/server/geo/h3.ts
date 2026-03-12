import { latLngToCell, gridDisk, gridDistance, cellToBoundary } from "h3-js";

export const H3_RESOLUTION = 7; // ~1.22km edge, ~5.16 km² area

/**
 * Compute H3 cell index from coordinates.
 */
export function computeH3Index(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

/**
 * Get all H3 cells within `k` rings of a center point.
 * Returns the center cell + surrounding rings.
 */
export function getNearbyCells(
  lat: number,
  lng: number,
  k: number,
): string[] {
  const centerCell = latLngToCell(lat, lng, H3_RESOLUTION);
  return gridDisk(centerCell, k);
}

/**
 * Check if a cell is within hop count range of another cell.
 * Returns true if gridDistance <= hopCount.
 */
export function isWithinReach(
  cellA: string,
  cellB: string,
  hopCount: number,
): boolean {
  try {
    return gridDistance(cellA, cellB) <= hopCount;
  } catch {
    // gridDistance throws if cells are too far apart (different base cells)
    return false;
  }
}

/**
 * Get polygon boundaries for a set of H3 cells.
 * Returns an array of [lat, lng][] polygons for map visualization.
 */
export function getCellBoundaries(
  cells: string[],
): Array<[number, number][]> {
  return cells.map((cell) =>
    cellToBoundary(cell).map(([lat, lng]) => [lat, lng] as [number, number]),
  );
}

/**
 * Get all cells and their boundaries for a coverage area.
 * Useful for admin visualization.
 */
export function getCoverageArea(
  lat: number,
  lng: number,
  hopCount: number,
): { cells: string[]; boundaries: Array<[number, number][]>; centerCell: string } {
  const centerCell = latLngToCell(lat, lng, H3_RESOLUTION);
  const cells = gridDisk(centerCell, hopCount);
  const boundaries = getCellBoundaries(cells);
  return { cells, boundaries, centerCell };
}
