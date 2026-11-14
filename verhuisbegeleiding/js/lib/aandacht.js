// "Nu aandacht" and the order of the dashboard (overzicht 5.3). No AI, only rules:
//   1. expired deadlines first,
//   2. then deadlines inside their warning period (14 days unless the item says otherwise),
//   3. then open P1 items of an active moment,
//   4. fewer than three? Fill up with P2 items of the active moment,
//   5. at most three. When there are more, report how many ("en nog N").
// P3 items never appear here. An expired tip ("richtlijn") is not an expired deadline: it is just an open task.

import { verschilDagen } from './datum.js';
import { rekenItem } from './tijd.js';
import { itemActief } from './intake.js';

export const STANDAARD_WAARSCHUWING = 14;
export const MAX_AANDACHT = 3;
/** Order of the parts when everything else is equal: purchase, sale, new rental, current rental, the move itself. */
export const SPOOR_VOLGORDE = ['K', 'V', 'H', 'O', 'L'];

function vroegste(item, state) {
  const resultaten = rekenItem(item, state).filter((r) => r.deadline && !r.onbekend);
  if (resultaten.length === 0) return null;
  return resultaten.sort((a, b) => (a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0))[0];
}

function opDatumDanPrio(a, b) {
  if (a.deadline !== b.deadline) {
    if (a.deadline === null) return 1;
    if (b.deadline === null) return -1;
    return a.deadline < b.deadline ? -1 : 1;
  }
  return a.item.prio - b.item.prio || (a.item.id < b.item.id ? -1 : 1);
}

/**
 * @param {object[]} items flat list of tasks with id, titel, prio, spoor, moment, voorwaarden, tijd, waarschuwing_dagen
 * @param {{datums?: object, overrides?: object, afgevinkt?: string[], nietVanToepassing?: string[]}} state
 * @param {{flags: Set<string>, sporen: Set<string>, momenten: Record<string,string>}} ctx
 * @param {string} vandaag
 * @returns {{items: {item: object, reden: 'verlopen'|'deadline'|'p1'|'p2', deadline: string|null, soort: string|null, dagen: number|null}[], meer: number}}
 */
export function nuAandacht(items, state, ctx, vandaag) {
  const afgevinkt = new Set(state.afgevinkt ?? []);
  const verborgen = new Set(state.nietVanToepassing ?? []);
  const verlopen = [];
  const binnenTermijn = [];
  const p1 = [];
  const p2 = [];

  for (const item of items) {
    if (item.prio === 3 || afgevinkt.has(item.id) || verborgen.has(item.id) || !itemActief(item, ctx)) continue;
    const r = vroegste(item, state);
    const termijn = item.waarschuwing_dagen ?? STANDAARD_WAARSCHUWING;
    const kandidaat = { item, deadline: r?.deadline ?? null, soort: r?.soort ?? null, dagen: r ? verschilDagen(vandaag, r.deadline) : null };
    const isDeadline = r && r.soort !== 'richtlijn';
    if (isDeadline && kandidaat.dagen < 0) verlopen.push({ ...kandidaat, reden: 'verlopen' });
    else if (r && kandidaat.dagen >= 0 && kandidaat.dagen <= termijn) binnenTermijn.push({ ...kandidaat, reden: 'deadline' });
    else if (item.prio === 1) p1.push({ ...kandidaat, reden: 'p1' });
    else p2.push({ ...kandidaat, reden: 'p2' });
  }

  const groepen = [verlopen, binnenTermijn, p1].map((g) => g.sort(opDatumDanPrio));
  p2.sort(opDatumDanPrio);
  const kern = groepen.flat();
  const lijst = kern.length >= MAX_AANDACHT ? kern : [...kern, ...p2.slice(0, MAX_AANDACHT - kern.length)];
  const totaal = kern.length >= MAX_AANDACHT ? kern.length : kern.length + p2.length;
  const getoond = lijst.slice(0, MAX_AANDACHT);
  return { items: getoond, meer: Math.max(0, totaal - getoond.length) };
}

/**
 * The order of the moments on the dashboard: the moment with the most open P1 items first.
 * Inside a moment the tasks are sorted by priority and then by date (see `sorteerTaken`).
 */
export function dashboardVolgorde(items, state, ctx) {
  const afgevinkt = new Set(state.afgevinkt ?? []);
  const verborgen = new Set(state.nietVanToepassing ?? []);
  const rijen = [...ctx.sporen].map((spoor) => {
    const moment = ctx.momenten[spoor];
    const taken = items.filter((i) => (i.spoor ?? []).includes(spoor) && (i.moment ?? []).includes(moment) && itemActief(i, ctx) && !verborgen.has(i.id));
    const open = taken.filter((i) => !afgevinkt.has(i.id));
    return { spoor, moment, aantal: taken.length, open: open.length, openP1: open.filter((i) => i.prio === 1).length };
  });
  return rijen.sort((a, b) => b.openP1 - a.openP1 || b.open - a.open || SPOOR_VOLGORDE.indexOf(a.spoor) - SPOOR_VOLGORDE.indexOf(b.spoor));
}

/** Tasks of one moment: priority first, then date (undated last), then id. */
export function sorteerTaken(taken, state) {
  return taken
    .map((item) => {
      const r = vroegste(item, state);
      return { item, deadline: r?.deadline ?? null };
    })
    .sort((a, b) => a.item.prio - b.item.prio || opDatumDanPrio(a, b))
    .map((x) => x.item);
}

/** Progress for a list of item ids: items marked "niet van toepassing" do not count. */
export function voortgang(ids, state) {
  const afgevinkt = new Set(state.afgevinkt ?? []);
  const verborgen = new Set(state.nietVanToepassing ?? []);
  const telbaar = ids.filter((id) => !verborgen.has(id));
  const klaar = telbaar.filter((id) => afgevinkt.has(id)).length;
  return { totaal: telbaar.length, klaar, procent: telbaar.length ? Math.round((klaar / telbaar.length) * 100) : 0 };
}
