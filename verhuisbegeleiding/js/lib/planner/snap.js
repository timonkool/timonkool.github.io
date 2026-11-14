// The magnet of the furniture planner: aligns a piece on a grid of 5 cm and on the edges of other pieces,
// and clicks the rotation on steps of 15 degrees. Without the magnet a rotation still clicks on multiples of 90 degrees.

import { bbox, hoekNormaal, r1 } from './meetkunde.js';

export const RASTER_CM = 5;
export const DRAAI_STAP_MET_MAGNEET = 15;
export const DRAAI_VANGST_MET_MAGNEET = 6;
export const DRAAI_VANGST_ZONDER_MAGNEET = 3;

/**
 * Where a piece lands when it is dragged to (x, y).
 * @param {{m: object, p: {r: number}, x: number, y: number, anderen: {m: object, p: object}[], drempel: number, magneet?: boolean}} o
 *        anderen: the other pieces on this floor plan (without rugs). drempel: how close an edge must be, in cm.
 */
export function snapPositie({ m, p, x, y, anderen, drempel, magneet = true }) {
  if (!magneet) return { x: r1(x), y: r1(y) };
  const bb = bbox(m, p.r);
  const xs = [];
  const ys = [];
  for (const o of anderen) {
    const ob = bbox(o.m, o.p.r);
    xs.push(o.p.x - ob.w / 2, o.p.x + ob.w / 2);
    ys.push(o.p.y - ob.h / 2, o.p.y + ob.h / 2);
  }
  const trek = (begin, maat, kandidaten) => {
    let beste = null;
    for (const kant of [begin, begin + maat]) {
      for (const c of kandidaten) {
        const d = c - kant;
        if (Math.abs(d) < drempel && (beste === null || Math.abs(d) < Math.abs(beste))) beste = d;
      }
    }
    return beste === null ? Math.round(begin / RASTER_CM) * RASTER_CM : begin + beste;
  };
  const links = trek(x - bb.w / 2, bb.w, xs);
  const boven = trek(y - bb.h / 2, bb.h, ys);
  return { x: links + bb.w / 2, y: boven + bb.h / 2 };
}

/** The rotation after dragging the handle to the angle a (degrees). */
export function snapDraai(a, magneet = true) {
  const n = hoekNormaal(a);
  if (magneet) {
    const stap = Math.round(n / DRAAI_STAP_MET_MAGNEET) * DRAAI_STAP_MET_MAGNEET;
    return hoekNormaal(Math.abs(stap - n) < DRAAI_VANGST_MET_MAGNEET ? stap : n);
  }
  const kwart = Math.round(n / 90) * 90;
  return hoekNormaal(Math.abs(kwart - n) < DRAAI_VANGST_ZONDER_MAGNEET ? kwart : n);
}
