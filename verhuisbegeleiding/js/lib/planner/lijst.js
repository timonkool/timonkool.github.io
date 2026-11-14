// Pasting a list of furniture: one piece per line with name, width, depth and optionally height,
// separated by a tab, semicolon, vertical bar or two spaces. Pasting from Excel or Google Sheets works as it is.

import { r1 } from './meetkunde.js';

export const MAX_LIJST_RIJEN = 500;
export const MAX_MAAT_CM = 2000;
const FACTOR = { cm: 1, m: 100, mm: 0.1 };

/** One number from a cell like "210", "2,10", "210 cm". NaN when there is nothing to read. */
export function leesGetal(cel) {
  const t = String(cel).replace(/[^\d,.-]/g, '').replace(',', '.');
  return t === '' ? Number.NaN : Number.parseFloat(t);
}

/**
 * @param {string} tekst
 * @param {'cm'|'m'|'mm'} [eenheid] the unit of the sizes in the text
 * @returns {{rijen: {naam: string, b: number, d: number, h: number}[], overgeslagen: number}} sizes in centimeters
 */
export function parseLijst(tekst, eenheid = 'cm') {
  const f = FACTOR[eenheid] ?? 1;
  const rijen = [];
  let overgeslagen = 0;
  for (const regel of String(tekst).split(/\r?\n/)) {
    if (!regel.trim() || !/\d/.test(regel)) continue;
    if (rijen.length >= MAX_LIJST_RIJEN) {
      overgeslagen += 1;
      continue;
    }
    let delen = regel.split(/\t|;|\|/).map((s) => s.trim());
    if (delen.length < 3) delen = regel.split(/\s{2,}/).map((s) => s.trim());
    const getallen = delen.slice(1).map(leesGetal);
    const b = getallen[0] * f;
    const d = getallen[1] * f;
    const h = getallen[2] * f;
    if (delen.length < 3 || !delen[0] || !(b > 0) || !(d > 0) || b > MAX_MAAT_CM || d > MAX_MAAT_CM) {
      overgeslagen += 1;
      continue;
    }
    rijen.push({ naam: delen[0].slice(0, 60), b: r1(b), d: r1(d), h: h > 0 && h <= MAX_MAAT_CM ? r1(h) : 0 });
  }
  return { rijen, overgeslagen };
}
