// Storage in the browser (overzicht 9.1): a version number, migration, try/catch around every read and write,
// a message when it fails, and export and import as the safety net. Safari can wipe script-written storage after
// seven days without use (SRC-013), and some environments block storage altogether.

import { HUIDIGE_VERSIE, leegState, migreer, valideerState } from './schema.js';

export const SLEUTEL = 'vb:status';
export const MAX_IMPORT_TEKENS = 1_000_000;

/**
 * @param {{storage?: Storage|null, sleutel?: string, nu?: () => Date}} [opties]
 *        storage defaults to localStorage when it is reachable. Pass a fake in tests.
 */
export function maakOpslag({ storage, sleutel = SLEUTEL, nu = () => new Date() } = {}) {
  let bron = storage;
  if (bron === undefined) {
    try {
      bron = globalThis.localStorage ?? null;
    } catch {
      bron = null; // reading the property itself can throw when storage is blocked
    }
  }
  let geheugen = null;

  return {
    /** Load the state. Always returns a usable state, plus a message when something went wrong. */
    laad(model) {
      let ruw;
      try {
        ruw = bron ? bron.getItem(sleutel) : null;
        if (!bron) return { state: geheugen ?? leegState(), status: 'geblokkeerd', melding: 'Je browser laat geen opslag toe. Je gegevens blijven alleen staan zolang deze pagina open is. Bewaar ze regelmatig als bestand.' };
      } catch {
        return { state: geheugen ?? leegState(), status: 'geblokkeerd', melding: 'Je browser laat geen opslag toe. Je gegevens blijven alleen staan zolang deze pagina open is. Bewaar ze regelmatig als bestand.' };
      }
      if (ruw === null) return { state: leegState(), status: 'leeg', melding: null };
      let json;
      try {
        json = JSON.parse(ruw);
      } catch {
        return { state: leegState(), status: 'beschadigd', melding: 'Je opgeslagen gegevens waren beschadigd en zijn niet geladen. Heb je een bewaard bestand, importeer dat dan.' };
      }
      const r = valideerState(migreer(json), { model });
      if (!r.ok) return { state: leegState(), status: 'beschadigd', melding: r.problemen[0] };
      return { state: r.state, status: 'geladen', melding: r.problemen.length ? `Een deel van je gegevens kon niet worden gelezen: ${r.problemen[0]}` : null };
    },

    /** Save the state. Never throws. */
    bewaar(state) {
      const met = { ...state, versie: HUIDIGE_VERSIE, laatstBewaard: nu().toISOString() };
      geheugen = met;
      if (!bron) return { ok: false, melding: 'Niet bewaard: je browser laat geen opslag toe. Bewaar je gegevens als bestand.' };
      try {
        bron.setItem(sleutel, JSON.stringify(met));
        return { ok: true, melding: null, laatstBewaard: met.laatstBewaard };
      } catch (err) {
        const vol = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
        return { ok: false, melding: vol ? 'Niet bewaard: de opslag in je browser is vol. Bewaar je gegevens als bestand.' : 'Niet bewaard: je browser gaf een fout. Bewaar je gegevens als bestand.' };
      }
    },

    wis() {
      geheugen = null;
      try {
        bron?.removeItem(sleutel);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The whole state as a file the user can save. */
export function exporteer(state, nu = new Date()) {
  return JSON.stringify({ app: 'verhuisbegeleiding', formaat: 1, geexporteerd: nu.toISOString(), status: { ...state, versie: HUIDIGE_VERSIE } }, null, 2);
}

/** Read an exported file. Returns { ok, state, problemen }. Wrong size, wrong JSON or a wrong shape never throws. */
export function importeer(tekst, model) {
  if (typeof tekst !== 'string' || tekst.length === 0) return { ok: false, state: null, problemen: ['Het bestand is leeg.'] };
  if (tekst.length > MAX_IMPORT_TEKENS) return { ok: false, state: null, problemen: ['Het bestand is te groot om een bewaarde status te zijn.'] };
  let json;
  try {
    json = JSON.parse(tekst);
  } catch {
    return { ok: false, state: null, problemen: ['Het bestand is geen geldige status (geen leesbare JSON).'] };
  }
  const inhoud = json && typeof json === 'object' && json.app === 'verhuisbegeleiding' && json.status ? json.status : json;
  return valideerState(migreer(inhoud), { model });
}
