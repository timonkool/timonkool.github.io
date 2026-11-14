// The dashboard (TL-02). First what counts now (overzicht 2.4): a short summary, "Nu aandacht", the next deadline,
// the status per part and the move window (order: D-037). Below that: one missing date at a time, a short list of tasks per moment, the timeline, the dates,
// links, agenda export, saving and importing. All text goes in as text nodes.

import { h, leeg, download } from './dom.js';
import { laadApp, siteUrl } from './state.js';
import { itemActief, itemRelevant, maakContext, volgendMoment, vorigMoment } from '../lib/intake.js';
import { dashboardVolgorde, nuAandacht, sorteerTaken, SPOOR_VOLGORDE, voortgang } from '../lib/aandacht.js';
import { rekenItem, verschuiving, wisselNaarBerekend, zetHandmatig } from '../lib/tijd.js';
import { bouwVenster, VENSTER_PUNTEN } from '../lib/venster.js';
import { dagenTekst, formatLang, isDatum, vandaag as vandaagIso, verschilDagen } from '../lib/datum.js';
import { gebeurtenissenUitItems, maakIcs } from '../lib/ics.js';
import { schoonLabel } from '../lib/schema.js';
import { track } from './meting.js';
import { bewarenOnderdeel, maakOntvangst } from './bewaren.js';
import { wisAlleGegevens } from './wissen.js';

const root = document.getElementById('app');
const app = await laadApp();
const { model, taken, lijsten } = app.data;
const PRIO = { 1: 'Kritiek', 2: 'Belangrijk', 3: 'Handig' };
let wisBevestig = false;

const vandaag = () => vandaagIso();
const motorState = () => ({ datums: app.state.datums, overrides: app.state.overrides, afgevinkt: app.state.afgevinkt, nietVanToepassing: app.state.nietVanToepassing });
const maakCtx = () => maakContext(model, app.state.intake ?? {}, { momenten: app.state.momenten, nietVanToepassing: app.state.nietVanToepassingSporen, datums: app.state.datums, vandaag: vandaag() });
/** How many open tasks of one moment the dashboard shows before "Toon nog N taken". */
const MAX_TAKEN_ZICHTBAAR = 5;
const taakUrl = (t) => siteUrl(`${lijsten[t.lijst].pad}#taak-${t.id}`);
const ankerNaam = (id) => model.ankers.find((a) => a.id === id)?.naam ?? id;
const soortNaam = (soort) => model.tijdsoorten[soort]?.naam ?? soort;

function knop(tekst, bijKlik, uit = false, klasse = 'knop knop-klein knop-rustig') {
  return h('button', { type: 'button', class: klasse, onclick: bijKlik, disabled: uit }, tekst);
}

// The blocks the visitor opened. The dashboard is drawn again after every change, so the open state is kept here.
const open = new Set();

/** A <details> that stays open or closed when the dashboard is drawn again. */
function uitklap(sleutel, samenvatting, attrs, ...inhoud) {
  return h('details', { ...attrs, open: open.has(sleutel), ontoggle: (e) => { if (e.target.open) open.add(sleutel); else open.delete(sleutel); } },
    h('summary', null, samenvatting), ...inhoud);
}

const wissel = (lijst, id) =>
  app.wijzig((s) => {
    const i = s[lijst].indexOf(id);
    if (i >= 0) s[lijst].splice(i, 1);
    else s[lijst].push(id);
  });

function vroegsteDeadline(t) {
  const r = rekenItem(t, motorState()).filter((x) => x.deadline && !x.onbekend);
  return r.sort((a, b) => (a.deadline < b.deadline ? -1 : 1))[0] ?? null;
}

/** The date fields of a task: set a date by hand or go back to the calculated one. The calculated date stays visible (overzicht 6.2). */
function datumVelden(t, prefix) {
  const r = rekenItem(t, motorState()).filter((x) => x.deadline && !x.onbekend);
  return r.map((x, i) => {
    const id = `${prefix}-d-${t.id}-${i}`;
    return h('div', { class: 'datumveld' },
      h('label', { for: id }, r.length > 1 ? `Datum ${i + 1} aanpassen` : 'Datum aanpassen'),
      h('input', { type: 'date', id, value: x.deadline, onchange: (e) => { if (isDatum(e.target.value)) app.wijzig((s) => { s.overrides = zetHandmatig(s.overrides, x.sleutel, e.target.value); }); } }),
      x.handmatig
        ? h('span', { class: 'kleiner' }, `Zelf aangepast${x.berekend ? `. Berekend was ${formatLang(x.berekend.deadline)}` : ''}. `,
          knop('Terug naar berekende datum', () => app.wijzig((s) => { s.overrides = wisselNaarBerekend(s.overrides, x.sleutel); })))
        : null);
  });
}

/**
 * One task: the checkbox, the title, the link to the explanation and the date when there is one.
 * Everything else (priority, changing the date, "niet van toepassing") sits behind one "Aanpassen".
 */
function taakRegel(t, extra = '', prefix = 'taken') {
  const id = `af-${prefix}-${t.id}`;
  const klaar = app.state.afgevinkt.includes(t.id);
  const r = vroegsteDeadline(t);
  const datum = r ? `${soortNaam(r.soort)}: ${formatLang(r.deadline)} (${dagenTekst(verschilDagen(vandaag(), r.deadline))})` : '';
  const zonder = r ? null : rekenItem(t, motorState()).find((x) => x.onbekend);
  const hint = zonder ? `Vul je ${ankerNaam(zonder.anker).toLowerCase()} in voor de datum.` : '';
  // "Nu aandacht" shows at most three tasks, so there the hint about a missing date is in sight.
  const zichtbaar = [datum, prefix === 'aand' ? hint : '', extra].filter(Boolean).join(' ');
  const velden = datumVelden(t, prefix);
  return h('li', { class: `taakregel${klaar ? ' klaar' : ''}` },
    h('input', { type: 'checkbox', id, checked: klaar, onchange: (e) => { wissel('afgevinkt', t.id); if (e.target.checked) track('taak_afgevinkt'); } }),
    h('label', { for: id }, t.titel),
    h('a', { href: taakUrl(t), class: 'uitleg' }, 'Uitleg'),
    zichtbaar ? h('span', { class: 'kleiner regelinfo' }, zichtbaar) : null,
    uitklap(`taak-${prefix}-${t.id}`, 'Aanpassen', { class: `regelinfo taakmeer${velden.length ? ' datumaanpassing' : ''}` },
      h('p', { class: 'kleiner' }, `Prioriteit: ${PRIO[t.prio].toLowerCase()}.`, prefix !== 'aand' && hint ? ` ${hint}` : ''),
      velden,
      h('p', null, knop('Niet van toepassing', () => wissel('nietVanToepassing', t.id)))));
}

function kopBlok() {
  if (app.state.intake) return null;
  return h('section', { class: 'blok uitnodiging' },
    h('h2', null, 'Begin met een paar vragen'),
    h('p', null, 'Met een paar korte vragen zie je hier wat nu aandacht vraagt. Je kunt alles ook zonder lezen: de taken en artikelen staan open.'),
    h('p', null, h('a', { class: 'knop', href: siteUrl('intake/') }, 'Start de vragen'), ' ', h('a', { href: siteUrl('taken/') }, 'Ik kijk eerst rond')));
}

/** Right after the questions the summary says once that the plan is ready. The mark is read once and then removed. */
let welkom = false;
try {
  welkom = sessionStorage.getItem('vb:welkom') === '1';
  sessionStorage.removeItem('vb:welkom');
} catch { /* no session storage: no welcome */ }

/** One short summary on top: the days until the move and how far you are with the tasks of this moment. */
function overzichtBlok(c) {
  if (!app.state.intake) return null;
  const verhuisdatum = app.state.datums.verhuisdatum;
  const dagen = isDatum(verhuisdatum) ? verschilDagen(vandaag(), verhuisdatum) : null;
  const aftellen = dagen === null
    ? h('p', { class: 'overzicht-groot' }, 'Je verhuisdatum staat er nog niet in. ', h('a', { href: '#datums' }, 'Vul je datums in'))
    : dagen > 0
      ? h('p', { class: 'overzicht-groot' }, h('strong', null, `Nog ${dagen} ${dagen === 1 ? 'dag' : 'dagen'}`), ` tot je verhuisdag, ${formatLang(verhuisdatum)}.`)
      : dagen === 0
        ? h('p', { class: 'overzicht-groot' }, h('strong', null, 'Vandaag'), ' is je verhuisdag.')
        : h('p', { class: 'overzicht-groot' }, `Je verhuisdag was ${formatLang(verhuisdatum)}.`);
  const ids = taken.filter((t) => itemActief(t, c)).map((t) => t.id);
  const vg = voortgang(ids, motorState());
  return h('section', { class: 'blok overzicht', 'aria-label': 'Je verhuizing in het kort' },
    welkom ? h('p', { class: 'welkom' }, h('strong', null, 'Je plan staat klaar.'), ' Hieronder staat wat nu aandacht vraagt, hooguit drie dingen tegelijk. De rest staat eronder klaar voor later.') : null,
    aftellen,
    vg.totaal ? h('p', { class: 'overzicht-voortgang' },
      h('progress', { class: 'voortgangsbalk', max: String(vg.totaal), value: String(vg.klaar), 'aria-label': 'Voortgang van je taken voor nu' }),
      h('span', { class: 'kleiner' }, `${vg.klaar} van ${vg.totaal} taken voor nu gedaan`)) : null);
}

let bericht = null;

/** A short confirmation after a big step (saved, restored, shared). It goes away by itself after ten seconds. */
function meld(tekst) {
  bericht = { tekst, t: Date.now() };
  render();
  setTimeout(() => {
    if (bericht && Date.now() - bericht.t >= 9500) {
      bericht = null;
      render();
    }
  }, 10000);
}

function meldingBlok() {
  const m = app.melding;
  return m ? h('p', { class: 'conceptbalk', role: 'alert' }, m) : null;
}

function berichtBlok() {
  return bericht ? h('p', { class: 'bericht', role: 'status' }, bericht.tekst) : null;
}

function statusKaarten(c) {
  const nvt = new Set(app.state.nietVanToepassingSporen ?? []);
  const sporen = SPOOR_VOLGORDE.filter((s) => model.sporen[s] && (c.sporen.has(s) || nvt.has(s)));
  if (sporen.length === 0) return null;
  const zet = (spoor, moment) => app.wijzig((s) => { s.momenten[spoor] = moment; });
  const kaart = (spoor) => {
    const def = model.sporen[spoor];
    const naam = h('span', { class: 'statusnaam' }, def.naam);
    if (nvt.has(spoor)) {
      return h('div', { class: 'statuskaart nvt' }, h('h3', null, naam, ': niet van toepassing'),
        h('div', { class: 'knoppen' }, knop('Weer aanzetten', () => app.wijzig((s) => { s.nietVanToepassingSporen = s.nietVanToepassingSporen.filter((x) => x !== spoor); }))));
    }
    const huidig = c.momenten[spoor];
    const moment = def.momenten.find((m) => m.id === huidig);
    const terug = vorigMoment(model, spoor, huidig);
    const vooruit = volgendMoment(model, spoor, huidig);
    return h('div', { class: 'statuskaart' },
      h('h3', null, naam, `: ${moment.status}`),
      h('div', { class: 'knoppen' },
        knop('Terug', () => zet(spoor, terug), !terug),
        knop('Vooruit', () => zet(spoor, vooruit), !vooruit),
        def.altijd_actief ? null : knop('Niet van toepassing', () => app.wijzig((s) => { if (!s.nietVanToepassingSporen.includes(spoor)) s.nietVanToepassingSporen.push(spoor); }))));
  };
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-status' }, h('h2', { id: 'kop-status' }, 'Waar sta je?'),
    h('p', { class: 'kleiner' }, 'Ben je een stap verder? Tik op Vooruit en je taken schuiven mee.'),
    h('div', { class: 'statuskaarten' }, sporen.map(kaart)));
}

function aandachtBlok(c) {
  const r = nuAandacht(taken, motorState(), c, vandaag());
  // The date and the number of days are already in the line of the task. Only an expired deadline gets a word of its own.
  const reden = (x) => (x.reden === 'verlopen' ? 'Verlopen.' : '');
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-aandacht' },
    h('h2', { id: 'kop-aandacht' }, 'Nu aandacht'),
    r.items.length === 0
      ? h('p', null, app.state.intake ? 'Er staat nu niets dringends open.' : 'Doe eerst de vragen, dan zie je hier wat nu aandacht vraagt.')
      : h('ol', { class: 'taakregels' }, r.items.map((x) => taakRegel(x.item, reden(x), 'aand'))),
    r.meer > 0 ? h('p', null, h('a', { href: '#taken' }, `en nog ${r.meer} open`)) : null);
}

function deadlineBlok(c) {
  const kandidaten = taken
    .filter((t) => itemActief(t, c) && !app.state.afgevinkt.includes(t.id) && !app.state.nietVanToepassing.includes(t.id))
    .map((t) => ({ t, r: vroegsteDeadline(t) }))
    .filter((x) => x.r && x.r.soort !== 'richtlijn' && x.r.deadline >= vandaag())
    .sort((a, b) => (a.r.deadline < b.r.deadline ? -1 : 1));
  const eerste = kandidaten[0];
  // Without a deadline there is nothing to say here. The block "Vul in" asks for the date that is missing.
  if (!eerste) return null;
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-deadline' }, h('h2', { id: 'kop-deadline' }, 'Eerstvolgende deadline'),
    h('p', null, h('strong', null, dagenTekst(verschilDagen(vandaag(), eerste.r.deadline))), `: ${eerste.t.titel}, ${formatLang(eerste.r.deadline)} (${soortNaam(eerste.r.soort)}). `, h('a', { href: taakUrl(eerste.t) }, 'Uitleg')));
}

/** The timeline (TL-02): everything with a date that is still open, in the order of the dates. */
function tijdlijnBlok(c) {
  const rijen = taken
    .filter((t) => itemRelevant(t, c) && !app.state.afgevinkt.includes(t.id) && !app.state.nietVanToepassing.includes(t.id))
    .map((t) => ({ t, r: vroegsteDeadline(t) }))
    .filter((x) => x.r)
    .sort((a, b) => (a.r.deadline < b.r.deadline ? -1 : a.r.deadline > b.r.deadline ? 1 : a.t.prio - b.t.prio));
  if (rijen.length === 0) return null;
  const regel = ({ t, r }) => {
    const dagen = verschilDagen(vandaag(), r.deadline);
    return h('li', { class: `soort-${r.soort}${dagen < 0 && r.soort !== 'richtlijn' ? ' verlopen' : ''}` },
      h('time', { datetime: r.deadline }, formatLang(r.deadline)), ' ',
      h('span', null, t.titel), ' ',
      h('span', { class: 'badge' }, soortNaam(r.soort)), ' ',
      h('span', { class: 'kleiner' }, dagenTekst(dagen)), ' ',
      h('a', { href: taakUrl(t) }, 'Uitleg'));
  };
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-tijdlijn' },
    h('h2', { id: 'kop-tijdlijn' }, 'Tijdlijn'),
    h('p', { class: 'kleiner' }, 'Alles wat een datum heeft en nog open staat, in volgorde van de datum.'),
    uitklap('tijdlijn', `Toon de tijdlijn (${rijen.length} ${rijen.length === 1 ? 'datum' : 'datums'})`, null, h('ol', { class: 'tijdlijn' }, rijen.map(regel))));
}

let verschuivingInfo = null;

/** After an anchor date changed: which calculated dates moved, which manual dates stay and which tasks now have a date (overzicht 6.6). */
function bepaalVerschuiving(oudeDatums, naam) {
  const c = maakCtx();
  const v = verschuiving(taken.filter((t) => itemRelevant(t, c)), { datums: oudeDatums }, { datums: app.state.datums, overrides: app.state.overrides });
  verschuivingInfo = v.aangepast.length || v.gelaten.length || v.nieuw.length ? { ...v, naam } : null;
  render();
}

function verschuivingBlok() {
  const v = verschuivingInfo;
  if (!v) return null;
  const n = (aantal, een, meer) => `${aantal} ${aantal === 1 ? een : meer}`;
  const lijst = (items, tekst) => h('ul', { class: 'kleiner' }, items.slice(0, 5).map((x) => h('li', null, tekst(x))), items.length > 5 ? h('li', null, `en nog ${items.length - 5}`) : null);
  const naamKlein = v.naam.toLowerCase();
  return h('section', { class: 'blok uitnodiging verschuiving', role: 'status', 'aria-labelledby': 'kop-verschuiving' },
    h('h2', { id: 'kop-verschuiving' }, `Je ${naamKlein} is veranderd`),
    v.aangepast.length ? [h('p', null, `${n(v.aangepast.length, 'berekende datum is', 'berekende datums zijn')} meegeschoven.`), lijst(v.aangepast, (x) => `${x.titel}: van ${formatLang(x.van)} naar ${formatLang(x.naar)}`)] : null,
    v.gelaten.length ? [h('p', null, `${n(v.gelaten.length, 'datum die je zelf had aangepast blijft', 'datums die je zelf had aangepast blijven')} staan.`),
      h('ul', { class: 'kleiner' }, v.gelaten.map((x) => h('li', null, `${x.titel}: jij koos ${formatLang(x.handmatig)}. Berekend zou het nu ${formatLang(x.berekendNu)} zijn. `,
        knop('Gebruik de berekende datum', () => {
          app.wijzig((s) => { s.overrides = wisselNaarBerekend(s.overrides, x.sleutel); });
          verschuivingInfo = { ...verschuivingInfo, gelaten: verschuivingInfo.gelaten.filter((y) => y.sleutel !== x.sleutel) };
          if (!verschuivingInfo.aangepast.length && !verschuivingInfo.gelaten.length && !verschuivingInfo.nieuw.length) verschuivingInfo = null;
          render();
        }))))] : null,
    v.nieuw.length ? h('p', null, `${n(v.nieuw.length, 'taak heeft', 'taken hebben')} nu een datum.`) : null,
    knop('Sluiten', () => { verschuivingInfo = null; render(); }));
}

function datumVeld(id, naam, hint) {
  return h('div', { class: 'datumveld' },
    h('label', { for: `d-${id}` }, naam),
    h('input', { type: 'date', id: `d-${id}`, value: isDatum(app.state.datums[id]) ? app.state.datums[id] : '', onchange: (e) => { const oud = structuredClone(app.state.datums); app.wijzig((s) => { if (isDatum(e.target.value)) s.datums[id] = e.target.value; else delete s.datums[id]; }); if (isDatum(e.target.value)) track('datum_ingevuld'); bepaalVerschuiving(oud, naam); } }),
    hint ? h('span', { class: 'kleiner' }, hint) : null);
}

/** The move window (TL-03, overzicht 2.4 punt 4): only once two dates are known. */
function vensterBlok() {
  const v = bouwVenster(app.state.datums, app.data.gemeenteVenster);
  if (!v.zichtbaar) return null;
  const punten = [];
  v.punten.forEach((p, i) => {
    punten.push(h('li', { class: 'venster-punt' }, h('strong', null, formatLang(p.datum)), ` ${p.naam} `, h('span', { class: 'badge' }, soortNaam('ingevuld'))));
    const tussenin = v.tussen[i];
    if (tussenin) punten.push(h('li', { class: 'venster-tussen kleiner', 'aria-hidden': 'true' }, `${tussenin.dagen} ${tussenin.dagen === 1 ? 'dag' : 'dagen'}`));
  });
  return h('section', { class: 'blok', id: 'verhuisvenster', 'aria-labelledby': 'kop-venster' },
    h('h2', { id: 'kop-venster' }, 'Je verhuisvenster'),
    h('ol', { class: 'venster' }, punten),
    v.gemeente ? h('p', { class: 'kleiner' }, `Verhuizing doorgeven aan de gemeente (${soortNaam('wettelijk').toLowerCase()}): van ${formatLang(v.gemeente.van)} tot ${formatLang(v.gemeente.tot)}.`) : null,
    v.melding ? h('p', { class: 'melding', role: 'status' }, v.melding.tekst, ' ', app.data.paginas.dilemma ? h('a', { href: siteUrl(app.data.paginas.dilemma) }, 'Lees meer over dubbele woonlasten') : null) : null,
    h('p', { class: 'kleiner' }, h('a', { href: '#datums' }, 'Pas je datums aan')));
}

/** The dates of the visitor, to fill in or change. */
function datumsBlok(c) {
  const v = bouwVenster(app.state.datums, app.data.gemeenteVenster);
  const relevant = VENSTER_PUNTEN.filter((p) => model.ankers.find((a) => a.id === p.id && c.sporen.has(a.spoor)));
  return h('section', { class: 'blok', id: 'datums', 'aria-labelledby': 'kop-datums' },
    h('h2', { id: 'kop-datums' }, 'Jouw datums'),
    h('div', { class: 'datumvelden' }, relevant.map((p) => datumVeld(p.id, p.naam, model.ankers.find((a) => a.id === p.id).hint))),
    v.zichtbaar ? null : h('p', { class: 'kleiner' }, 'Vul minstens twee datums in en je ziet op deze pagina de dagen ertussen: je verhuisvenster.'));
}

function vulInBlok(c) {
  const kandidaat = taken
    .filter((t) => t.tijd?.anker && itemActief(t, c) && !app.state.afgevinkt.includes(t.id))
    .sort((a, b) => a.prio - b.prio)
    .map((t) => ({ t, a: model.ankers.find((x) => x.id === t.tijd.anker) }))
    .find((x) => x.a && !(app.state.datums[x.a.id] && (!Array.isArray(app.state.datums[x.a.id]) || app.state.datums[x.a.id].length)));
  if (!kandidaat) return null;
  const { t, a } = kandidaat;
  let label = '';
  let datum = '';
  const voeg = () => {
    if (!isDatum(datum)) return;
    const oud = structuredClone(app.state.datums);
    app.wijzig((s) => { s.datums[a.id] = a.meervoudig ? [...(Array.isArray(s.datums[a.id]) ? s.datums[a.id] : []), { label: schoonLabel(label), waarde: datum }] : datum; });
    track('datum_ingevuld');
    bepaalVerschuiving(oud, a.naam);
  };
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-vulin' },
    h('h2', { id: 'kop-vulin' }, 'Vul in'),
    h('p', null, `Voor "${t.titel}" heb je je ${a.naam.toLowerCase()} nodig. ${a.hint}`),
    a.meervoudig ? h('div', { class: 'datumveld' }, h('label', { for: 'vulin-label' }, 'Welke voorwaarde (bijvoorbeeld financiering)'), h('input', { type: 'text', id: 'vulin-label', maxlength: '60', oninput: (e) => { label = e.target.value; } })) : null,
    h('div', { class: 'datumveld' }, h('label', { for: 'vulin-datum' }, a.naam), h('input', { type: 'date', id: 'vulin-datum', oninput: (e) => { datum = e.target.value; } })),
    knop('Bewaar deze datum', voeg, false, 'knop'),
    h('p', { class: 'kleiner' }, 'Controleer dit in je koopovereenkomst of contract. Dat is leidend.'));
}

function takenBlok(c) {
  const rijen = dashboardVolgorde(taken, motorState(), c);
  const verborgen = new Set(app.state.nietVanToepassing);
  const gedaan = new Set(app.state.afgevinkt);
  const n = (aantal) => `${aantal} ${aantal === 1 ? 'taak' : 'taken'}`;
  const blokken = rijen.map((r) => {
    const def = model.sporen[r.spoor];
    const m = def.momenten.find((x) => x.id === r.moment);
    const alle = taken.filter((t) => t.spoor.includes(r.spoor) && t.moment.includes(r.moment) && itemActief(t, c));
    // A moment without tasks says nothing: leave it out. The status card of the part stays.
    if (alle.length === 0) return null;
    const telbaar = alle.filter((t) => !verborgen.has(t.id));
    const openTaken = sorteerTaken(telbaar.filter((t) => !gedaan.has(t.id)), motorState());
    const klaar = sorteerTaken(telbaar.filter((t) => gedaan.has(t.id)), motorState());
    const weg = alle.filter((t) => verborgen.has(t.id));
    const eerst = openTaken.slice(0, MAX_TAKEN_ZICHTBAAR);
    const rest = openTaken.slice(MAX_TAKEN_ZICHTBAAR);
    const vg = voortgang(alle.map((t) => t.id), motorState());
    const sleutel = `${r.spoor}-${r.moment}`;
    const hierna = def.momenten.find((x) => x.id === volgendMoment(model, r.spoor, r.moment));
    return h('div', { class: 'taakgroep' },
      h('h3', null, `${def.naam}: ${m.naam}`),
      h('p', { class: 'kleiner' }, `${vg.klaar} van ${vg.totaal} gedaan`),
      eerst.length
        ? h('ol', { class: 'taakregels' }, eerst.map((t) => taakRegel(t)))
        : h('p', { class: 'kleiner' }, telbaar.length ? 'Alle taken van dit moment zijn gedaan.' : 'Geen taken voor dit moment.'),
      // Nothing open any more: offer the next moment, so the visitor does not have to find the status buttons.
      eerst.length === 0 && hierna ? h('p', null, knop(`Volgende stap: ${hierna.naam.toLowerCase()}`, () => app.wijzig((s) => { s.momenten[r.spoor] = hierna.id; }), false, 'knop knop-klein')) : null,
      rest.length ? uitklap(`rest-${sleutel}`, `Toon nog ${n(rest.length)}`, { class: 'meer-taken' }, h('ol', { class: 'taakregels' }, rest.map((t) => taakRegel(t)))) : null,
      klaar.length ? uitklap(`gedaan-${sleutel}`, `Gedaan (${klaar.length})`, { class: 'meer-taken' }, h('ol', { class: 'taakregels' }, klaar.map((t) => taakRegel(t)))) : null,
      weg.length ? uitklap(`nvt-${sleutel}`, `Niet van toepassing (${weg.length})`, { class: 'meer-taken' }, h('ul', null, weg.map((t) => h('li', null, t.titel, ' ', knop('Weer tonen', () => wissel('nietVanToepassing', t.id)))))) : null);
  }).filter(Boolean);
  if (blokken.length === 0) return null;
  return h('section', { class: 'blok', id: 'taken', 'aria-labelledby': 'kop-taken' }, h('h2', { id: 'kop-taken' }, 'Taken voor nu'), blokken);
}

function agendaExport(c) {
  const geselecteerd = taken.filter((t) => itemRelevant(t, c) && !app.state.afgevinkt.includes(t.id) && !app.state.nietVanToepassing.includes(t.id));
  const gebeurtenissen = gebeurtenissenUitItems(geselecteerd, motorState(), { model, tipsUitsluiten: app.state.instellingen.tipsInAgenda === false });
  if (gebeurtenissen.length === 0) return;
  const teller = (app.state.exportTeller ?? 0) + 1;
  download(maakIcs(gebeurtenissen, { volgnummer: teller }), 'text/calendar', 'verhuisbegeleiding-agenda.ics');
  app.wijzig((s) => { s.exportTeller = teller; });
  track('agenda_geexporteerd');
}

/** The fixed strip with the tools (overzicht 3.1, punt 9). It is always there, also without an intake. */
function gereedschapStrook() {
  const lijst = app.data.gereedschap ?? [];
  if (lijst.length === 0) return null;
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-tools' },
    h('h2', { id: 'kop-tools' }, 'Gereedschap'),
    h('ul', { class: 'linkrij' }, lijst.map((g) => h('li', null, h('a', { href: siteUrl(g.pad) }, g.titel)))));
}

/** Where to read more: background articles, the glossary and search (overzicht 2.4, punt 7). */
function achtergrondStrook() {
  const p = app.data.paginas ?? {};
  const links = [[p.achtergrond, 'Achtergrond'], [p.begrippen, 'Begrippen'], [p.ai, 'AI-gids'], [p.zoeken, 'Zoeken']].filter(([pad]) => pad);
  if (links.length === 0) return null;
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-meer' },
    h('h2', { id: 'kop-meer' }, 'Lees verder'),
    h('ul', { class: 'linkrij' }, links.map(([pad, titel]) => h('li', null, h('a', { href: siteUrl(pad) }, titel)))));
}

function bewarenEnAgendaBlok(c) {
  return h('section', { class: 'blok', 'aria-labelledby': 'kop-gereedschap' },
    h('h2', { id: 'kop-gereedschap' }, 'Bewaren en agenda'),
    bewarenOnderdeel(app, { model, meld, opnieuw: render }),
    h('div', { class: 'agenda' },
      h('h3', null, 'Deadlines in je agenda'),
      optieBox('tips', 'Neem onze tips ook mee', app.state.instellingen.tipsInAgenda !== false, (aan) => app.wijzig((s) => { s.instellingen.tipsInAgenda = aan; })),
      knop('Download agenda (.ics)', () => agendaExport(c), false, 'knop')));
}

function optieBox(id, tekst, aan, bijWijziging) {
  return h('label', { class: 'keuze', for: `opt-${id}` }, h('input', { type: 'checkbox', id: `opt-${id}`, checked: aan, onchange: (e) => bijWijziging(e.target.checked) }), h('span', null, tekst));
}

function voetBlok() {
  return h('section', { class: 'blok' },
    h('p', null, h('a', { href: siteUrl('intake/') }, 'Wijzig je antwoorden')),
    h('p', { class: 'kleiner' }, 'Wissen haalt alles weg wat de site op dit apparaat heeft bewaard: je antwoorden, datums, afgevinkte taken, het kostenoverzicht, de zakenlijst, je dossier en de meubelplanner. Bewaar eerst een bestand als je iets wilt houden.'),
    knop(wisBevestig ? 'Zeker weten? Tik nog een keer' : 'Alle gegevens op dit apparaat wissen', () => {
      if (!wisBevestig) { wisBevestig = true; render(); setTimeout(() => { wisBevestig = false; render(); }, 4000); return; }
      wisAlleGegevens();
      wisBevestig = false;
      window.location.reload();
    }));
}

function render() {
  const behoud = document.activeElement?.id;
  const c = maakCtx();
  leeg(root);
  root.append(...[ontvangst && !ontvangst.klaar ? ontvangst.element : null, berichtBlok(), meldingBlok(), verschuivingBlok(), kopBlok(), overzichtBlok(c), aandachtBlok(c), deadlineBlok(c), statusKaarten(c), vensterBlok(), vulInBlok(c), takenBlok(c), tijdlijnBlok(c), datumsBlok(c), achtergrondStrook(), gereedschapStrook(), bewarenEnAgendaBlok(c), voetBlok()].filter(Boolean));
  if (behoud) document.getElementById(behoud)?.focus();
}

let ontvangst = await maakOntvangst(app, { model, meld, opnieuw: render });
// A link pasted into the tab that is already open only changes the fragment. The page is not loaded again, so listen for it.
window.addEventListener('hashchange', async () => {
  ontvangst = await maakOntvangst(app, { model, meld, opnieuw: render });
  render();
});
app.luisteraars.add(render);
render();
