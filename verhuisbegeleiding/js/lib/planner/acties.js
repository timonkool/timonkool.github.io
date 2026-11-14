// Changes to a planner project: placing, moving and rotating pieces, the list of furniture, versions and floor plans.
// All functions change the project they get (the interface draws it again afterwards) and return what happened.
// Nothing here touches the page or the storage, so everything can be tested.

import { hoekNormaal, klem, r1 } from './meetkunde.js';
import { KLEUREN, LIMIETEN, maakVersie, normMeubel, normPlattegrond, schoonNaam } from './model.js';
import { afmetingenCm } from './schaal.js';

export const actieveVersie = (project) => project.versies.find((v) => v.id === project.actief) ?? null;
export const plattegrondVan = (project, id) => project.plattegronden.find((f) => f.id === id) ?? null;
export const meubelVan = (project, id) => project.meubels.find((m) => m.id === id) ?? null;

function raak(project, versie, nu) {
  if (versie) versie.gewijzigd = nu;
  project.gewijzigd = nu;
}

/** How many pieces of the active version are placed, and how many there are in total. */
export function tel(project) {
  const v = actieveVersie(project);
  const geplaatst = v ? project.meubels.filter((m) => v.plaatsing[m.id]).length : 0;
  return { geplaatst, totaal: project.meubels.length };
}

/**
 * Put a piece on a floor plan in the active version, at the given spot (cm) or a little to the side when that spot is taken.
 * @returns the placement, or null when the piece, the floor plan or the version does not exist
 */
export function plaats(project, meubelId, plattegrondId, midden, nu = Date.now()) {
  const v = actieveVersie(project);
  const m = meubelVan(project, meubelId);
  const f = plattegrondVan(project, plattegrondId);
  if (!v || !m || !f) return null;
  const { W, H } = afmetingenCm(f);
  let x = klem(midden.x, 0, W);
  let y = klem(midden.y, 0, H);
  const buren = Object.values(v.plaatsing).filter((p) => p.p === f.id);
  for (let i = 0; i < 12 && buren.some((o) => Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 12); i += 1) {
    x = klem(x + 22, 0, W);
    y = klem(y + 22, 0, H);
  }
  v.plaatsing[m.id] = { p: f.id, x: r1(x), y: r1(y), r: 0 };
  raak(project, v, nu);
  return v.plaatsing[m.id];
}

export function haalWeg(project, meubelId, nu = Date.now()) {
  const v = actieveVersie(project);
  if (!v || !v.plaatsing[meubelId]) return false;
  delete v.plaatsing[meubelId];
  raak(project, v, nu);
  return true;
}

export function draaiMet(project, meubelId, graden, nu = Date.now()) {
  const v = actieveVersie(project);
  const p = v?.plaatsing[meubelId];
  if (!p) return null;
  p.r = hoekNormaal(p.r + graden);
  raak(project, v, nu);
  return p;
}

export function zetDraaiing(project, meubelId, graden, nu = Date.now()) {
  const v = actieveVersie(project);
  const p = v?.plaatsing[meubelId];
  if (!p || !Number.isFinite(graden)) return null;
  p.r = hoekNormaal(graden);
  raak(project, v, nu);
  return p;
}

/** Move a placed piece to (x, y), kept inside the floor plan. */
export function verplaatsNaar(project, meubelId, x, y, nu = Date.now()) {
  const v = actieveVersie(project);
  const p = v?.plaatsing[meubelId];
  const f = p && plattegrondVan(project, p.p);
  if (!f) return null;
  const { W, H } = afmetingenCm(f);
  p.x = r1(klem(x, 0, W));
  p.y = r1(klem(y, 0, H));
  raak(project, v, nu);
  return p;
}

// Furniture

function volgendeVolgorde(project) {
  return project.meubels.reduce((mx, m) => Math.max(mx, m.volgorde), 0) + 1;
}

/** Add a piece. Sizes in cm. The color follows the number of pieces, so a new piece gets a color of its own. */
export function voegMeubelToe(project, { naam, b, d, h = 0, vloerkleed = false }, nu = Date.now()) {
  if (project.meubels.length >= LIMIETEN.meubels) return null;
  const m = normMeubel({ naam, b, d, h, vloerkleed, kleur: KLEUREN[project.meubels.length % KLEUREN.length].id, volgorde: volgendeVolgorde(project) });
  if (!m) return null;
  project.meubels.push(m);
  project.gewijzigd = nu;
  return m;
}

/** Add the rows of a pasted list. Returns the number of pieces that were added. */
export function voegLijstToe(project, rijen, nu = Date.now()) {
  let aantal = 0;
  for (const r of rijen) if (voegMeubelToe(project, r, nu)) aantal += 1;
  return aantal;
}

/** Change a piece. An example piece that is edited is no longer an example. */
export function wijzigMeubel(project, id, wijziging, nu = Date.now()) {
  const i = project.meubels.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const nieuw = normMeubel({ ...project.meubels[i], ...wijziging, id, voorbeeld: false });
  if (!nieuw) return null;
  project.meubels[i] = nieuw;
  project.gewijzigd = nu;
  return nieuw;
}

export function verwijderMeubel(project, id, nu = Date.now()) {
  const i = project.meubels.findIndex((m) => m.id === id);
  if (i < 0) return false;
  project.meubels.splice(i, 1);
  for (const v of project.versies) delete v.plaatsing[id];
  project.gewijzigd = nu;
  return true;
}

// Versions

export function nieuweVersie(project, naam, { kopie = true } = {}, nu = Date.now()) {
  if (project.versies.length >= LIMIETEN.versies) return null;
  const basis = actieveVersie(project);
  const v = maakVersie(naam, nu, kopie && basis ? structuredClone(basis.plaatsing) : {});
  project.versies.push(v);
  project.actief = v.id;
  project.gewijzigd = nu;
  return v;
}

export function hernoemVersie(project, id, naam, nu = Date.now()) {
  const v = project.versies.find((x) => x.id === id);
  if (!v) return null;
  v.naam = schoonNaam(naam, v.naam);
  raak(project, v, nu);
  return v;
}

export function kiesVersie(project, id) {
  if (!project.versies.some((v) => v.id === id)) return false;
  project.actief = id;
  return true;
}

/** Remove a version. The last version cannot be removed. */
export function verwijderVersie(project, id, nu = Date.now()) {
  if (project.versies.length < 2) return false;
  const i = project.versies.findIndex((v) => v.id === id);
  if (i < 0) return false;
  project.versies.splice(i, 1);
  if (project.actief === id) project.actief = [...project.versies].sort((a, b) => b.gewijzigd - a.gewijzigd)[0].id;
  project.gewijzigd = nu;
  return true;
}

// Floor plans

export function voegPlattegrondToe(project, gegevens, nu = Date.now()) {
  if (project.plattegronden.length >= LIMIETEN.plattegronden) return null;
  const f = normPlattegrond(gegevens);
  if (!f || project.plattegronden.some((x) => x.id === f.id)) return null;
  project.plattegronden.push(f);
  project.gewijzigd = nu;
  return f;
}

/** Rename a floor plan or change its scale. Pieces that end up outside a smaller plan are pulled back inside. */
export function wijzigPlattegrond(project, id, { naam, k }, nu = Date.now()) {
  const f = plattegrondVan(project, id);
  if (!f) return null;
  if (naam !== undefined) f.naam = schoonNaam(naam, f.naam);
  if (k !== undefined) {
    const proef = normPlattegrond({ ...f, k });
    if (!proef) return null;
    f.k = proef.k;
    const { W, H } = afmetingenCm(f);
    for (const v of project.versies) {
      for (const p of Object.values(v.plaatsing)) {
        if (p.p !== id) continue;
        p.x = r1(klem(p.x, 0, W));
        p.y = r1(klem(p.y, 0, H));
      }
    }
  }
  project.gewijzigd = nu;
  return f;
}

export function verwijderPlattegrond(project, id, nu = Date.now()) {
  const i = project.plattegronden.findIndex((f) => f.id === id);
  if (i < 0) return false;
  project.plattegronden.splice(i, 1);
  for (const v of project.versies) {
    for (const [meubelId, p] of Object.entries(v.plaatsing)) if (p.p === id) delete v.plaatsing[meubelId];
  }
  project.gewijzigd = nu;
  return true;
}
