// Date engine (BC-02): turns the "tijd" of an item and the dates of the user into concrete dates.
// It only calculates what a source states (soort "wettelijk") or what follows from user data.
// Everything else is a tip ("richtlijn"), a date from the contract ("contractueel") or a date the user set ("ingevuld").
//
// State shape used here:
//   datums:    { verhuisdatum: '2026-11-15', aankoop_einde_voorwaarde: [{ label: 'Financiering', waarde: '2026-11-01' }] }
//   overrides: { 'CL-L2-01': '2026-11-10' }   key is the item id, or `${id}#${index}` when an item has several dates

import { isDatum, pasOffsetToe, verschilDagen } from './datum.js';

export const TIJDSOORTEN = ['wettelijk', 'contractueel', 'richtlijn', 'ingevuld'];

function ankerWaarden(datums, anker) {
  const w = datums?.[anker];
  if (Array.isArray(w)) {
    return w.filter((x) => isDatum(x?.waarde)).map((x) => ({ label: x.label ?? null, waarde: x.waarde }));
  }
  return isDatum(w) ? [{ label: null, waarde: w }] : [];
}

/**
 * Dates for one "tijd" object. One result per date of the anchor (an anchor like "einde ontbindende voorwaarde" can have several).
 * Without a known anchor the result says so ("onbekend") and has no dates.
 */
export function rekenTijd(tijd, datums) {
  if (!tijd || !tijd.soort || tijd.soort === 'ingevuld') return [];
  const waarden = ankerWaarden(datums, tijd.anker);
  if (waarden.length === 0) {
    return [{ soort: tijd.soort, anker: tijd.anker, label: null, van: null, tot: null, deadline: null, onbekend: true, handmatig: false, bron_id: tijd.bron_id ?? null }];
  }
  return waarden.map(({ label, waarde }) => {
    let van;
    let tot;
    if (tijd.venster) {
      van = pasOffsetToe(waarde, tijd.venster.van);
      tot = pasOffsetToe(waarde, tijd.venster.tot);
    } else if (tijd.offset !== undefined) {
      van = pasOffsetToe(waarde, tijd.offset);
      tot = van;
    } else {
      van = waarde;
      tot = waarde;
    }
    return { soort: tijd.soort, anker: tijd.anker, label, van, tot, deadline: tot, onbekend: false, handmatig: false, bron_id: tijd.bron_id ?? null };
  });
}

/**
 * Dates for an item including the dates the user set by hand.
 * A manual date keeps its mark and is never overwritten when an anchor changes (overzicht 6.1 en 6.6).
 */
export function rekenItem(item, state) {
  const basis = rekenTijd(item.tijd, state.datums);
  const overrides = state.overrides ?? {};
  const resultaten = basis.map((t, i) => {
    const sleutel = basis.length > 1 ? `${item.id}#${i}` : item.id;
    const eigen = overrides[sleutel];
    if (isDatum(eigen)) {
      return {
        ...t,
        sleutel,
        soort: 'ingevuld',
        van: eigen,
        tot: eigen,
        deadline: eigen,
        onbekend: false,
        handmatig: true,
        berekend: t.onbekend ? null : { van: t.van, tot: t.tot, deadline: t.deadline },
      };
    }
    return { ...t, sleutel };
  });
  if (resultaten.length === 0 && isDatum(overrides[item.id])) {
    const eigen = overrides[item.id];
    return [{ soort: 'ingevuld', anker: null, label: null, van: eigen, tot: eigen, deadline: eigen, onbekend: false, handmatig: true, berekend: null, bron_id: null, sleutel: item.id }];
  }
  return resultaten;
}

/** The first known deadline of an item, or null. */
export function deadlineVan(item, state) {
  const bekend = rekenItem(item, state).filter((r) => r.deadline);
  if (bekend.length === 0) return null;
  return bekend.map((r) => r.deadline).sort()[0];
}

/**
 * When an anchor moves (for example the transfer slips two weeks), recalculate and report (overzicht 6.6):
 * - aangepast: calculated dates that moved,
 * - gelaten: manual dates that stay, with the new calculated date so the user can choose to switch,
 * - nieuw: items that now have a date because an anchor was filled in.
 */
export function verschuiving(items, oud, nieuw) {
  const aangepast = [];
  const gelaten = [];
  const nieuwBekend = [];
  const overrides = nieuw.overrides ?? oud.overrides ?? {};
  for (const item of items) {
    if (!item.tijd) continue;
    const voor = rekenItem(item, { datums: oud.datums, overrides: {} });
    const na = rekenItem(item, { datums: nieuw.datums, overrides: {} });
    na.forEach((n, i) => {
      const v = voor[i];
      const sleutel = na.length > 1 ? `${item.id}#${i}` : item.id;
      if (n.onbekend) return;
      if (!v || v.onbekend) {
        nieuwBekend.push({ itemId: item.id, sleutel, titel: item.titel, naar: n.deadline });
        return;
      }
      if (v.deadline === n.deadline) return;
      const eigen = overrides[sleutel];
      if (isDatum(eigen)) gelaten.push({ itemId: item.id, sleutel, titel: item.titel, handmatig: eigen, berekendNu: n.deadline, verschilDagen: verschilDagen(v.deadline, n.deadline) });
      else aangepast.push({ itemId: item.id, sleutel, titel: item.titel, van: v.deadline, naar: n.deadline, verschilDagen: verschilDagen(v.deadline, n.deadline) });
    });
  }
  return { aangepast, gelaten, nieuw: nieuwBekend };
}

/** The user chooses to switch a manual date back to the calculated one. Returns new overrides. */
export function wisselNaarBerekend(overrides, sleutel) {
  const uit = { ...overrides };
  delete uit[sleutel];
  return uit;
}

/** The user sets a date by hand. Throws on an invalid date. */
export function zetHandmatig(overrides, sleutel, datum) {
  if (!isDatum(datum)) throw new Error(`Geen geldige datum: ${String(datum)}`);
  return { ...overrides, [sleutel]: datum };
}
