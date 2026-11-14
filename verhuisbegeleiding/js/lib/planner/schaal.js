// The scale of a floor plan: the visitor clicks two points on the picture and says how far apart they are in reality.
// k is the number of picture pixels per centimeter. The planner works in centimeters, so the plan is pw / k wide.

export const MIN_K = 0.05;
export const MAX_K = 20;
export const MIN_AFSTAND_PX = 10;

const FACTOR = { cm: 1, m: 100, mm: 0.1 };

/** A distance as typed by the visitor ("3,5" in meters) in centimeters. NaN when it is not a usable number. */
export function afstandInCm(waarde, eenheid = 'cm') {
  const getal = Number.parseFloat(String(waarde).replace(',', '.'));
  const f = FACTOR[eenheid];
  if (!f || !Number.isFinite(getal) || getal <= 0) return Number.NaN;
  return getal * f;
}

/**
 * @param {{x: number, y: number}} a point in picture pixels
 * @param {{x: number, y: number}} b point in picture pixels
 * @param {number} cm the real distance between the points
 * @returns {{ok: true, k: number} | {ok: false, reden: string}}
 */
export function schaalUitPunten(a, b, cm) {
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(cm > 0)) return { ok: false, reden: 'Vul in hoe ver de twee punten in het echt van elkaar liggen.' };
  if (px < MIN_AFSTAND_PX) return { ok: false, reden: 'De twee punten liggen te dicht bij elkaar. Kies punten die verder uit elkaar liggen.' };
  const k = px / cm;
  if (k < MIN_K || k > MAX_K) return { ok: false, reden: 'Met deze afstand klopt de schaal niet. Controleer de afstand en de eenheid.' };
  return { ok: true, k };
}

/** Size of the floor plan in centimeters. */
export function afmetingenCm(plattegrond) {
  return { W: plattegrond.pw / plattegrond.k, H: plattegrond.ph / plattegrond.k };
}
