/**
 * Affine fitting and page-rotation helpers for the GeoPDF parser.
 *
 * Coordinates are page points with the origin at the TOP-LEFT and y growing
 * DOWNWARD, which is what a rendered canvas produces. PDF user space is the
 * opposite (origin bottom-left, y up), so every caller converts on the way in.
 *
 * The 6-parameter model is the one GDAL fits from PDF ground control points:
 *
 *   X = a·px + c·py + e
 *   Y = b·px + d·py + f
 *
 * Fitting in the *source* CRS (not in degrees) matters: a projected CRS makes
 * the mapping non-affine once it is expressed as lon/lat, and GDAL's own
 * bounds only reproduce when the fit happens before the reprojection.
 */

/** 6-parameter affine: X = a·px + c·py + e, Y = b·px + d·py + f. */
export type Affine6 = [number, number, number, number, number, number];

/** One ground control point: page point (px, py) ↔ map coordinate (X, Y). */
export interface ControlPoint {
  px: number;
  py: number;
  X: number;
  Y: number;
}

/** Apply an affine to a page point. */
export function applyAffine(affine: Affine6, px: number, py: number): [number, number] {
  const [a, b, c, d, e, f] = affine;
  return [a * px + c * py + e, b * px + d * py + f];
}

/** Solve a 3×3 linear system with partial pivoting. Returns null when singular. */
function solve3(matrix: number[][], rhs: number[]): number[] | null {
  const m = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * Least-squares fit of the 6-parameter affine from control points.
 *
 * With exactly three non-collinear points the fit is exact; with more it is a
 * least-squares fit, which is what GDAL does when a PDF carries more GCPs.
 * Returns null for fewer than three points or a degenerate layout.
 */
export function fitAffine(points: ControlPoint[]): Affine6 | null {
  if (points.length < 3) return null;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sxx += p.px * p.px;
    sxy += p.px * p.py;
    syy += p.py * p.py;
    sx += p.px;
    sy += p.py;
  }
  const normal = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, points.length],
  ];

  const rhsX = [0, 0, 0];
  const rhsY = [0, 0, 0];
  for (const p of points) {
    rhsX[0] += p.px * p.X;
    rhsX[1] += p.py * p.X;
    rhsX[2] += p.X;
    rhsY[0] += p.px * p.Y;
    rhsY[1] += p.py * p.Y;
    rhsY[2] += p.Y;
  }

  const solX = solve3(normal, rhsX);
  const solY = solve3(normal, rhsY);
  if (!solX || !solY) return null;

  return [solX[0], solY[0], solX[1], solY[1], solX[2], solY[2]];
}

/**
 * Map a page point from unrotated page space into the rendered orientation.
 *
 * `/Rotate 90` turns the page clockwise for display, so the rendered raster is
 * height × width. Only corner ORDER depends on this; the set of geographic
 * corners is rotation-invariant, which is why bounds stay correct either way.
 */
export function rotatePoint(
  px: number,
  py: number,
  width: number,
  height: number,
  rotation: number,
): [number, number] {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  switch (normalized) {
    case 90:
      return [height - py, px];
    case 180:
      return [width - px, height - py];
    case 270:
      return [py, width - px];
    default:
      return [px, py];
  }
}

/** Rendered size after `/Rotate` is applied. */
export function rotatedSize(
  width: number,
  height: number,
  rotation: number,
): { width: number; height: number } {
  const normalized = ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
  return normalized === 90 || normalized === 270
    ? { width: height, height: width }
    : { width, height };
}
