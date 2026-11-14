// Storage of the furniture planner in the browser. Every project has its own key ("opslagsleutel per project"), plus a small
// index with the names, so a change rewrites one project and not everything. All reads and writes sit in try/catch and
// give a message in Dutch when they fail. Storage can be blocked, full or emptied by the browser.

import { LIMIETEN, nieuwId, normProject, schoonId, schoonNaam, vingerafdruk, VERSIE } from './model.js';
import { leesExport } from './uitwisseling.js';

export const INDEX_SLEUTEL = 'vb:planner:index';
export const PROJECT_VOORVOEGSEL = 'vb:planner:p:';

export const MELDING_GEBLOKKEERD = 'Je browser laat hier geen opslag toe, dus wat je doet blijft niet bewaard. Exporteer je werk regelmatig als bestand.';
const MELDING_VOL = 'Opslag vol. Verwijder een project of een plattegrond, of exporteer je werk als bestand.';
const MELDING_MISLUKT = 'Bewaren mislukt. Exporteer je werk als bestand.';

function leegIndex() {
  return { v: VERSIE, actief: null, projecten: [] };
}

/**
 * @param {{storage?: Storage|null}} [opties] storage defaults to localStorage when it is reachable. Pass a fake in tests.
 */
export function maakPlannerOpslag({ storage } = {}) {
  let bron = storage;
  if (bron === undefined) {
    try {
      bron = globalThis.localStorage ?? null;
    } catch {
      bron = null; // even reading the property can throw when storage is blocked
    }
  }
  let index = leegIndex();

  const lees = (sleutel) => {
    try {
      return bron ? bron.getItem(sleutel) : null;
    } catch {
      return null;
    }
  };
  const schrijf = (sleutel, tekst) => {
    if (!bron) return { ok: false, melding: MELDING_GEBLOKKEERD, kort: 'Niet bewaard' };
    try {
      bron.setItem(sleutel, tekst);
      return { ok: true, melding: null };
    } catch (err) {
      const vol = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
      return { ok: false, melding: vol ? MELDING_VOL : MELDING_MISLUKT, kort: vol ? 'Opslag vol' : 'Bewaren mislukt' };
    }
  };
  const bewaarIndex = () => schrijf(INDEX_SLEUTEL, JSON.stringify(index));

  const schoneIndex = (ruw) => {
    const uit = leegIndex();
    if (!ruw || typeof ruw !== 'object') return uit;
    const gezien = new Set();
    for (const p of Array.isArray(ruw.projecten) ? ruw.projecten.slice(0, LIMIETEN.projecten) : []) {
      const id = schoonId(p?.id);
      if (!id || gezien.has(id) || id === '__proto__') continue;
      gezien.add(id);
      uit.projecten.push({ id, naam: schoonNaam(p.naam, 'Mijn woning'), gewijzigd: Number.isFinite(p.gewijzigd) ? p.gewijzigd : 0 });
    }
    const actief = schoonId(ruw.actief);
    uit.actief = gezien.has(actief) ? actief : (uit.projecten[0]?.id ?? null);
    return uit;
  };

  /** When the index is gone but projects are still there, rebuild the index from the keys. */
  const herbouwIndex = () => {
    const uit = leegIndex();
    try {
      for (let i = 0; i < bron.length && uit.projecten.length < LIMIETEN.projecten; i += 1) {
        const sleutel = bron.key(i);
        if (!sleutel?.startsWith(PROJECT_VOORVOEGSEL)) continue;
        const p = leesProjectUitSleutel(sleutel);
        if (p) uit.projecten.push({ id: p.id, naam: p.naam, gewijzigd: p.gewijzigd });
      }
    } catch {
      // keep what we have
    }
    uit.actief = uit.projecten[0]?.id ?? null;
    return uit;
  };

  function leesProjectUitSleutel(sleutel) {
    const ruw = lees(sleutel);
    if (ruw === null) return null;
    let json;
    try {
      json = JSON.parse(ruw);
    } catch {
      schrijf(`${sleutel}.defect`, ruw); // keep the broken text, so nothing is lost
      return null;
    }
    const p = normProject(json);
    if (!p) return null;
    p.id = sleutel.slice(PROJECT_VOORVOEGSEL.length);
    return p;
  }

  /** Save a project and put it in the index. A new project becomes the active one. */
  function bewaarProject(project) {
    const nieuw = !index.projecten.some((x) => x.id === project.id);
    if (nieuw && index.projecten.length >= LIMIETEN.projecten) return { ok: false, melding: `Je hebt al ${LIMIETEN.projecten} projecten. Verwijder er een om een nieuw project te maken.` };
    const r = schrijf(PROJECT_VOORVOEGSEL + project.id, JSON.stringify(project));
    if (!r.ok) return r;
    const entry = { id: project.id, naam: project.naam, gewijzigd: project.gewijzigd };
    const i = index.projecten.findIndex((x) => x.id === project.id);
    if (i >= 0) index.projecten[i] = entry;
    else index.projecten.push(entry);
    if (nieuw || !index.actief) index.actief = project.id;
    return bewaarIndex();
  }

  return {
    get beschikbaar() {
      return bron !== null;
    },

    /** @returns {{index: object, status: 'leeg'|'geladen'|'hersteld'|'geblokkeerd', melding: string|null}} */
    leesIndex() {
      if (!bron) return { index: (index = leegIndex()), status: 'geblokkeerd', melding: MELDING_GEBLOKKEERD };
      const ruw = lees(INDEX_SLEUTEL);
      if (ruw !== null) {
        try {
          index = schoneIndex(JSON.parse(ruw));
          return { index, status: index.projecten.length ? 'geladen' : 'leeg', melding: null };
        } catch {
          // fall through to rebuilding
        }
      }
      const herbouwd = herbouwIndex();
      if (herbouwd.projecten.length) {
        index = herbouwd;
        bewaarIndex();
        return { index, status: 'hersteld', melding: 'De lijst met projecten was kwijt en is hersteld.' };
      }
      return { index: (index = leegIndex()), status: 'leeg', melding: null };
    },

    /** The project, or null when it is not there or cannot be read. A project that cannot be read leaves the index. */
    leesProject(id) {
      const p = leesProjectUitSleutel(PROJECT_VOORVOEGSEL + schoonId(id));
      if (!p) {
        const i = index.projecten.findIndex((x) => x.id === schoonId(id));
        if (i >= 0) {
          index.projecten.splice(i, 1);
          if (index.actief === schoonId(id)) index.actief = index.projecten[0]?.id ?? null;
          bewaarIndex();
        }
      }
      return p;
    },

    bewaarProject,

    zetActief(id) {
      if (!index.projecten.some((x) => x.id === id)) return false;
      index.actief = id;
      bewaarIndex();
      return true;
    },

    verwijderProject(id) {
      const i = index.projecten.findIndex((x) => x.id === id);
      if (i < 0) return false;
      index.projecten.splice(i, 1);
      if (index.actief === id) index.actief = index.projecten[0]?.id ?? null;
      try {
        bron?.removeItem(PROJECT_VOORVOEGSEL + id);
      } catch {
        // the index no longer points to it; a leftover key is harmless
      }
      bewaarIndex();
      return true;
    },

    /**
     * Import an export as a NEW project. Nothing that exists is changed. The same export a second time gives no second project.
     * @returns {{ok: boolean, melding: string, project?: object, dubbel?: boolean}}
     */
    importeer(tekst) {
      const r = leesExport(tekst);
      if (!r.ok) return { ok: false, melding: r.problemen[0] };
      const sig = vingerafdruk(r.project);
      for (const entry of index.projecten) {
        const bestaand = leesProjectUitSleutel(PROJECT_VOORVOEGSEL + entry.id);
        if (bestaand && vingerafdruk(bestaand) === sig) return { ok: true, dubbel: true, project: bestaand, melding: 'Dit project staat hier al. Er is niets toegevoegd.' };
      }
      const naamBezet = index.projecten.some((x) => x.naam === r.project.naam);
      const project = { ...r.project, id: nieuwId('p'), naam: naamBezet ? schoonNaam(`${r.project.naam} (import)`) : r.project.naam, gewijzigd: Date.now() };
      const b = bewaarProject(project);
      if (!b.ok) return { ok: false, melding: b.melding };
      return { ok: true, project, melding: `Project "${project.naam}" is toegevoegd.${r.problemen.length ? ` ${r.problemen.join(' ')}` : ''}` };
    },
  };
}
