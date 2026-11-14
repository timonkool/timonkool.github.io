// Export and import of a planner project as a file or as text. The file carries the floor plan pictures, otherwise it would
// not work on another device. An import is untrusted input: size and shape are checked and the project is rebuilt from
// known fields only (see model.js).

import { LIMIETEN, normProject, VERSIE } from './model.js';

export const APP_NAAM = 'verhuisbegeleiding-planner';

/**
 * @param {object} project
 * @param {{versieIds?: string[]|null, nu?: Date}} [opties] versieIds: only these versions, null for all of them
 * @returns {string} JSON text
 */
export function maakExport(project, { versieIds = null, nu = new Date() } = {}) {
  const kopie = structuredClone(project);
  if (versieIds) {
    kopie.versies = kopie.versies.filter((v) => versieIds.includes(v.id));
    if (!kopie.versies.some((v) => v.id === kopie.actief)) kopie.actief = kopie.versies[0]?.id;
  }
  return JSON.stringify({ app: APP_NAAM, formaat: VERSIE, gemaakt: nu.toISOString(), project: kopie });
}

/**
 * Read an export. The text may have other text around it (for example when it was pasted from a mail).
 * @returns {{ok: true, project: object, problemen: string[]} | {ok: false, project: null, problemen: string[]}}
 */
export function leesExport(tekst) {
  const mislukt = (bericht) => ({ ok: false, project: null, problemen: [bericht] });
  if (typeof tekst !== 'string' || !tekst.trim()) return mislukt('Er is niets om te importeren.');
  if (tekst.length > LIMIETEN.importTekens) return mislukt('Dit bestand is te groot voor een export van de planner.');
  const a = tekst.indexOf('{');
  const b = tekst.lastIndexOf('}');
  let json = null;
  if (a >= 0 && b > a) {
    try {
      json = JSON.parse(tekst.slice(a, b + 1));
    } catch {
      json = null;
    }
  }
  if (!json || typeof json !== 'object' || json.app !== APP_NAAM || !json.project) {
    return mislukt('Dit lijkt geen export van de meubelplanner. Plak de hele tekst of kies het bestand.');
  }
  if (Number.isInteger(json.formaat) && json.formaat > VERSIE) {
    return mislukt('Dit bestand komt uit een nieuwere versie van de site. Werk de site bij of vraag een nieuw bestand.');
  }
  const project = normProject(json.project);
  if (!project) return mislukt('Dit lijkt geen export van de meubelplanner. Plak de hele tekst of kies het bestand.');
  const problemen = [];
  const bron = Array.isArray(json.project.plattegronden) ? json.project.plattegronden.length : 0;
  if (bron > project.plattegronden.length) problemen.push(`${bron - project.plattegronden.length} plattegrond(en) konden niet worden gelezen en zijn overgeslagen.`);
  return { ok: true, project, problemen };
}
