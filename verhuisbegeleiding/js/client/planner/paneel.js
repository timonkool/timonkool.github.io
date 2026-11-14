// The side panel of the furniture planner: furniture, versions and project (floor plans, backup, projects).
// Forms are drawn from S.formulier. The panel is not drawn again while someone is typing in it.

import { h } from '../dom.js';
import { parseLijst } from '../../lib/planner/lijst.js';
import { hernoemVersie, kiesVersie, nieuweVersie, verwijderMeubel, verwijderPlattegrond, verwijderVersie, voegLijstToe, voegMeubelToe, wijzigMeubel, wijzigPlattegrond } from '../../lib/planner/acties.js';
import { r1 } from '../../lib/planner/meetkunde.js';
import { KLEUR_HEX, KLEUREN, LIMIETEN } from '../../lib/planner/model.js';
import { MELDING_GEBLOKKEERD } from '../../lib/planner/opslag.js';
import { flush, markeerVuil, naBewerking, opslag, S, teken, versie, wisGeschiedenis } from './staat.js';
import { IKONEN, ikoon } from './selectie.js';
import { kiesMeubel, plaatsMeubel } from './bewerken.js';
import { exporteerProject, importeerTekst, meld, nieuwProject, openProject, startHerschalen, startPlattegrond, verwijderProject, voorbeeldToevoegen } from './projecten.js';
import { kiesPlattegrond, tekenLabel } from './werkblad.js';

const fmt = (v) => String(r1(v)).replace('.', ',');
const maatTekst = (m) => `${fmt(m.b)} × ${fmt(m.d)}${m.h ? ` × ${fmt(m.h)}` : ''} cm`;
const meervoud = (n, een, meer) => `${n} ${n === 1 ? een : meer}`;
const datumTijd = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const knop = (tekst, bijKlik, klasse = 'btn sm', extra = {}) => h('button', { type: 'button', class: klasse, onclick: bijKlik, ...extra }, tekst);
const veld = (label, input) => h('label', { class: 'fld' }, h('span', null, label), input);

/** A button that needs a second tap to confirm. The question goes away after four seconds. */
function tweeTik(sleutel, tekst, actie, klasse = 'btn dng sm') {
  const zeker = S.bevestig === sleutel;
  return knop(zeker ? 'Zeker weten?' : tekst, () => {
    if (zeker) {
      S.bevestig = null;
      actie();
      return;
    }
    S.bevestig = sleutel;
    teken.paneel();
    setTimeout(() => {
      if (S.bevestig === sleutel) {
        S.bevestig = null;
        teken.paneel();
      }
    }, 4000);
  }, `${klasse}${zeker ? ' sure' : ''}`);
}

function sluitFormulieren() {
  S.formulier = null;
  teken.paneel();
}

const opnieuwMetFormulier = (naam) => () => {
  S.formulier = naam;
  S.bewerken = null;
  teken.paneel();
};

// Furniture

function kleurkiezer(naam, gekozen) {
  return h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': 'Kleur' },
    KLEUREN.map((k) => h('label', { title: k.id },
      h('input', { type: 'radio', name: naam, value: k.id, checked: k.id === gekozen }),
      h('span', { style: `background:${k.hex}` }))));
}

function toevoegFormulier() {
  const naam = h('input', { type: 'text', maxlength: '60', autocomplete: 'off', required: true, id: 'af-naam' });
  const b = h('input', { type: 'number', inputmode: 'decimal', min: 1, max: 1000, step: 'any', required: true });
  const d = h('input', { type: 'number', inputmode: 'decimal', min: 1, max: 1000, step: 'any', required: true });
  const hoog = h('input', { type: 'number', inputmode: 'decimal', min: 0, max: 500, step: 'any' });
  const kleed = h('input', { type: 'checkbox' });
  return h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const m = voegMeubelToe(S.project, { naam: naam.value, b: Number.parseFloat(b.value), d: Number.parseFloat(d.value), h: Number.parseFloat(hoog.value) || 0, vloerkleed: kleed.checked });
    if (!m) return;
    S.formulier = null;
    naBewerking();
  } },
  h('h3', null, 'Nieuw meubel'),
  veld('Naam', naam),
  h('div', { class: 'fgrid' }, veld('Breed cm', b), veld('Diep cm', d), veld('Hoog cm', hoog)),
  h('label', { class: 'chk' }, kleed, ' Ligt op de vloer (vloerkleed)'),
  h('div', { class: 'frow' }, h('button', { type: 'submit', class: 'btn pri' }, 'Toevoegen'), knop('Annuleren', sluitFormulieren, 'btn')));
}

function plakFormulier() {
  const tekst = h('textarea', { spellcheck: 'false', placeholder: 'Bank;210;95;80\nEettafel;180;90;76', id: 'pf-tekst' });
  const eenheid = h('select', null, h('option', { value: 'cm' }, 'centimeters'), h('option', { value: 'm' }, 'meters'), h('option', { value: 'mm' }, 'millimeters'));
  const uitslag = h('p', { class: 'small', 'aria-live': 'polite' });
  return h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const r = parseLijst(tekst.value, eenheid.value);
    if (!r.rijen.length) {
      uitslag.textContent = 'Geen meubels herkend. Zet naam, breedte en diepte op één regel.';
      return;
    }
    const aantal = voegLijstToe(S.project, r.rijen);
    markeerVuil(false);
    teken.alles();
    S.formulier = 'plakken';
    meld(`${meervoud(aantal, 'meubel', 'meubels')} toegevoegd${r.overgeslagen ? `, ${meervoud(r.overgeslagen, 'regel', 'regels')} overgeslagen` : ''}.`);
  } },
  h('h3', null, 'Lijst plakken'),
  h('p', { class: 'small' }, 'Één meubel per regel: naam, breedte, diepte en eventueel hoogte, gescheiden door een tab of puntkomma. Plakken uit Excel of Google Sheets werkt direct.'),
  veld('Meubels', tekst),
  veld('Maten staan in', eenheid),
  uitslag,
  h('div', { class: 'frow' }, h('button', { type: 'submit', class: 'btn pri' }, 'Toevoegen'), knop('Sluiten', sluitFormulieren, 'btn')));
}

function bewerkFormulier(m) {
  const naam = h('input', { type: 'text', maxlength: '60', value: m.naam });
  const b = h('input', { type: 'number', inputmode: 'decimal', min: 1, step: 'any', value: r1(m.b) });
  const d = h('input', { type: 'number', inputmode: 'decimal', min: 1, step: 'any', value: r1(m.d) });
  const hoog = h('input', { type: 'number', inputmode: 'decimal', min: 0, step: 'any', value: m.h ? r1(m.h) : '' });
  const kleed = h('input', { type: 'checkbox', checked: m.vloerkleed });
  const kleuren = kleurkiezer(`ek-${m.id}`, m.kleur);
  return h('div', { class: 'form', 'data-form': 'bewerk' },
    veld('Naam', naam),
    h('div', { class: 'fgrid' }, veld('Breed cm', b), veld('Diep cm', d), veld('Hoog cm', hoog)),
    kleuren,
    h('label', { class: 'chk' }, kleed, ' Ligt op de vloer (vloerkleed)'),
    h('div', { class: 'frow' },
      knop('Opslaan', () => {
        const kleur = kleuren.querySelector('input:checked')?.value ?? m.kleur;
        const nieuw = wijzigMeubel(S.project, m.id, { naam: naam.value, b: Number.parseFloat(b.value), d: Number.parseFloat(d.value), h: Number.parseFloat(hoog.value) || 0, kleur, vloerkleed: kleed.checked });
        if (!nieuw) return;
        S.bewerken = null;
        naBewerking();
      }, 'btn pri sm'),
      knop('Sluiten', () => { S.bewerken = null; teken.paneel(); }),
      tweeTik(`m:${m.id}`, 'Verwijderen', () => {
        S.bewerken = null;
        if (S.sel === m.id) S.sel = null;
        verwijderMeubel(S.project, m.id);
        naBewerking();
      })));
}

function meubelRij(m, plaatsing) {
  const plan = plaatsing ? S.project.plattegronden.find((f) => f.id === plaatsing.p) : null;
  return h('li', { class: `row${S.sel === m.id ? ' on' : ''}` },
    h('button', { type: 'button', class: 'row-main', 'aria-label': `${plan ? 'Toon' : 'Plaats'} ${m.naam}`, onclick: () => (plan ? kiesMeubel(m.id) : plaatsMeubel(m.id)) },
      h('span', { class: 'sw', style: `background:${KLEUR_HEX[m.kleur] ?? KLEUR_HEX.blauw}` }),
      h('span', { class: 'rn' }, h('b', null, m.naam), h('i', null, `${maatTekst(m)}${m.vloerkleed ? ' · vloerkleed' : ''}`)),
      plan ? h('span', { class: 'badge' }, plan.naam) : ikoon(...IKONEN.plus)),
    h('button', { type: 'button', class: 'ib', 'aria-label': `${m.naam} bewerken`, onclick: () => { S.bewerken = S.bewerken === m.id ? null : m.id; S.bevestig = null; teken.paneel(); } }, ikoon(...IKONEN.bewerk)),
    S.bewerken === m.id ? bewerkFormulier(m) : null);
}

function meubelsPaneel() {
  const v = versie();
  const pl = v ? v.plaatsing : {};
  const q = S.zoek.trim().toLowerCase();
  const alle = [...S.project.meubels].sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, 'nl'));
  const treft = (m) => !q || m.naam.toLowerCase().includes(q);
  const open = alle.filter((m) => !pl[m.id] && treft(m));
  const staan = alle.filter((m) => pl[m.id] && treft(m));
  const zoekveld = h('input', { id: 'q', class: 'search', type: 'search', placeholder: 'Zoek een meubel', 'aria-label': 'Zoek een meubel', autocomplete: 'off', value: S.zoek, oninput: (e) => { S.zoek = e.target.value; teken.paneel(true); } });
  return [
    S.project.plattegronden.length === 0
      ? h('p', { class: 'note' }, 'Voeg eerst een plattegrond toe bij het tabblad Project. Daarna kun je meubels plaatsen.')
      : null,
    zoekveld,
    alle.length === 0
      ? h('p', { class: 'small' }, 'Nog geen meubels. Voeg er een toe of plak je lijst met maten.')
      : [
        h('h3', { class: 'grp' }, h('span', null, 'Nog te plaatsen'), h('span', null, String(open.length))),
        open.length ? h('ul', { class: 'list' }, open.map((m) => meubelRij(m, null))) : h('p', { class: 'small' }, q ? 'Geen treffers.' : 'Alles staat op de plattegrond.'),
        staan.length ? [h('h3', { class: 'grp' }, h('span', null, 'Geplaatst'), h('span', null, String(staan.length))), h('ul', { class: 'list' }, staan.map((m) => meubelRij(m, pl[m.id])))] : null,
      ],
    h('div', { class: 'addrow' },
      knop('Meubel', opnieuwMetFormulier('toevoegen'), 'btn', { 'aria-expanded': String(S.formulier === 'toevoegen') }),
      knop('Lijst plakken', opnieuwMetFormulier('plakken'), 'btn', { 'aria-expanded': String(S.formulier === 'plakken') })),
    S.formulier === 'toevoegen' ? toevoegFormulier() : null,
    S.formulier === 'plakken' ? plakFormulier() : null,
  ];
}

// Versions

function versiesPaneel() {
  const lijst = [...S.project.versies].sort((a, b) => b.gewijzigd - a.gewijzigd);
  const totaal = S.project.meubels.length;
  const rijen = lijst.map((vs) => {
    const aan = vs.id === S.project.actief;
    const geplaatst = S.project.meubels.filter((m) => vs.plaatsing[m.id]).length;
    const meta = `${vs.gewijzigd ? datumTijd.format(new Date(vs.gewijzigd)) : 'nog niet bewaard'} · ${geplaatst} van ${totaal} geplaatst`;
    const kop = h('button', { type: 'button', class: 'vt', ...(aan ? { 'aria-current': 'true' } : {}), onclick: () => {
      if (aan) return;
      flush();
      kiesVersie(S.project, vs.id);
      S.sel = null;
      S.hernoemen = false;
      S.bevestig = null;
      wisGeschiedenis();
      markeerVuil(false);
      teken.alles();
    } }, h('span', { class: 'vtx' }, h('b', null, vs.naam), h('i', null, meta)), aan ? h('span', { class: 'badge' }, 'Open') : null);
    let acties = null;
    if (aan && S.hernoemen) {
      const naam = h('input', { type: 'text', maxlength: '60', value: vs.naam });
      acties = h('div', { class: 'frow' }, veld('Nieuwe naam', naam),
        h('div', { class: 'frow' },
          knop('Opslaan', () => { if (!naam.value.trim()) return; hernoemVersie(S.project, vs.id, naam.value); S.hernoemen = false; markeerVuil(); tekenLabel(); teken.paneel(); }, 'btn pri sm'),
          knop('Annuleren', () => { S.hernoemen = false; teken.paneel(); })));
    } else if (aan) {
      acties = h('div', { class: 'acts' },
        knop('Hernoemen', () => { S.hernoemen = true; teken.paneel(); }),
        knop('Kopie maken', () => { nieuweVersie(S.project, `Kopie van ${vs.naam}`, { kopie: true }); S.sel = null; wisGeschiedenis(); naBewerking(); }),
        knop('Exporteren', async () => { const u = await exporteerProject([vs.id]); if (u !== 'afgebroken') meld('Indeling bewaard als bestand.'); }),
        tweeTik(`v:${vs.id}`, 'Verwijderen', () => { verwijderVersie(S.project, vs.id); S.sel = null; wisGeschiedenis(); naBewerking(); }, 'btn dng sm'));
      if (S.project.versies.length < 2) acties.lastChild.disabled = true;
    }
    return h('div', { class: `vrow${aan ? ' on' : ''}` }, kop, acties);
  });
  const nieuw = S.formulier === 'nieuwe-versie' ? (() => {
    const naam = h('input', { type: 'text', maxlength: '60', required: true, autocomplete: 'off', value: `Kopie van ${versie()?.naam ?? 'indeling'}` });
    const leeg = h('input', { type: 'checkbox' });
    return h('form', { class: 'form', onsubmit: (e) => {
      e.preventDefault();
      if (!naam.value.trim()) return;
      S.formulier = null;
      nieuweVersie(S.project, naam.value, { kopie: !leeg.checked });
      S.sel = null;
      wisGeschiedenis();
      naBewerking();
    } }, h('h3', null, 'Nieuwe versie'), veld('Naam', naam), h('label', { class: 'chk' }, leeg, ' Begin met een lege plattegrond'),
    h('div', { class: 'frow' }, h('button', { type: 'submit', class: 'btn pri' }, 'Maken'), knop('Annuleren', sluitFormulieren, 'btn')));
  })() : null;
  return [
    h('p', { class: 'small' }, 'Elke wijziging wordt direct bewaard in de versie die open staat, op dit apparaat. Wil je iets uitproberen, maak dan eerst een kopie.'),
    h('div', { class: 'vlijst' }, rijen),
    h('div', { class: 'addrow' }, knop('Nieuwe versie', opnieuwMetFormulier('nieuwe-versie'), 'btn pri')),
    nieuw,
  ];
}

// Project: floor plans, backup and the list of projects

function plattegrondRij(f) {
  const aantal = S.project.versies.reduce((n, vs) => n + Object.values(vs.plaatsing).filter((p) => p.p === f.id).length, 0);
  if (S.formulier === `hernoem:${f.id}`) {
    const naam = h('input', { type: 'text', maxlength: '60', value: f.naam });
    return h('li', { class: 'vrow' }, veld('Nieuwe naam', naam), h('div', { class: 'frow' },
      knop('Opslaan', () => { wijzigPlattegrond(S.project, f.id, { naam: naam.value }); S.formulier = null; naBewerking(); }, 'btn pri sm'),
      knop('Annuleren', sluitFormulieren)));
  }
  const { W, H } = { W: f.pw / f.k, H: f.ph / f.k };
  return h('li', { class: 'vrow' },
    h('div', { class: 'vtx' }, h('b', null, f.naam), h('i', null, `ongeveer ${fmt(W / 100)} bij ${fmt(H / 100)} m · ${meervoud(aantal, 'plaatsing', 'plaatsingen')}`)),
    h('div', { class: 'acts' },
      knop('Tonen', () => { kiesPlattegrond(f.id); S.tab = 'meubels'; teken.paneel(); }),
      knop('Hernoemen', opnieuwMetFormulier(`hernoem:${f.id}`)),
      knop('Schaal aanpassen', () => startHerschalen(f.id)),
      tweeTik(`f:${f.id}`, 'Verwijderen', () => {
        verwijderPlattegrond(S.project, f.id);
        if (S.plattegrondId === f.id) {
          S.plattegrondId = S.project.plattegronden[0]?.id ?? null;
          S.sel = null;
          kiesPlattegrond(S.plattegrondId);
        }
        naBewerking();
      })));
}

function importFormulier() {
  const bestand = h('input', { type: 'file', accept: '.json,application/json,text/plain', id: 'im-bestand' });
  const tekst = h('textarea', { class: 'code', spellcheck: 'false', id: 'im-tekst' });
  const uitslag = h('p', { class: 'small', 'aria-live': 'polite', id: 'im-uitslag' });
  const doe = (inhoud) => {
    const r = importeerTekst(inhoud);
    uitslag.textContent = r.melding;
    if (r.ok) meld(r.melding);
  };
  bestand.addEventListener('change', async () => {
    const f = bestand.files?.[0];
    bestand.value = '';
    if (!f) return;
    if (f.size > LIMIETEN.importTekens) {
      uitslag.textContent = 'Dit bestand is te groot voor een export van de planner.';
      return;
    }
    try {
      doe(await f.text());
    } catch {
      uitslag.textContent = 'Het bestand kon niet gelezen worden.';
    }
  });
  return h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); doe(tekst.value); } },
    h('h3', null, 'Project importeren'),
    h('p', { class: 'small' }, 'Kies een bestand dat je eerder hebt geëxporteerd, of plak de tekst. Importeren maakt altijd een nieuw project. Wat je al hebt blijft staan.'),
    veld('Bestand', bestand), veld('Of plak de tekst', tekst), uitslag,
    h('div', { class: 'frow' }, h('button', { type: 'submit', class: 'btn pri' }, 'Importeren'), knop('Sluiten', sluitFormulieren, 'btn')));
}

function nieuwProjectFormulier() {
  const naam = h('input', { type: 'text', maxlength: '60', required: true, autocomplete: 'off', value: 'Mijn woning', id: 'np-naam' });
  return h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); if (naam.value.trim()) nieuwProject(naam.value); } },
    h('h3', null, 'Nieuw project'), veld('Naam (bijvoorbeeld de straat van je nieuwe woning)', naam),
    h('div', { class: 'frow' }, h('button', { type: 'submit', class: 'btn pri' }, 'Maken'), knop('Annuleren', sluitFormulieren, 'btn')));
}

function projectPaneel() {
  const projecten = S.index?.projecten ?? [];
  const bestand = h('input', { type: 'file', accept: 'image/*', id: 'pl-bestand', class: 'verborgen-invoer', onchange: (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) startPlattegrond(f);
  } });
  const naamVeld = S.hernoemen ? h('input', { type: 'text', maxlength: '60', value: S.project.naam, id: 'pj-naam' }) : null;
  return [
    h('h3', { class: 'grp' }, h('span', null, 'Dit project')),
    S.hernoemen
      ? h('div', { class: 'frow' }, veld('Naam', naamVeld), h('div', { class: 'frow' },
        knop('Opslaan', () => { const n = naamVeld.value.trim(); if (!n) return; S.project.naam = n.slice(0, 60); S.hernoemen = false; markeerVuil(false); flush(); S.index = opslag.leesIndex().index; teken.alles(); }, 'btn pri sm'),
        knop('Annuleren', () => { S.hernoemen = false; teken.paneel(); })))
      : h('div', { class: 'vrow' }, h('div', { class: 'vtx' }, h('b', null, S.project.naam), S.project.voorbeeld ? h('i', null, 'Voorbeeld met een eigen plattegrond') : null), knop('Hernoemen', () => { S.hernoemen = true; teken.paneel(); })),

    h('h3', { class: 'grp' }, h('span', null, 'Plattegronden'), h('span', null, `${S.project.plattegronden.length} van ${LIMIETEN.plattegronden}`)),
    S.project.plattegronden.length
      ? h('ul', { class: 'list' }, S.project.plattegronden.map(plattegrondRij))
      : h('p', { class: 'small' }, 'Nog geen plattegrond. Kies een afbeelding van je plattegrond, een foto of een schermafbeelding. Hij blijft op dit apparaat.'),
    h('div', { class: 'addrow' }, h('label', { class: 'btn pri bestandsknop' }, ikoon(...IKONEN.plus), 'Plattegrond toevoegen', bestand)),

    h('h3', { class: 'grp' }, h('span', null, 'Overzetten en back-up')),
    h('p', { class: 'small' }, 'Alles staat in deze browser, op dit apparaat. Wil je een project op een ander apparaat openen of naar iemand sturen, exporteer het dan hier en importeer het daar. De plattegronden gaan mee.'),
    h('div', { class: 'addrow' },
      knop('Project exporteren', async () => { const u = await exporteerProject(null); if (u !== 'afgebroken') meld('Project bewaard als bestand.'); }, 'btn'),
      knop('Importeren', opnieuwMetFormulier('importeren'), 'btn')),
    S.formulier === 'importeren' ? importFormulier() : null,

    h('h3', { class: 'grp' }, h('span', null, 'Projecten'), h('span', null, String(projecten.length))),
    h('ul', { class: 'list' }, projecten.map((p) => h('li', { class: `vrow${p.id === S.project.id ? ' on' : ''}` },
      h('button', { type: 'button', class: 'vt', ...(p.id === S.project.id ? { 'aria-current': 'true' } : {}), onclick: () => { if (p.id !== S.project.id) openProject(p.id); } },
        h('span', { class: 'vtx' }, h('b', null, p.naam), h('i', null, p.gewijzigd ? datumTijd.format(new Date(p.gewijzigd)) : '')), p.id === S.project.id ? h('span', { class: 'badge' }, 'Open') : null),
      tweeTik(`p:${p.id}`, 'Verwijderen', () => verwijderProject(p.id))))),
    h('div', { class: 'addrow' },
      knop('Nieuw project', opnieuwMetFormulier('nieuw-project'), 'btn'),
      projecten.some((p) => p.naam === 'Voorbeeldwoning') ? null : knop('Voorbeeld toevoegen', () => voorbeeldToevoegen(), 'btn')),
    S.formulier === 'nieuw-project' ? nieuwProjectFormulier() : null,
  ];
}

// The panel as a whole

export function maakPaneel() {
  const tabs = h('div', { class: 'stabs', role: 'tablist', 'aria-label': 'Onderdelen' },
    [['meubels', 'Meubels'], ['versies', 'Versies'], ['project', 'Project']].map(([id, tekst]) =>
      h('button', { type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': 'spanel', 'data-tab': id, onclick: () => { S.tab = id; S.formulier = null; S.bewerken = null; S.hernoemen = false; teken.paneel(); } }, tekst)));
  const inhoud = h('div', { class: 'spanel', id: 'spanel', role: 'tabpanel', tabindex: '-1' });
  inhoud.addEventListener('focusout', () => {
    setTimeout(() => {
      if (S.paneelAchterstand && !typtInPaneel()) teken.paneel();
    }, 60);
  });
  return h('aside', { class: 'side' }, tabs, inhoud);
}

function typtInPaneel() {
  const a = document.activeElement;
  const paneel = document.getElementById('spanel');
  return Boolean(a && paneel?.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

/** @param {boolean} [behoudFocus] true while typing in the search field: only the lists are redrawn */
export function tekenPaneel(behoudFocus = false) {
  const paneel = document.getElementById('spanel');
  if (!paneel || !S.project) return;
  if (!behoudFocus && typtInPaneel()) {
    S.paneelAchterstand = true;
    return;
  }
  S.paneelAchterstand = false;
  for (const b of document.querySelectorAll('.stabs [data-tab]')) {
    const aan = b.getAttribute('data-tab') === S.tab;
    b.setAttribute('aria-selected', String(aan));
    if (aan) paneel.setAttribute('aria-labelledby', b.id);
  }
  const zoekFocus = behoudFocus && document.activeElement?.id === 'q';
  const positie = zoekFocus ? document.activeElement.selectionStart : null;
  const kinderen = [
    S.bericht ? h('p', { class: 'note', role: 'status' }, S.bericht.tekst) : null,
    !opslag.beschikbaar ? h('p', { class: 'note bad' }, MELDING_GEBLOKKEERD) : null,
    opslag.beschikbaar && S.opslagMelding ? h('p', { class: 'note bad', role: 'alert' }, S.opslagMelding) : null,
    S.tab === 'meubels' ? meubelsPaneel() : S.tab === 'versies' ? versiesPaneel() : projectPaneel(),
  ];
  paneel.replaceChildren(...kinderen.flat(Infinity).filter(Boolean));
  if (zoekFocus) {
    const q = document.getElementById('q');
    q?.focus();
    if (q && positie !== null) q.setSelectionRange(positie, positie);
  }
}

