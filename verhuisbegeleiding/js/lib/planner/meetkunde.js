// Geometry for the furniture planner. World units are centimeters with the origin at the top left of the floor plan.
// Rotation r is in degrees, clockwise (the y axis points down), around the middle of the piece.
// A piece is { b, d } (width and depth in cm). A placement is { x, y, r } (the middle of the piece and its rotation).

export const OVERLAP_TOLERANTIE_CM = 0.5;

export function klem(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

/** Round to one decimal. */
export function r1(v) {
  return Math.round(v * 10) / 10;
}

/** Width and height of the box around a piece that is rotated by r degrees. */
export function bbox(m, r) {
  const a = (r * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { w: m.b * c + m.d * s, h: m.b * s + m.d * c };
}

/** The four corners of a placed piece in world coordinates. */
export function hoeken(m, p) {
  const a = (p.r * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hb = m.b / 2;
  const hd = m.d / 2;
  return [[-hb, -hd], [hb, -hd], [hb, hd], [-hb, hd]].map(([x, y]) => [p.x + x * c - y * s, p.y + x * s + y * c]);
}

/**
 * Separating axis test for two convex quadrilaterals. An overlap smaller than the tolerance does not count,
 * so two pieces that touch along an edge do not overlap.
 */
export function snijden(A, B, tolerantie = OVERLAP_TOLERANTIE_CM) {
  for (const poly of [A, B]) {
    for (let i = 0; i < 4; i += 1) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % 4];
      const nx = p1[1] - p2[1];
      const ny = p2[0] - p1[0];
      const len = Math.hypot(nx, ny) || 1;
      let a0 = Infinity;
      let a1 = -Infinity;
      let b0 = Infinity;
      let b1 = -Infinity;
      for (const [x, y] of A) {
        const d = x * nx + y * ny;
        if (d < a0) a0 = d;
        if (d > a1) a1 = d;
      }
      for (const [x, y] of B) {
        const d = x * nx + y * ny;
        if (d < b0) b0 = d;
        if (d > b1) b1 = d;
      }
      if (a1 - b0 < tolerantie * len || b1 - a0 < tolerantie * len) return false;
    }
  }
  return true;
}

/**
 * Which pieces overlap which. Rugs (vloerkleed) do not take part: a table on a rug is not a collision.
 * @param {{id: string, m: {b: number, d: number, naam: string, vloerkleed?: boolean}, p: {x: number, y: number, r: number}}[]} items
 * @returns {Map<string, string[]>} id to the names of the pieces it overlaps
 */
export function overlapMap(items) {
  const uit = new Map();
  const actief = items.filter((i) => !i.m.vloerkleed).map((i) => ({ ...i, c: hoeken(i.m, i.p) }));
  for (let i = 0; i < actief.length; i += 1) {
    for (let j = i + 1; j < actief.length; j += 1) {
      if (!snijden(actief[i].c, actief[j].c)) continue;
      if (!uit.has(actief[i].id)) uit.set(actief[i].id, []);
      if (!uit.has(actief[j].id)) uit.set(actief[j].id, []);
      uit.get(actief[i].id).push(actief[j].m.naam);
      uit.get(actief[j].id).push(actief[i].m.naam);
    }
  }
  return uit;
}

/** Normalise an angle to 0 up to (not including) 360, with one decimal. */
export function hoekNormaal(graden) {
  const n = ((graden % 360) + 360) % 360;
  const r = r1(n);
  return r >= 360 ? 0 : r;
}
