// Validation of the saved state, of imported files and of share links. All three are untrusted input.
// The result is always a NEW object built from whitelisted parts. Nothing from the input is spread or merged,
// so keys like "__proto__" never end up in the state. Text that stays (labels) is stripped of control characters
// and angle brackets, and the interface shows it with textContent only.

import { isDatum } from './datum.js';

export const HUIDIGE_VERSIE = 1;
export const MAX_IDS = 2000;
export const MAX_DATUMS_PER_ANKER = 10;
const VERBODEN_SLEUTELS = new Set(['__proto__', 'constructor', 'prototype']);
const ID_PATROON = /^[A-Za-z0-9][A-Za-z0-9#._-]{0,39}$/;

/** The cost overview (TL-09): what the visitor filled in. Amounts are whole euros. */
export function leegKosten() {
  return { koopsom: null, situatie: null, leeftijdOk: false, nietEerderGebruikt: false, handmatig: null, hypotheek: null, nhg: false, posten: null, eigenGeld: null };
}

export const MAX_POSTEN = 40;
export const MAX_ZAKEN = 300;
export const MAX_STUKKEN = 200;
export const BESLUITEN = ['blijft', 'gaat_mee', 'bespreken'];

/** The list of things in the home (TL-08): what stays, what goes along, what still has to be discussed. */
function schoneZaken(lijst, problemen) {
  if (lijst === undefined || lijst === null) return [];
  if (!Array.isArray(lijst)) {
    problemen.push('De zakenlijst is genegeerd.');
    return [];
  }
  const uit = [];
  const gezien = new Set();
  for (const z of lijst.slice(0, MAX_ZAKEN)) {
    if (!isObject(z) || typeof z.id !== 'string' || !ID_PATROON.test(z.id) || gezien.has(z.id)) continue;
    const naam = schoonLabel(z.naam, 60);
    if (!naam) continue;
    gezien.add(z.id);
    uit.push({ id: z.id, naam, plek: schoonLabel(z.plek, 40), besluit: BESLUITEN.includes(z.besluit) ? z.besluit : 'bespreken', bod: z.bod === true, inspectie: z.inspectie === true, notitie: schoonLabel(z.notitie, 200) });
  }
  return uit;
}

/** My file (TL-07): documents, where they are and when they expire. */
function schoneStukken(lijst, problemen) {
  if (lijst === undefined || lijst === null) return [];
  if (!Array.isArray(lijst)) {
    problemen.push('Mijn dossier is genegeerd.');
    return [];
  }
  const uit = [];
  const gezien = new Set();
  for (const s of lijst.slice(0, MAX_STUKKEN)) {
    if (!isObject(s) || typeof s.id !== 'string' || !ID_PATROON.test(s.id) || gezien.has(s.id)) continue;
    const naam = schoonLabel(s.naam, 60);
    if (!naam) continue;
    gezien.add(s.id);
    uit.push({ id: s.id, naam, plek: schoonLabel(s.plek, 80), vervalt: isDatum(s.vervalt) ? s.vervalt : null, notitie: schoonLabel(s.notitie, 200) });
  }
  return uit;
}
const KOSTEN_SITUATIES = new Set(['zelf', 'niet_zelf', 'overig']);

function bedrag(x) {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1_000_000_000 ? Math.round(x) : null;
}

function schoneKosten(k, problemen) {
  const uit = leegKosten();
  if (k === undefined || k === null) return uit;
  if (!isObject(k)) {
    problemen.push('Het kostenoverzicht is genegeerd.');
    return uit;
  }
  uit.koopsom = bedrag(k.koopsom);
  uit.situatie = KOSTEN_SITUATIES.has(k.situatie) ? k.situatie : null;
  uit.leeftijdOk = k.leeftijdOk === true;
  uit.nietEerderGebruikt = k.nietEerderGebruikt === true;
  uit.handmatig = bedrag(k.handmatig);
  uit.hypotheek = bedrag(k.hypotheek);
  uit.nhg = k.nhg === true;
  uit.eigenGeld = bedrag(k.eigenGeld);
  // posten: null means that the visitor never changed the list, so the suggestions are shown. An empty list means: all removed.
  const gezien = new Set();
  if (Array.isArray(k.posten)) uit.posten = [];
  for (const p of Array.isArray(k.posten) ? k.posten.slice(0, MAX_POSTEN) : []) {
    if (!isObject(p) || typeof p.id !== 'string' || !ID_PATROON.test(p.id) || gezien.has(p.id)) continue;
    gezien.add(p.id);
    uit.posten.push({ id: p.id, label: schoonLabel(p.label, 60), bedrag: bedrag(p.bedrag) });
  }
  return uit;
}

export function leegState() {
  return {
    versie: HUIDIGE_VERSIE,
    intake: null,
    datums: {},
    momenten: {},
    nietVanToepassingSporen: [],
    afgevinkt: [],
    nietVanToepassing: [],
    overrides: {},
    instellingen: { tipsInAgenda: true },
    exportTeller: 0,
    laatstBewaard: null,
    laatstBestand: null,
    kosten: leegKosten(),
    zakenlijst: [],
    dossier: [],
  };
}

function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

/** Free text from the user: no control characters, no angle brackets, at most `max` characters. */
export function schoonLabel(waarde, max = 60) {
  if (typeof waarde !== 'string') return '';
  return [...waarde]
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c >= 32 && c !== 127 && ch !== '<' && ch !== '>';
    })
    .join('')
    .trim()
    .slice(0, max);
}

function ids(waarde, problemen, naam) {
  if (waarde === undefined) return [];
  if (!Array.isArray(waarde)) {
    problemen.push(`${naam} is geen lijst en is genegeerd.`);
    return [];
  }
  const uit = [];
  for (const x of waarde.slice(0, MAX_IDS)) {
    if (typeof x === 'string' && ID_PATROON.test(x) && !uit.includes(x)) uit.push(x);
  }
  if (waarde.length > MAX_IDS) problemen.push(`${naam} had meer dan ${MAX_IDS} items, de rest is genegeerd.`);
  return uit;
}

/**
 * @param {unknown} invoer
 * @param {{model: object}} opties the model in data/model.yaml
 * @returns {{ok: boolean, state: object|null, problemen: string[]}}
 */
export function valideerState(invoer, { model }) {
  const problemen = [];
  if (!isObject(invoer)) return { ok: false, state: null, problemen: ['Het bestand bevat geen geldige status.'] };
  const versie = invoer.versie === undefined ? 0 : invoer.versie;
  if (!Number.isInteger(versie) || versie < 0) return { ok: false, state: null, problemen: ['Het versienummer klopt niet.'] };
  if (versie > HUIDIGE_VERSIE) return { ok: false, state: null, problemen: ['Dit bestand komt uit een nieuwere versie van de site. Werk de site bij of vraag een nieuw bestand.'] };

  const state = leegState();

  // Intake
  if (isObject(invoer.intake)) {
    const intake = {};
    for (const vraag of model.intake.vragen) {
      if (vraag.id === 'datums' || !vraag.antwoorden) continue;
      const toegestaan = new Set(vraag.antwoorden.map((a) => a.id));
      const gekozen = (Array.isArray(invoer.intake[vraag.id]) ? invoer.intake[vraag.id] : invoer.intake[vraag.id] === undefined ? [] : [invoer.intake[vraag.id]]).filter((x) => typeof x === 'string' && toegestaan.has(x));
      if (gekozen.length) intake[vraag.id] = vraag.meerdere ? [...new Set(gekozen)] : gekozen[0];
    }
    if (isObject(invoer.intake.momenten)) {
      intake.momenten = {};
      for (const [spoor, def] of Object.entries(model.sporen)) {
        const m = invoer.intake.momenten[spoor];
        if (typeof m === 'string' && def.momenten.some((x) => x.id === m)) intake.momenten[spoor] = m;
      }
    }
    state.intake = intake;
  } else if (invoer.intake !== undefined && invoer.intake !== null) {
    problemen.push('De intake is genegeerd.');
  }

  // Dates by anchor
  if (isObject(invoer.datums)) {
    for (const anker of model.ankers) {
      const w = invoer.datums[anker.id];
      if (anker.meervoudig && Array.isArray(w)) {
        const lijst = w
          .slice(0, MAX_DATUMS_PER_ANKER)
          .filter((x) => isObject(x) && isDatum(x.waarde))
          .map((x) => ({ label: schoonLabel(x.label), waarde: x.waarde }));
        if (lijst.length) state.datums[anker.id] = lijst;
      } else if (isDatum(w)) {
        state.datums[anker.id] = anker.meervoudig ? [{ label: '', waarde: w }] : w;
      } else if (w !== undefined) {
        problemen.push(`De datum "${anker.naam}" klopte niet en is genegeerd.`);
      }
    }
  }

  // Moments and parts
  if (isObject(invoer.momenten)) {
    for (const [spoor, def] of Object.entries(model.sporen)) {
      const m = invoer.momenten[spoor];
      if (typeof m === 'string' && def.momenten.some((x) => x.id === m)) state.momenten[spoor] = m;
    }
  }
  state.nietVanToepassingSporen = ids(invoer.nietVanToepassingSporen, problemen, 'Onderdelen die niet van toepassing zijn').filter((s) => model.sporen[s] && !model.sporen[s].altijd_actief);

  // Checked tasks, tasks marked not applicable, manual dates
  state.afgevinkt = ids(invoer.afgevinkt, problemen, 'Afgevinkte taken');
  state.nietVanToepassing = ids(invoer.nietVanToepassing, problemen, 'Taken die niet van toepassing zijn');
  if (isObject(invoer.overrides)) {
    let n = 0;
    for (const sleutel of Object.keys(invoer.overrides)) {
      if (VERBODEN_SLEUTELS.has(sleutel) || !ID_PATROON.test(sleutel) || n >= MAX_IDS) continue;
      if (isDatum(invoer.overrides[sleutel])) {
        state.overrides[sleutel] = invoer.overrides[sleutel];
        n += 1;
      }
    }
  }

  // Cost overview, list of things in the home, my file
  state.kosten = schoneKosten(invoer.kosten, problemen);
  state.zakenlijst = schoneZaken(invoer.zakenlijst, problemen);
  state.dossier = schoneStukken(invoer.dossier, problemen);

  // Settings and counters
  if (isObject(invoer.instellingen) && typeof invoer.instellingen.tipsInAgenda === 'boolean') state.instellingen.tipsInAgenda = invoer.instellingen.tipsInAgenda;
  if (Number.isInteger(invoer.exportTeller) && invoer.exportTeller >= 0 && invoer.exportTeller <= 100000) state.exportTeller = invoer.exportTeller;
  for (const veld of ['laatstBewaard', 'laatstBestand']) {
    const w = invoer[veld];
    if (typeof w === 'string' && !Number.isNaN(Date.parse(w)) && w.length <= 40) state[veld] = w;
  }

  return { ok: true, state, problemen };
}

/** Migrations by the version they start from. Each takes a plain object and returns the next version. */
export const MIGRATIES = {
  0: (s) => ({ ...s, versie: 1 }),
};

export function migreer(invoer) {
  if (!isObject(invoer)) return invoer;
  let huidig = { ...invoer, versie: Number.isInteger(invoer.versie) ? invoer.versie : 0 };
  while (huidig.versie < HUIDIGE_VERSIE) {
    const stap = MIGRATIES[huidig.versie];
    if (!stap) break;
    huidig = stap(huidig);
  }
  return huidig;
}
