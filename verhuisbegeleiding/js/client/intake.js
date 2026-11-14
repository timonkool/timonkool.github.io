// The intake (TL-01): short screens, one thing at a time. Only "what are you going to do" is required. Every question
// can be answered with "weet ik nog niet". The answers decide which parts, moments and flags are on (see src/lib/intake.js).
// Question 1 of the overview is split over screens: first what you do, then per part where you are (D-037).

import { h, leeg } from './dom.js';
import { laadApp, siteUrl } from './state.js';
import { flagsUitIntake, alsLijst, intakeDatums, intakeSchermen } from '../lib/intake.js';
import { isDatum } from '../lib/datum.js';
import { track } from './meting.js';

const root = document.getElementById('app');
const app = await laadApp();
const model = app.data.model;

const begin = app.state.intake ?? {};
const antwoorden = {
  doen: alsLijst(begin.doen),
  woning: begin.woning ?? null,
  koopwijze: alsLijst(begin.koopwijze),
  gezin: alsLijst(begin.gezin),
  momenten: { ...(begin.momenten ?? {}) },
};
const datums = { ...(app.state.datums ?? {}) };
let stap = 0;
let melding = '';

/** The choice made on the start page ("Wat ga je doen?"). It is read once and then removed. */
function keuzeVanStart() {
  try {
    const ruw = sessionStorage.getItem('vb:begin');
    sessionStorage.removeItem('vb:begin');
    const geldig = new Set(model.intake.vragen.find((v) => v.id === 'doen').antwoorden.map((a) => a.id));
    const lijst = JSON.parse(ruw ?? '[]');
    return Array.isArray(lijst) ? lijst.filter((x) => geldig.has(x)) : [];
  } catch {
    return [];
  }
}

const vanStart = keuzeVanStart();
if (vanStart.length) {
  antwoorden.doen = vanStart;
  const metMoment = new Set(intakeSchermen(model, antwoorden).filter((s) => s.soort === 'moment').map((s) => s.spoor));
  for (const spoor of Object.keys(antwoorden.momenten)) if (!metMoment.has(spoor)) delete antwoorden.momenten[spoor];
  stap = 1;
}

function optie(type, naam, id, tekst, aan, bijWijziging) {
  const veld = h('input', { type, name: naam, id, checked: aan, onchange: bijWijziging });
  return h('label', { class: 'keuze', for: id }, veld, h('span', null, tekst));
}

function stapDoen(v) {
  return h('fieldset', null,
    h('legend', null, 'Wat ga je doen?'),
    h('p', { class: 'kleiner veldhulp' }, 'Meer dan één mag. De verhuizing zelf hoort er altijd bij.'),
    v.antwoorden.map((a) => optie('checkbox', 'doen', `doen-${a.id}`, a.tekst, antwoorden.doen.includes(a.id), (e) => {
      antwoorden.doen = e.target.checked ? [...new Set([...antwoorden.doen, a.id])] : antwoorden.doen.filter((x) => x !== a.id);
      if (!e.target.checked) delete antwoorden.momenten[a.spoor];
      melding = '';
      toon();
    })));
}

function stapMoment(spoor) {
  const def = model.sporen[spoor];
  return h('fieldset', null,
    h('legend', null, `Waar sta je nu met ${def.naam.toLowerCase()}?`),
    def.momenten.map((m) => optie('radio', `moment-${spoor}`, `m-${spoor}-${m.id}`, m.kaart, antwoorden.momenten[spoor] === m.id, () => { antwoorden.momenten[spoor] = m.id; })),
    optie('radio', `moment-${spoor}`, `m-${spoor}-onbekend`, 'Weet ik nog niet', !antwoorden.momenten[spoor], () => { delete antwoorden.momenten[spoor]; }));
}

function stapKeuze(v) {
  const flags = flagsUitIntake(model, antwoorden);
  const opties = v.antwoorden.filter((a) => !(a.id === 'nieuwbouw' && !flags.has('kopen')));
  if (v.meerdere) {
    return h('fieldset', null, h('legend', null, v.tekst),
      opties.map((a) => optie('checkbox', v.id, `${v.id}-${a.id}`, a.tekst, antwoorden[v.id].includes(a.id), (e) => {
        antwoorden[v.id] = e.target.checked ? [...new Set([...antwoorden[v.id].filter((x) => (a.id === 'geen' ? false : x !== 'geen')), a.id])] : antwoorden[v.id].filter((x) => x !== a.id);
        toon();
      })),
      optie('checkbox', v.id, `${v.id}-onbekend`, 'Weet ik nog niet', antwoorden[v.id].length === 0, () => { antwoorden[v.id] = []; toon(); }));
  }
  return h('fieldset', null, h('legend', null, v.tekst),
    opties.map((a) => optie('radio', v.id, `${v.id}-${a.id}`, a.tekst, antwoorden[v.id] === a.id, () => { antwoorden[v.id] = a.id; })),
    optie('radio', v.id, `${v.id}-onbekend`, 'Weet ik nog niet', !antwoorden[v.id], () => { antwoorden[v.id] = null; }));
}

function stapDatums(v) {
  const velden = intakeDatums(model, antwoorden);
  return h('fieldset', null,
    h('legend', null, velden.length === 1 ? `Weet je je ${velden[0].naam.toLowerCase()} al?` : v.tekst),
    h('p', { class: 'kleiner veldhulp' }, 'Vul in wat je weet. Leeg laten mag: je kunt datums later op Mijn verhuizing invullen of aanpassen.'),
    velden.map((a) => h('div', { class: 'datumveld' },
      h('label', { for: `datum-${a.id}` }, a.naam),
      h('input', { type: 'date', id: `datum-${a.id}`, value: isDatum(datums[a.id]) ? datums[a.id] : '', onchange: (e) => { if (isDatum(e.target.value)) datums[a.id] = e.target.value; else delete datums[a.id]; } }),
      h('span', { class: 'kleiner' }, a.hint))));
}

function klaar() {
  const flags = flagsUitIntake(model, antwoorden);
  const schoon = { doen: antwoorden.doen };
  if (flags.has('kopen') || flags.has('verkopen')) if (antwoorden.woning) schoon.woning = antwoorden.woning;
  if (flags.has('kopen') && antwoorden.koopwijze.length) schoon.koopwijze = antwoorden.koopwijze;
  if (antwoorden.gezin.length) schoon.gezin = antwoorden.gezin;
  if (Object.keys(antwoorden.momenten).length) schoon.momenten = antwoorden.momenten;
  app.wijzig((s) => {
    s.intake = schoon;
    s.momenten = {};
    s.datums = Object.fromEntries(Object.entries(datums).filter(([, w]) => isDatum(w) || Array.isArray(w)));
  });
  track('intake_voltooid');
  // The dashboard shows a short welcome once, right after the questions.
  try { sessionStorage.setItem('vb:welkom', '1'); } catch { /* no session storage: no welcome */ }
  window.location.href = siteUrl('dashboard/');
}

function toon(focus = false) {
  const lijst = intakeSchermen(model, antwoorden);
  if (stap >= lijst.length) stap = lijst.length - 1;
  const s = lijst[stap];
  const laatste = stap === lijst.length - 1;
  // On the first screen the number of screens is not known yet: it depends on what you choose there.
  const totaal = stap === 0 && antwoorden.doen.length === 0 ? null : lijst.length;
  const naar = (n) => { stap = n; melding = ''; toon(true); };
  // The introduction of the page is for the first screen. After that the question stands on top.
  document.querySelector('main .intro')?.toggleAttribute('hidden', stap > 0);
  leeg(root);
  root.append(...[
    h('p', { class: 'voortgang' }, totaal ? `Stap ${stap + 1} van ${totaal}` : 'Stap 1'),
    totaal ? h('progress', { class: 'voortgangsbalk', max: String(totaal), value: String(stap + 1), 'aria-label': 'Voortgang van de vragen' }) : null,
    h('form', { onsubmit: (e) => e.preventDefault() },
      s.soort === 'doen' ? stapDoen(s.vraag) : s.soort === 'moment' ? stapMoment(s.spoor) : s.soort === 'datums' ? stapDatums(s.vraag) : stapKeuze(s.vraag),
      melding ? h('p', { class: 'fout', role: 'alert' }, melding) : null,
      h('div', { class: 'knoppen' },
        h('button', { type: 'button', class: 'knop', onclick: () => {
          if (s.soort === 'doen' && antwoorden.doen.length === 0) { melding = 'Kies minstens één onderdeel om verder te gaan, of kijk eerst rond.'; toon(); return; }
          if (laatste) klaar(); else naar(stap + 1);
        } }, laatste ? 'Klaar, naar mijn verhuizing' : 'Volgende'),
        stap > 0 ? h('button', { type: 'button', class: 'knop knop-rustig', onclick: () => naar(stap - 1) }, 'Vorige') : null,
        stap === 0 ? h('a', { class: 'knop knop-rustig', href: siteUrl('taken/') }, 'Ik kijk eerst rond') : null)),
  ].filter(Boolean));
  const legenda = root.querySelector('legend');
  legenda?.setAttribute('tabindex', '-1');
  // After "Volgende" or "Vorige" the new question gets the focus, so a screen reader reads it and the page shows it.
  if (focus) legenda?.focus();
}

toon();
