// The furniture planner (TL-04): put your furniture on your own floor plan, to scale.
// Everything happens in the browser. The floor plan pictures are not uploaded anywhere.

import { h } from '../dom.js';
import { overlapMap } from '../../lib/planner/meetkunde.js';
import { tel } from '../../lib/planner/acties.js';
import { donatieBlok } from '../donatie.js';
import { bewaarVoorkeur, flush, opslag, S, statusTekst, teken, versie } from './staat.js';
import { kiesPlattegrond, maakWerkblad, passendMaken, tekenHint, tekenItems, tekenLabel, zetRaster, zoomMet } from './werkblad.js';
import { maakSelectiebalk, tekenSelectie, ikoon, samenvatting } from './selectie.js';
import { maakPaneel, tekenPaneel } from './paneel.js';
import { doeOngedaan, doeOpnieuw, toetsenbord } from './bewerken.js';
import { openProject, startPlattegrond, voorbeeldToevoegen } from './projecten.js';

const IKONEN = {
  ongedaan: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 0 11H11'],
  opnieuw: ['m15 14 5-5-5-5', 'M20 9H9.5a5.5 5.5 0 0 0 0 11H13'],
  in: ['M12 5v14M5 12h14'],
  uit: ['M5 12h14'],
  passend: ['M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'],
  magneet: ['M5 14V8a7 7 0 0 1 14 0v6h-4V8a3 3 0 0 0-6 0v6z', 'M5 18h4M15 18h4'],
  raster: ['M4 4h16v16H4zM4 12h16M12 4v16'],
  overlap: ['M5.5 4h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 14.5v-9A1.5 1.5 0 0 1 5.5 4z', 'M10.5 9h9a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 10.5 9z'],
};

let elProjectNaam;
let elVersieNaam;
let elStatus;
let elVloeren;
let elGereedschap;
let elStage;
let elWelkom;
let elWerk;
let elDonatie;
let elSamenvatting;

const gereedschapKnop = (naam, label, ikoonNaam, bijKlik, { pressed } = {}) =>
  h('button', { type: 'button', class: 'ib', 'data-tool': naam, 'aria-label': label, title: label, ...(pressed !== undefined ? { 'aria-pressed': String(pressed) } : {}), onclick: bijKlik }, ikoon(...IKONEN[ikoonNaam]));

function maakGereedschap() {
  const sep = () => h('span', { class: 'sep', 'aria-hidden': 'true' });
  return h('div', { class: 'tools', id: 'tools', role: 'group', 'aria-label': 'Gereedschap' },
    gereedschapKnop('ongedaan', 'Ongedaan maken (Ctrl+Z)', 'ongedaan', doeOngedaan),
    gereedschapKnop('opnieuw', 'Opnieuw (Ctrl+Shift+Z)', 'opnieuw', doeOpnieuw),
    sep(),
    gereedschapKnop('in', 'Inzoomen', 'in', () => zoomMet(1.3)),
    gereedschapKnop('uit', 'Uitzoomen', 'uit', () => zoomMet(1 / 1.3)),
    gereedschapKnop('passend', 'Hele plattegrond tonen', 'passend', passendMaken),
    sep(),
    gereedschapKnop('magneet', 'Magneet: uitlijnen op raster, andere meubels en 15 graden', 'magneet', () => { S.magneet = !S.magneet; bewaarVoorkeur(); tekenGereedschap(); }, { pressed: S.magneet }),
    gereedschapKnop('raster', 'Raster van 50 cm tonen', 'raster', () => { S.raster = !S.raster; bewaarVoorkeur(); zetRaster(); tekenGereedschap(); }, { pressed: S.raster }),
    gereedschapKnop('overlap', 'Overlap markeren', 'overlap', () => { S.overlap = !S.overlap; bewaarVoorkeur(); tekenItems(); tekenSelectie(); tekenGereedschap(); }, { pressed: S.overlap }));
}

function tekenGereedschap() {
  const zet = (naam, aan) => elGereedschap.querySelector(`[data-tool=${naam}]`)?.setAttribute('aria-pressed', String(aan));
  zet('magneet', S.magneet);
  zet('raster', S.raster);
  zet('overlap', S.overlap);
  elGereedschap.querySelector('[data-tool=ongedaan]').disabled = !S.ongedaan.length;
  elGereedschap.querySelector('[data-tool=opnieuw]').disabled = !S.opnieuw.length;
}

function tekenPlattegronden() {
  const v = versie();
  elVloeren.replaceChildren(...(S.project?.plattegronden ?? []).map((f) => {
    const n = v ? S.project.meubels.filter((m) => v.plaatsing[m.id]?.p === f.id).length : 0;
    return h('button', { type: 'button', ...(f.id === S.plattegrondId ? { 'aria-current': 'true' } : {}), onclick: () => kiesPlattegrond(f.id) },
      h('span', { class: 'fn' }, f.naam), h('span', { class: 'n' }, String(n)));
  }));
}

function tekenKop() {
  elProjectNaam.textContent = S.project?.naam ?? 'Geen project';
  elVersieNaam.textContent = versie()?.naam ?? 'Geen versie';
  tekenLabel();
}

function tekenStatus() {
  elStatus.textContent = statusTekst();
  elStatus.className = `status ${S.status.soort}`;
  elStatus.title = S.status.soort === 'ok' ? 'Bewaard in deze browser, op dit apparaat' : '';
}

function heeftOverlap() {
  const v = versie();
  if (!v) return false;
  return S.project.plattegronden.some((f) => {
    const lijst = S.project.meubels.filter((m) => v.plaatsing[m.id]?.p === f.id).map((m) => ({ id: m.id, m, p: v.plaatsing[m.id] }));
    return overlapMap(lijst).size > 0;
  });
}

/** The donation block shows when every piece is placed without overlap, in a project of your own. */
function tekenDonatie() {
  elDonatie.replaceChildren();
  if (!S.project || S.project.voorbeeld) return;
  const { geplaatst, totaal } = tel(S.project);
  if (totaal === 0 || geplaatst !== totaal || heeftOverlap()) return;
  const blok = donatieBlok({ id: 'donatie-planner', tekst: 'Je hebt alle meubels geplaatst, zonder overlap.' });
  if (blok) elDonatie.append(blok);
}

function tekenModus() {
  const heeft = Boolean(S.project);
  const schaal = S.modus === 'schaal';
  elWelkom.hidden = heeft;
  elWerk.hidden = !heeft;
  elStage.hidden = schaal;
  S.schaalDoel.hidden = !schaal;
}

function tekenAlles() {
  tekenModus();
  if (!S.project) return;
  tekenKop();
  tekenPlattegronden();
  tekenGereedschap();
  tekenHint();
  tekenItems();
  tekenSelectie();
  tekenPaneel();
  tekenDonatie();
  elSamenvatting.textContent = samenvatting();
}

function maakWelkom() {
  const bestand = h('input', { type: 'file', accept: 'image/*', id: 'welkom-bestand', class: 'verborgen-invoer', onchange: (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) startPlattegrond(f);
  } });
  return h('section', { class: 'welkom', id: 'welkom', hidden: true },
    h('h2', null, 'Zet je meubels op schaal op je eigen plattegrond'),
    h('ol', null,
      h('li', null, 'Kies een afbeelding van de plattegrond van je woning: een foto, een schermafbeelding of een bestand.'),
      h('li', null, 'Geef met twee punten aan hoe groot de plattegrond is.'),
      h('li', null, 'Voeg je meubels toe met hun maten en sleep ze op hun plek.')),
    h('p', { class: 'kleiner' }, 'Alles blijft op dit apparaat. De afbeelding wordt niet verstuurd.'),
    h('p', { class: 'note', id: 'welkom-melding', role: 'status' }),
    h('div', { class: 'knoppen' },
      h('label', { class: 'knop bestandsknop' }, 'Plattegrond kiezen', bestand),
      h('button', { type: 'button', class: 'knop knop-rustig', id: 'welkom-voorbeeld', onclick: () => voorbeeldToevoegen() }, 'Bekijk eerst het voorbeeld')));
}

function bouw(root) {
  elProjectNaam = h('b');
  elVersieNaam = h('b');
  elStatus = h('span', { class: 'status', role: 'status' });
  elVloeren = h('div', { class: 'floors', role: 'group', 'aria-label': 'Plattegrond' });
  elGereedschap = maakGereedschap();
  elDonatie = h('div');
  // A short text for people who do not see the drawing: how many pieces, and which ones overlap.
  elSamenvatting = h('p', { id: 'plan-samenvatting', class: 'visueel-verborgen', 'aria-live': 'polite' });
  S.schaalDoel = h('section', { class: 'schaalpaneel', id: 'schaalpaneel', hidden: true, 'aria-label': 'Schaal instellen' });
  const werkblad = maakWerkblad();
  elStage = h('section', { class: 'stage' }, h('div', { class: 'bar' }, elVloeren, elGereedschap), werkblad, elSamenvatting, maakSelectiebalk(), elDonatie);
  const paneel = maakPaneel();
  elWelkom = maakWelkom();
  elWerk = h('div', { class: 'work', hidden: true }, elStage, S.schaalDoel, paneel);
  const kop = h('div', { class: 'ptop' },
    h('button', { type: 'button', class: 'chip', onclick: () => { S.tab = 'project'; teken.paneel(); document.getElementById('spanel')?.focus(); } }, h('span', { class: 'k' }, 'Project'), elProjectNaam),
    h('button', { type: 'button', class: 'chip', onclick: () => { S.tab = 'versies'; teken.paneel(); document.getElementById('spanel')?.focus(); } }, h('span', { class: 'k' }, 'Versie'), elVersieNaam),
    elStatus);
  root.replaceChildren(kop, elWelkom, elWerk);
}

export function startPlanner() {
  const root = document.getElementById('planner');
  if (!root) return;
  teken.alles = tekenAlles;
  teken.werkblad = tekenItems;
  teken.selectie = tekenSelectie;
  teken.paneel = tekenPaneel;
  teken.kop = () => { tekenKop(); tekenPlattegronden(); };
  teken.status = tekenStatus;
  bouw(root);

  const r = opslag.leesIndex();
  S.index = r.index;
  if (r.status === 'geblokkeerd') S.status = { soort: 'lokaal', tekst: '' };
  const volgorde = [r.index.actief, ...r.index.projecten.map((p) => p.id)].filter(Boolean);
  let geopend = false;
  for (const id of new Set(volgorde)) {
    if (openProject(id)) {
      geopend = true;
      break;
    }
  }
  if (!geopend) tekenAlles();
  tekenStatus();

  document.addEventListener('keydown', toetsenbord);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', () => { flush(); });
  window.addEventListener('beforeunload', () => { flush(); });
}

startPlanner();
