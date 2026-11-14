// Projects of the furniture planner (one project is one home): open, create, remove, import, and adding a floor plan.

import { leegProject } from '../../lib/planner/model.js';
import { voorbeeldProject } from '../../lib/planner/voorbeeld.js';
import { voegPlattegrondToe, wijzigPlattegrond } from '../../lib/planner/acties.js';
import { maakExport } from '../../lib/planner/uitwisseling.js';
import { deelOfDownload } from '../bestand.js';
import { flush, naBewerking, opslag, S, teken, versie, wisGeschiedenis, zetStatus } from './staat.js';
import { kiesPlattegrond, laadPlattegrond, passendMaken } from './werkblad.js';
import { leesAfbeelding, toonSchaalstap } from './schaalstap.js';

/** Show a short message in the panel. It goes away by itself. */
export function meld(tekst) {
  S.bericht = { tekst, t: Date.now() };
  const welkom = document.getElementById('welkom-melding');
  if (welkom) welkom.textContent = tekst;
  teken.paneel();
  setTimeout(() => {
    if (S.bericht && Date.now() - S.bericht.t >= 7500) {
      S.bericht = null;
      teken.paneel();
    }
  }, 8000);
}

function toon(project) {
  S.project = project;
  S.sel = null;
  S.views = {};
  S.bewerken = null;
  S.bevestig = null;
  S.formulier = null;
  S.hernoemen = false;
  S.modus = 'werkblad';
  wisGeschiedenis();
  S.plattegrondId = project.plattegronden[0]?.id ?? null;
  laadPlattegrond();
  teken.alles();
}

/** Open the project with this id. Returns false when it cannot be read. */
export function openProject(id) {
  flush();
  const p = opslag.leesProject(id);
  if (!p) {
    S.index = opslag.leesIndex().index;
    meld('Dit project kon niet worden gelezen.');
    return false;
  }
  opslag.zetActief(id);
  S.index = opslag.leesIndex().index;
  toon(p);
  return true;
}

/** Make a project and open it. A project that cannot be saved still works for this visit. */
function maakEnOpen(project) {
  flush();
  const r = opslag.bewaarProject(project);
  S.index = opslag.leesIndex().index;
  if (!r.ok) {
    S.opslagMelding = r.melding;
    zetStatus(opslag.beschikbaar ? 'fout' : 'lokaal', r.kort);
  }
  toon(project);
  return r;
}

export function nieuwProject(naam) {
  return maakEnOpen(leegProject(naam?.trim() || 'Mijn woning'));
}

export function voorbeeldToevoegen() {
  return maakEnOpen(voorbeeldProject());
}

export function verwijderProject(id) {
  const huidig = S.project?.id === id;
  opslag.verwijderProject(id);
  S.index = opslag.leesIndex().index;
  if (!huidig) {
    teken.paneel();
    return;
  }
  const volgende = S.index.projecten[0]?.id;
  S.project = null;
  if (volgende && openProject(volgende)) return;
  S.sel = null;
  S.plattegrondId = null;
  wisGeschiedenis();
  laadPlattegrond();
  teken.alles();
}

export function importeerTekst(tekst) {
  flush();
  const r = opslag.importeer(tekst);
  S.index = opslag.leesIndex().index;
  if (r.ok && r.project) toon(r.project);
  return r;
}

export async function exporteerProject(versieIds = null) {
  flush();
  const tekst = maakExport(S.project, { versieIds });
  const naam = versieIds ? `meubelplanner-${versie()?.naam ?? 'indeling'}` : `meubelplanner-${S.project.naam}`;
  const schoon = naam.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'indeling';
  return deelOfDownload({ tekst, naam: `${schoon}.json`, titel: 'Meubelplanner' });
}

// Adding a floor plan: file, then scale.

function sluitSchaalstap() {
  S.modus = 'werkblad';
  teken.alles();
}

/** Read the picture, then show the scale step. A new project is made first when there is none. */
export async function startPlattegrond(bestand) {
  let plan;
  try {
    plan = await leesAfbeelding(bestand);
  } catch (err) {
    meld(err.message);
    return;
  }
  if (!S.project) nieuwProject('Mijn woning');
  const standaardNaam = S.project.plattegronden.length === 0 ? 'Begane grond' : '';
  S.modus = 'schaal';
  teken.alles();
  toonSchaalstap(S.schaalDoel, { ...plan, naam: standaardNaam }, {
    nieuw: true,
    bijAnnuleren: sluitSchaalstap,
    bijKlaar: ({ naam, k }) => {
      const f = voegPlattegrondToe(S.project, { naam, uri: plan.uri, pw: plan.pw, ph: plan.ph, k });
      if (!f) {
        meld('Deze plattegrond kon niet worden toegevoegd. Er passen hooguit 8 plattegronden in een project.');
        sluitSchaalstap();
        return;
      }
      S.modus = 'werkblad';
      naBewerking();
      kiesPlattegrond(f.id);
      passendMaken();
    },
  });
}

/** Change the scale of an existing floor plan. */
export function startHerschalen(id) {
  const f = S.project?.plattegronden.find((x) => x.id === id);
  if (!f) return;
  S.modus = 'schaal';
  teken.alles();
  toonSchaalstap(S.schaalDoel, f, {
    nieuw: false,
    bijAnnuleren: sluitSchaalstap,
    bijKlaar: ({ k }) => {
      wijzigPlattegrond(S.project, id, { k });
      S.modus = 'werkblad';
      naBewerking();
      kiesPlattegrond(id);
      passendMaken();
    },
  });
}
