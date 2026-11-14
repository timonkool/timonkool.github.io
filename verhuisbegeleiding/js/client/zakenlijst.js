// The list of things in the home (TL-08): what stays, what goes along and what still has to be discussed,
// to check off at the offer and at the final inspection. It holds only what the visitor fills in.

import { h, leeg } from './dom.js';
import { laadApp } from './state.js';
import { MAX_ZAKEN } from '../lib/schema.js';

const root = document.getElementById('app');
const app = await laadApp();

const BESLUIT_TEKST = { blijft: 'Blijft in de woning', gaat_mee: 'Gaat mee', bespreken: 'Nog te bespreken' };
const FILTERS = [['alles', 'Alles'], ['blijft', 'Blijft'], ['gaat_mee', 'Gaat mee'], ['bespreken', 'Nog te bespreken']];
const PLEKKEN = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Hal', 'Zolder', 'Berging', 'Tuin', 'Overig'];

let filter = 'alles';
let bewerken = null;
let bevestig = null;
let formulier = null;

const lijst = () => app.state.zakenlijst;
const pas = (fn) => app.wijzig((s) => fn(s.zakenlijst));
const nieuwId = () => `z${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const knop = (tekst, bijKlik, klasse = 'knop knop-klein knop-rustig', extra = {}) => h('button', { type: 'button', class: klasse, onclick: bijKlik, ...extra }, tekst);

function zaakBewerkFormulier(z) {
  const naam = h('input', { type: 'text', id: `zb-naam-${z.id}`, maxlength: '60', value: z.naam });
  const plek = h('input', { type: 'text', id: `zb-plek-${z.id}`, maxlength: '40', list: 'plekken', value: z.plek });
  const notitie = h('input', { type: 'text', id: `zb-notitie-${z.id}`, maxlength: '200', value: z.notitie });
  return h('form', { class: 'zaakform', onsubmit: (e) => {
    e.preventDefault();
    if (!naam.value.trim()) return;
    pas((l) => { const x = l.find((y) => y.id === z.id); if (x) { x.naam = naam.value.trim(); x.plek = plek.value.trim(); x.notitie = notitie.value.trim(); } });
    bewerken = null;
  } },
  h('div', { class: 'datumveld' }, h('label', { for: naam.id }, 'Wat is het'), naam),
  h('div', { class: 'datumveld' }, h('label', { for: plek.id }, 'Waar in de woning'), plek),
  h('div', { class: 'datumveld' }, h('label', { for: notitie.id }, 'Notitie (bijvoorbeeld een afspraak of een gebrek)'), notitie),
  h('div', { class: 'knoppen' }, h('button', { type: 'submit', class: 'knop' }, 'Opslaan'), knop('Annuleren', () => { bewerken = null; teken(); }),
    knop(bevestig === z.id ? 'Zeker weten?' : 'Weghalen', () => {
      if (bevestig !== z.id) { bevestig = z.id; teken(); setTimeout(() => { if (bevestig === z.id) { bevestig = null; teken(); } }, 4000); return; }
      bevestig = null;
      bewerken = null;
      pas((l) => { l.splice(l.findIndex((y) => y.id === z.id), 1); });
    }, 'knop knop-klein knop-rustig')));
}

function zaakRij(z) {
  return h('li', { class: `zaak besluit-${z.besluit}` },
    h('div', { class: 'zaakkop' }, h('strong', null, z.naam), z.notitie ? h('span', { class: 'kleiner' }, ` ${z.notitie}`) : null),
    h('div', { class: 'zaakacties' },
      h('label', { class: 'keuze', for: `zb-${z.id}` }, h('input', { type: 'checkbox', id: `zb-${z.id}`, checked: z.bod, onchange: (e) => pas((l) => { l.find((x) => x.id === z.id).bod = e.target.checked; }) }), h('span', null, 'In het bod')),
      h('label', { class: 'keuze', for: `zi-${z.id}` }, h('input', { type: 'checkbox', id: `zi-${z.id}`, checked: z.inspectie, onchange: (e) => pas((l) => { l.find((x) => x.id === z.id).inspectie = e.target.checked; }) }), h('span', null, 'Gecontroleerd bij de eindinspectie')),
      h('select', { id: `zs-${z.id}`, 'aria-label': `${z.naam}: wat gebeurt ermee`, onchange: (e) => pas((l) => { l.find((x) => x.id === z.id).besluit = e.target.value; }) },
        Object.entries(BESLUIT_TEKST).map(([id, tekst]) => h('option', { value: id, selected: z.besluit === id }, tekst))),
      knop('Bewerken', () => { bewerken = bewerken === z.id ? null : z.id; teken(); }, 'knop knop-klein knop-rustig', { 'aria-expanded': String(bewerken === z.id), id: `ze-${z.id}` })),
    bewerken === z.id ? zaakBewerkFormulier(z) : null);
}

function overzicht() {
  const l = lijst();
  const tel = (b) => l.filter((z) => z.besluit === b).length;
  const blijft = l.filter((z) => z.besluit === 'blijft');
  return h('p', { class: 'voortgang', role: 'status' },
    `${l.length} ${l.length === 1 ? 'ding' : 'dingen'} op je lijst: ${tel('blijft')} blijft, ${tel('gaat_mee')} gaat mee, ${tel('bespreken')} nog te bespreken. `,
    `In het bod: ${l.filter((z) => z.bod).length} van ${l.length}. Bij de eindinspectie gecontroleerd: ${blijft.filter((z) => z.inspectie).length} van ${blijft.length} die blijven.`);
}

function toevoegFormulieren() {
  const naam = h('input', { type: 'text', id: 'z-naam', maxlength: '60', autocomplete: 'off', required: true });
  const plek = h('input', { type: 'text', id: 'z-plek', maxlength: '40', list: 'plekken', autocomplete: 'off' });
  const besluit = h('select', { id: 'z-besluit' }, Object.entries(BESLUIT_TEKST).map(([id, tekst]) => h('option', { value: id, selected: id === 'bespreken' }, tekst)));
  const veel = h('textarea', { id: 'z-veel', rows: '5', placeholder: 'Gordijnen; Woonkamer\nKeukenapparatuur; Keuken\nSchuurtje' });
  const veelBesluit = h('select', { id: 'z-veel-besluit', 'aria-label': 'Wat gebeurt ermee' }, Object.entries(BESLUIT_TEKST).map(([id, tekst]) => h('option', { value: id, selected: id === 'bespreken' }, tekst)));
  const voeg = (nieuw) => {
    const ruimte = MAX_ZAKEN - lijst().length;
    pas((l) => { l.push(...nieuw.slice(0, Math.max(0, ruimte))); });
  };
  return [
    h('datalist', { id: 'plekken' }, PLEKKEN.map((p) => h('option', { value: p }))),
    h('form', { class: 'zaakform', onsubmit: (e) => {
      e.preventDefault();
      if (!naam.value.trim()) return;
      voeg([{ id: nieuwId(), naam: naam.value.trim(), plek: plek.value.trim(), besluit: besluit.value, bod: false, inspectie: false, notitie: '' }]);
      naam.value = '';
      naam.focus();
    } },
    h('h3', null, 'Iets toevoegen'),
    h('div', { class: 'datumveld' }, h('label', { for: 'z-naam' }, 'Wat is het'), naam),
    h('div', { class: 'datumveld' }, h('label', { for: 'z-plek' }, 'Waar in de woning (niet verplicht)'), plek),
    h('div', { class: 'datumveld' }, h('label', { for: 'z-besluit' }, 'Wat gebeurt ermee'), besluit),
    h('button', { type: 'submit', class: 'knop' }, 'Toevoegen')),
    h('details', { open: formulier === 'veel', ontoggle: (e) => { formulier = e.target.open ? 'veel' : null; } },
      h('summary', null, 'Meerdere dingen tegelijk toevoegen'),
      h('form', { class: 'zaakform', onsubmit: (e) => {
        e.preventDefault();
        const nieuw = veel.value.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((r) => {
          const [n, p = ''] = r.split(';').map((x) => x.trim());
          return { id: nieuwId(), naam: n.slice(0, 60), plek: p.slice(0, 40), besluit: veelBesluit.value, bod: false, inspectie: false, notitie: '' };
        }).filter((z) => z.naam);
        if (nieuw.length === 0) return;
        voeg(nieuw);
        veel.value = '';
      } },
      h('div', { class: 'datumveld' }, h('label', { for: 'z-veel' }, 'Een per regel, met de plek erachter na een puntkomma (niet verplicht)'), veel),
      h('div', { class: 'datumveld' }, h('label', { for: 'z-veel-besluit' }, 'Wat gebeurt ermee'), veelBesluit),
      h('button', { type: 'submit', class: 'knop' }, 'Alles toevoegen'))),
  ];
}

function teken() {
  const behoud = document.activeElement?.id;
  const l = lijst();
  const zichtbaar = l.filter((z) => filter === 'alles' || z.besluit === filter);
  const perPlek = new Map();
  for (const z of zichtbaar) {
    const sleutel = z.plek || '';
    if (!perPlek.has(sleutel)) perPlek.set(sleutel, []);
    perPlek.get(sleutel).push(z);
  }
  const plekken = [...perPlek.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'nl')));
  leeg(root);
  root.append(h('div', null,
    overzicht(),
    h('div', { class: 'filterrij', role: 'group', 'aria-label': 'Toon' },
      FILTERS.map(([id, tekst]) => h('button', { type: 'button', class: 'knop knop-klein knop-rustig', 'aria-pressed': String(filter === id), onclick: () => { filter = id; teken(); } }, tekst))),
    l.length === 0
      ? h('p', { class: 'kleiner' }, 'Je lijst is nog leeg. Voeg hieronder iets toe, bijvoorbeeld gordijnen, de keukenapparatuur of de schuur.')
      : plekken.map((p) => h('section', { class: 'blok', 'aria-label': p || 'Zonder plek' },
        h('h2', null, p || 'Zonder plek'),
        h('ul', { class: 'zaken' }, perPlek.get(p).map(zaakRij)))),
    toevoegFormulieren(),
    h('div', { class: 'knoppen' }, knop('Print deze lijst', () => window.print(), 'knop knop-rustig')),
    h('p', { class: 'kleiner' }, 'Je lijst wordt bewaard met de rest van je gegevens. Bewaar ze af en toe als bestand op Mijn verhuizing.')));
  if (behoud) document.getElementById(behoud)?.focus();
}

app.luisteraars.add(teken);
teken();
