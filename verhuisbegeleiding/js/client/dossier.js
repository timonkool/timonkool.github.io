// My file (TL-07): your own overview of documents. Where is it, and when does it expire?
// It holds only what the visitor fills in. Documents that expire soonest come first.

import { h, leeg } from './dom.js';
import { laadApp } from './state.js';
import { MAX_STUKKEN } from '../lib/schema.js';
import { dagenTekst, formatLang, isDatum, vandaag, verschilDagen } from '../lib/datum.js';

const root = document.getElementById('app');
const app = await laadApp();

const VOORBEELDEN = ['Koopovereenkomst', 'Hypotheekofferte', 'Taxatierapport', 'Bouwkundig rapport', 'Energielabel', 'Huurcontract', 'Opzegbevestiging', 'Inboedelverzekering', 'Eigendomsakte', 'Foto\'s van de meterstanden', 'Garantiebewijzen'];

let bewerken = null;
let bevestig = null;

const lijst = () => app.state.dossier;
const pas = (fn) => app.wijzig((s) => fn(s.dossier));
const nieuwId = () => `d${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const knop = (tekst, bijKlik, klasse = 'knop knop-klein knop-rustig', extra = {}) => h('button', { type: 'button', class: klasse, onclick: bijKlik, ...extra }, tekst);

/** The state of the expiry date in words, and a class for the look. */
function vervalTekst(s) {
  if (!isDatum(s.vervalt)) return { tekst: 'Geen vervaldatum', klasse: '' };
  const dagen = verschilDagen(vandaag(), s.vervalt);
  if (dagen < 0) return { tekst: `Verlopen op ${formatLang(s.vervalt)} (${dagenTekst(dagen)})`, klasse: 'verlopen' };
  return { tekst: `Vervalt op ${formatLang(s.vervalt)} (${dagenTekst(dagen)})`, klasse: dagen <= 30 ? 'bijna' : '' };
}

function sorteer(l) {
  return [...l].sort((a, b) => {
    if (a.vervalt && b.vervalt) return a.vervalt < b.vervalt ? -1 : a.vervalt > b.vervalt ? 1 : a.naam.localeCompare(b.naam, 'nl');
    if (a.vervalt) return -1;
    if (b.vervalt) return 1;
    return a.naam.localeCompare(b.naam, 'nl');
  });
}

function velden(prefix, s) {
  const naam = h('input', { type: 'text', id: `${prefix}-naam`, maxlength: '60', autocomplete: 'off', list: 'stukken', required: true, value: s?.naam ?? '' });
  const plek = h('input', { type: 'text', id: `${prefix}-plek`, maxlength: '80', autocomplete: 'off', value: s?.plek ?? '' });
  const vervalt = h('input', { type: 'date', id: `${prefix}-vervalt`, value: s?.vervalt ?? '' });
  const notitie = h('input', { type: 'text', id: `${prefix}-notitie`, maxlength: '200', autocomplete: 'off', value: s?.notitie ?? '' });
  const waarden = () => ({ naam: naam.value.trim(), plek: plek.value.trim(), vervalt: isDatum(vervalt.value) ? vervalt.value : null, notitie: notitie.value.trim() });
  const rijen = [
    h('div', { class: 'datumveld' }, h('label', { for: naam.id }, 'Welk stuk'), naam),
    h('div', { class: 'datumveld' }, h('label', { for: plek.id }, 'Waar ligt het (bijvoorbeeld "map in de kast" of "mail")'), plek),
    h('div', { class: 'datumveld' }, h('label', { for: vervalt.id }, 'Vervaldatum (niet verplicht)'), vervalt),
    h('div', { class: 'datumveld' }, h('label', { for: notitie.id }, 'Notitie (niet verplicht)'), notitie),
  ];
  return { rijen, waarden, naam };
}

function bewerkFormulier(s) {
  const v = velden(`db-${s.id}`, s);
  return h('form', { class: 'zaakform', onsubmit: (e) => {
    e.preventDefault();
    const w = v.waarden();
    if (!w.naam) return;
    pas((l) => { Object.assign(l.find((x) => x.id === s.id), w); });
    bewerken = null;
  } }, ...v.rijen,
  h('div', { class: 'knoppen' }, h('button', { type: 'submit', class: 'knop' }, 'Opslaan'), knop('Annuleren', () => { bewerken = null; teken(); }),
    knop(bevestig === s.id ? 'Zeker weten?' : 'Weghalen', () => {
      if (bevestig !== s.id) { bevestig = s.id; teken(); setTimeout(() => { if (bevestig === s.id) { bevestig = null; teken(); } }, 4000); return; }
      bevestig = null;
      bewerken = null;
      pas((l) => { l.splice(l.findIndex((x) => x.id === s.id), 1); });
    })));
}

function rij(s) {
  const v = vervalTekst(s);
  return h('li', { class: `zaak stuk ${v.klasse}` },
    h('div', { class: 'zaakkop' }, h('strong', null, s.naam), s.plek ? h('span', { class: 'kleiner' }, ` Ligt: ${s.plek}`) : null),
    h('p', { class: `kleiner vervalregel ${v.klasse}` }, v.tekst, s.notitie ? `. ${s.notitie}` : ''),
    h('div', { class: 'zaakacties' }, knop('Bewerken', () => { bewerken = bewerken === s.id ? null : s.id; teken(); }, 'knop knop-klein knop-rustig', { 'aria-expanded': String(bewerken === s.id), id: `de-${s.id}` })),
    bewerken === s.id ? bewerkFormulier(s) : null);
}

function toevoegFormulier() {
  const v = velden('d', null);
  return h('form', { class: 'zaakform', onsubmit: (e) => {
    e.preventDefault();
    const w = v.waarden();
    if (!w.naam || lijst().length >= MAX_STUKKEN) return;
    pas((l) => { l.push({ id: nieuwId(), ...w }); });
  } },
  h('datalist', { id: 'stukken' }, VOORBEELDEN.map((x) => h('option', { value: x }))),
  h('h3', null, 'Een stuk toevoegen'),
  ...v.rijen,
  h('button', { type: 'submit', class: 'knop' }, 'Toevoegen'));
}

function teken() {
  const behoud = document.activeElement?.id;
  const l = sorteer(lijst());
  const verlopen = l.filter((s) => s.vervalt && verschilDagen(vandaag(), s.vervalt) < 0).length;
  leeg(root);
  root.append(
    h('p', { class: 'voortgang', role: 'status' }, `${l.length} ${l.length === 1 ? 'stuk' : 'stukken'} in je dossier${verlopen ? `, waarvan ${verlopen} verlopen` : ''}.`),
    l.length === 0
      ? h('p', { class: 'kleiner' }, 'Je dossier is nog leeg. Voeg hieronder een stuk toe, bijvoorbeeld je koopovereenkomst of je energielabel.')
      : h('ul', { class: 'zaken' }, l.map(rij)),
    toevoegFormulier(),
    h('div', { class: 'knoppen' }, knop('Print dit overzicht', () => window.print(), 'knop knop-rustig')),
    h('p', { class: 'kleiner' }, 'Hier staan geen documenten zelf, alleen wat jij erover opschrijft. Het overzicht wordt bewaard met de rest van je gegevens. Bewaar ze af en toe als bestand op Mijn verhuizing.'));
  if (behoud) document.getElementById(behoud)?.focus();
}

app.luisteraars.add(teken);
teken();
