// Intake and filtering (TL-01, overzicht 2.2 en 2.3): from the answers to flags, active parts and current moments,
// and which items are active for that combination. Pure functions, no DOM.
//
// Answers shape:
//   { doen: ['kopen', 'verkopen'], woning: 'appartement', koopwijze: ['samen'], gezin: ['kinderen'],
//     momenten: { K: 'bieden', V: 'te_koop' }, datums: { verhuisdatum: '2026-11-15' } }
// "Weet ik nog niet" is an absent answer (null, undefined or an empty list).

import { isDatum, pasOffsetToe } from './datum.js';

export function alsLijst(waarde) {
  if (waarde === undefined || waarde === null || waarde === '') return [];
  return Array.isArray(waarde) ? waarde : [waarde];
}

export function voorwaardeVoldaan(voorwaarde, flags) {
  const negatie = String(voorwaarde).startsWith('!');
  const naam = negatie ? String(voorwaarde).slice(1) : String(voorwaarde);
  return negatie ? !flags.has(naam) : flags.has(naam);
}

export function voorwaardenVoldaan(voorwaarden, flags) {
  return (voorwaarden ?? []).every((v) => voorwaardeVoldaan(v, flags));
}

function vraagZichtbaar(vraag, flags) {
  const regel = vraag.tonen_als;
  if (!regel) return true;
  if (regel.een_van_flags) return regel.een_van_flags.some((f) => flags.has(f));
  return true;
}

/** Flags that are on, from the answers. Questions that are not shown ignore their answers. */
export function flagsUitIntake(model, antwoorden) {
  const flags = new Set();
  for (const vraag of model.intake.vragen) {
    if (vraag.id === 'datums' || !vraag.antwoorden) continue;
    if (!vraagZichtbaar(vraag, flags)) continue;
    const gekozen = vraag.meerdere ? alsLijst(antwoorden?.[vraag.id]) : alsLijst(antwoorden?.[vraag.id]).slice(0, 1);
    for (const id of gekozen) {
      const antwoord = vraag.antwoorden.find((a) => a.id === id);
      if (antwoord?.flag) flags.add(antwoord.flag);
    }
  }
  if (flags.has('kopen') && flags.has('verkopen')) flags.add('doorstromer');
  return flags;
}

/** Active parts: the ones chosen in question 1, plus the parts that are always on (the move itself). */
export function actieveSporen(model, antwoorden, nietVanToepassing = []) {
  const uit = new Set();
  for (const [spoor, def] of Object.entries(model.sporen)) if (def.altijd_actief) uit.add(spoor);
  const vraag = model.intake.vragen.find((v) => v.id === 'doen');
  for (const id of alsLijst(antwoorden?.doen)) {
    const antwoord = vraag.antwoorden.find((a) => a.id === id);
    if (antwoord?.spoor) uit.add(antwoord.spoor);
  }
  for (const spoor of nietVanToepassing) uit.delete(spoor);
  return uit;
}

/** Current moment per active part: the one the user chose, else the first moment of the part. */
export function beginMomenten(model, antwoorden, sporen) {
  const uit = {};
  for (const spoor of sporen) {
    const momenten = model.sporen[spoor].momenten.map((m) => m.id);
    const gekozen = antwoorden?.momenten?.[spoor];
    uit[spoor] = momenten.includes(gekozen) ? gekozen : momenten[0];
  }
  return uit;
}

/**
 * For a part that follows a date (the move itself, `volgt_datum` in the model): the moment that fits today.
 * Without that date it is the moment marked `begin`. Later moments start at their `vanaf`, counted from the date.
 * Returns null for a part that does not follow a date.
 */
export function momentUitDatum(def, datums, vandaag) {
  if (!def?.volgt_datum) return null;
  const start = def.momenten.find((m) => m.begin) ?? def.momenten[0];
  const datum = datums?.[def.volgt_datum];
  if (!isDatum(datum) || !isDatum(vandaag)) return start.id;
  let uit = start.id;
  for (const m of def.momenten) {
    if (m.vanaf !== undefined && pasOffsetToe(datum, m.vanaf) <= vandaag) uit = m.id;
  }
  return uit;
}

/**
 * Everything the filters need, in one object. `momenten` from the state overrides the intake choice.
 * With `datums` and `vandaag`, a part that follows a date starts at the moment that fits today,
 * unless the user chose a moment in the intake or on the dashboard.
 */
export function maakContext(model, antwoorden, { momenten, nietVanToepassing = [], datums, vandaag } = {}) {
  const flags = flagsUitIntake(model, antwoorden);
  const sporen = actieveSporen(model, antwoorden, nietVanToepassing);
  const begin = beginMomenten(model, antwoorden, sporen);
  if (datums !== undefined) {
    for (const spoor of sporen) {
      const gekozen = antwoorden?.momenten?.[spoor];
      if (model.sporen[spoor].momenten.some((m) => m.id === gekozen)) continue;
      begin[spoor] = momentUitDatum(model.sporen[spoor], datums, vandaag) ?? begin[spoor];
    }
  }
  const huidig = { ...begin };
  for (const spoor of sporen) {
    const kandidaat = momenten?.[spoor];
    if (kandidaat && model.sporen[spoor].momenten.some((m) => m.id === kandidaat)) huidig[spoor] = kandidaat;
  }
  return { flags, sporen, momenten: huidig };
}

/** The part and moment pairs of an item that are active for this context. */
export function actieveParen(item, ctx) {
  const paren = [];
  for (const spoor of item.spoor ?? []) {
    if (!ctx.sporen.has(spoor)) continue;
    const momenten = item.moment ?? [];
    if (momenten.length === 0 || momenten.includes(ctx.momenten[spoor])) paren.push({ spoor, moment: ctx.momenten[spoor] });
  }
  return paren;
}

/** An item is active when one of its parts is active in the right moment and all its conditions hold. */
export function itemActief(item, ctx) {
  return voorwaardenVoldaan(item.voorwaarden, ctx.flags) && actieveParen(item, ctx).length > 0;
}

/** Items that fit the parts and flags of the user at any moment. Used for the lists that are not moment specific. */
export function itemRelevant(item, ctx) {
  return voorwaardenVoldaan(item.voorwaarden, ctx.flags) && (item.spoor ?? []).some((s) => ctx.sporen.has(s) || s === 'alle' || s === 'over');
}

/**
 * The screens of the intake for the answers so far (D-037). Question 1 is split: first what you are going to do,
 * then one short screen per chosen part with the moments. After that the other questions that apply.
 * @returns {{soort: 'doen'|'moment'|'keuze'|'datums', vraag: object, spoor?: string}[]}
 */
export function intakeSchermen(model, antwoorden) {
  const flags = flagsUitIntake(model, antwoorden);
  const schermen = [];
  for (const vraag of model.intake.vragen) {
    if (!vraagZichtbaar(vraag, flags)) continue;
    if (vraag.id === 'doen') {
      schermen.push({ soort: 'doen', vraag });
      const gekozen = new Set(alsLijst(antwoorden?.doen));
      for (const a of vraag.antwoorden) if (gekozen.has(a.id) && model.sporen[a.spoor]) schermen.push({ soort: 'moment', vraag, spoor: a.spoor });
    } else if (vraag.id === 'datums') schermen.push({ soort: 'datums', vraag });
    else schermen.push({ soort: 'keuze', vraag });
  }
  return schermen;
}

/**
 * The date fields the intake asks for: the dates of the chosen parts and of the parts that are always on.
 * A date with `vanaf_moment` is left out while the chosen moment of its part is earlier, because the date
 * cannot exist yet. Without a chosen moment ("weet ik nog niet") the field is shown.
 */
export function intakeDatums(model, antwoorden) {
  const sporen = actieveSporen(model, antwoorden);
  return model.ankers.filter((a) => {
    if (!a.intake || !sporen.has(a.spoor)) return false;
    if (!a.vanaf_moment) return true;
    const ids = model.sporen[a.spoor].momenten.map((m) => m.id);
    const gekozen = ids.indexOf(antwoorden?.momenten?.[a.spoor]);
    const vanaf = ids.indexOf(a.vanaf_moment);
    return gekozen < 0 || vanaf < 0 || gekozen >= vanaf;
  });
}

export function volgendMoment(model, spoor, huidig) {
  const ids = model.sporen[spoor].momenten.map((m) => m.id);
  const i = ids.indexOf(huidig);
  return i >= 0 && i < ids.length - 1 ? ids[i + 1] : null;
}

export function vorigMoment(model, spoor, huidig) {
  const ids = model.sporen[spoor].momenten.map((m) => m.id);
  const i = ids.indexOf(huidig);
  return i > 0 ? ids[i - 1] : null;
}
