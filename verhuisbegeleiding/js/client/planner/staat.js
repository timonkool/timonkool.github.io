// The shared state of the furniture planner page: the open project, the selection, the view, undo and saving.
// The other modules read and change S and call teken.* to draw again. Saving is automatic, 300 ms after a change.

import { maakPlannerOpslag } from '../../lib/planner/opslag.js';
import { actieveVersie } from '../../lib/planner/acties.js';

export const opslag = maakPlannerOpslag();

const VOORKEUR = 'vb:planner:voorkeur';

function leesVoorkeur() {
  try {
    const v = JSON.parse(localStorage.getItem(VOORKEUR) ?? '{}');
    return { magneet: v.magneet !== false, raster: v.raster === true, overlap: v.overlap !== false };
  } catch {
    return { magneet: true, raster: false, overlap: true };
  }
}

export function bewaarVoorkeur() {
  try {
    localStorage.setItem(VOORKEUR, JSON.stringify({ magneet: S.magneet, raster: S.raster, overlap: S.overlap }));
  } catch {
    // preferences are a convenience only
  }
}

export const S = {
  index: null,
  project: null,
  plattegrondId: null,
  sel: null,
  views: {},
  cw: 0,
  ch: 0,
  ...leesVoorkeur(),
  ongedaan: [],
  opnieuw: [],
  tab: 'meubels',
  zoek: '',
  bewerken: null,
  bevestig: null,
  formulier: null,
  hernoemen: false,
  status: { soort: 'ok', tekst: '' },
  vuil: false,
  aangeraakt: false,
  timer: null,
  paneelAchterstand: false,
  bericht: null,
  opslagMelding: null,
  modus: 'werkblad',
  schaalDoel: null,
};

/** Functions that draw parts of the page. planner.js fills these in. */
export const teken = {
  alles() {},
  werkblad() {},
  selectie() {},
  paneel() {},
  kop() {},
  status() {},
};

export const versie = () => (S.project ? actieveVersie(S.project) : null);
export const plattegrond = () => S.project?.plattegronden.find((f) => f.id === S.plattegrondId) ?? null;

export function zetStatus(soort, tekst = '') {
  S.status = { soort, tekst };
  teken.status();
}

const STATUS_TEKST = { ok: 'Opgeslagen', bezig: 'Bewaren...', lokaal: 'Niet bewaard' };

export function statusTekst() {
  return S.status.tekst || STATUS_TEKST[S.status.soort] || '';
}

/** Something changed: save in 300 ms. aanraken = false for changes that are not a change of the layout itself. */
export function markeerVuil(aanraken = true) {
  S.vuil = true;
  if (aanraken) S.aangeraakt = true;
  zetStatus(opslag.beschikbaar ? 'bezig' : 'lokaal');
  clearTimeout(S.timer);
  S.timer = setTimeout(flush, 300);
}

/** After every change of the project: save soon and draw everything again. */
export function naBewerking() {
  markeerVuil();
  const v = versie();
  if (S.sel && !v?.plaatsing[S.sel]) S.sel = null;
  teken.alles();
}

export function flush() {
  clearTimeout(S.timer);
  if (!S.vuil || !S.project) return true;
  S.vuil = false;
  S.aangeraakt = false;
  S.project.gewijzigd = Date.now();
  const r = opslag.bewaarProject(S.project);
  if (r.ok) {
    S.opslagMelding = null;
    zetStatus('ok');
    return true;
  }
  S.vuil = true;
  S.opslagMelding = r.melding;
  zetStatus(opslag.beschikbaar ? 'fout' : 'lokaal', r.kort);
  return false;
}

// Undo: a snapshot of the placements of the active version, the last 80 changes.

export function momentopname() {
  const v = versie();
  return v ? JSON.stringify(v.plaatsing) : '{}';
}

export function bewaarVoorOngedaan(voor) {
  S.ongedaan.push(voor);
  if (S.ongedaan.length > 80) S.ongedaan.shift();
  S.opnieuw.length = 0;
}

export function wisGeschiedenis() {
  S.ongedaan = [];
  S.opnieuw = [];
}

function zetPlaatsing(tekst) {
  const v = versie();
  if (v) v.plaatsing = JSON.parse(tekst);
}

export function ongedaanMaken() {
  if (!versie() || !S.ongedaan.length) return false;
  S.opnieuw.push(momentopname());
  zetPlaatsing(S.ongedaan.pop());
  return true;
}

export function opnieuwDoen() {
  if (!versie() || !S.opnieuw.length) return false;
  S.ongedaan.push(momentopname());
  zetPlaatsing(S.opnieuw.pop());
  return true;
}
