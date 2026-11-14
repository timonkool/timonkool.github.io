// The cost overview (TL-09): transfer tax and the NHG fee from the facts in the data, plus the amounts the visitor fills in.
// A calculation aid, no advice. What is typed is saved in the state of the visitor, so it is part of the file from the dashboard.

import { h, leeg, voeg } from './dom.js';
import { laadApp, siteUrl } from './state.js';
import { formatEuro, leesFeiten, nhgGrensCheck, nhgProvisie, overdrachtsbelasting, parseBedrag, procentTekst, somPosten, startersvrijstelling } from '../lib/kosten.js';
import { MAX_POSTEN } from '../lib/schema.js';

const root = document.getElementById('app');
const app = await laadApp();
const gelezen = leesFeiten(app.data.kostenFeiten);

const STANDAARD_POSTEN = ['Notariskosten', 'Taxatie', 'Hypotheekadvies en afsluitkosten', 'Aankoopmakelaar', 'Bouwkundige keuring', 'Verhuiskosten', 'Inrichting en verbouwing'];
const SITUATIE_TEKST = {
  zelf: 'Ik ga er zelf wonen',
  niet_zelf: 'Ik ga er niet zelf wonen (tweede woning of verhuur)',
  overig: 'Het is geen woning (bijvoorbeeld een garagebox of grond)',
};

const kosten = () => app.state.kosten;
const pas = (fn) => app.wijzig((s) => fn(s.kosten));
const jaarNu = new Date().getFullYear();

/** The visible list of posts: the saved ones, or the suggestions as long as nothing was saved yet. */
function posten() {
  if (kosten().posten !== null) return kosten().posten;
  return STANDAARD_POSTEN.map((label, i) => ({ id: `standaard${i + 1}`, label, bedrag: null }));
}

function bronRegel(feit) {
  if (!feit?.bron) return null;
  const status = feit.wetgeving === 'voorgesteld' ? 'voorgesteld' : 'vastgesteld';
  return h('p', { class: 'kleiner' }, `Tarief van ${feit.jaar}, ${status}. Bron: `, h('a', { href: feit.bron.url, rel: 'noopener noreferrer' }, `${feit.bron.instantie ?? feit.bron.titel}`), ', gelezen op ', datumTekst(feit.bron.opgehaald), '.');
}

function datumTekst(iso) {
  const [j, m, d] = String(iso).split('-').map(Number);
  const maanden = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  return `${d} ${maanden[m - 1]} ${j}`;
}

function geldVeld({ id, label, waarde, bijWijziging, hint }) {
  const veld = h('input', { type: 'text', id, inputmode: 'numeric', autocomplete: 'off', value: waarde === null || waarde === undefined ? '' : String(waarde), 'aria-describedby': hint ? `${id}-hint` : null,
    oninput: (e) => {
      const n = parseBedrag(e.target.value);
      e.target.setAttribute('aria-invalid', String(e.target.value.trim() !== '' && n === null));
      bijWijziging(n);
    } });
  return h('div', { class: 'datumveld' }, h('label', { for: id }, label), veld, hint ? h('span', { class: 'kleiner', id: `${id}-hint` }, hint) : null);
}

if (!gelezen.ok) {
  leeg(root);
  root.append(h('p', { class: 'fout', role: 'alert' }, 'De tarieven konden niet worden geladen, dus de rekenhulp werkt nu niet. Probeer het later opnieuw.'));
  throw new Error(`Feiten ontbreken: ${gelezen.ontbreekt.join(', ')}`);
}
const f = gelezen.feiten;

// Outputs that change while typing. The inputs stay where they are, so the cursor never jumps.
const uitOverdracht = h('div', { 'aria-live': 'polite' });
const uitNhg = h('div', { 'aria-live': 'polite' });
const uitTotaal = h('div', { 'aria-live': 'polite' });
const postenBox = h('div');
const startersBox = h('div');

function berekening() {
  const k = kosten();
  const starter = startersvrijstelling({ situatie: k.situatie, leeftijdOk: k.leeftijdOk, nietEerderGebruikt: k.nietEerderGebruikt, koopsom: k.koopsom }, f);
  const od = overdrachtsbelasting({ koopsom: k.koopsom, situatie: k.situatie, starterGeldt: starter.geldt, handmatig: k.handmatig }, f);
  const nhg = nhgProvisie({ hypotheek: k.hypotheek, nhg: k.nhg }, f);
  const andere = somPosten(posten());
  const totaal = (od.bedrag ?? 0) + (nhg?.bedrag ?? 0) + andere;
  return { k, starter, od, nhg, andere, totaal };
}

function tekenUitkomsten() {
  const { k, starter, od, nhg, andere, totaal } = berekening();

  leeg(startersBox);
  if (k.situatie === 'zelf') {
    const reden = starter.nietVoldaan.filter((t) => !/niet zelf wonen/.test(t));
    startersBox.append(
      h('fieldset', null,
        h('legend', null, 'Startersvrijstelling'),
        h('p', { class: 'kleiner' }, `Je krijgt de vrijstelling alleen als je aan alle voorwaarden voldoet. De woningwaarde mag hooguit ${formatEuro(f.grensStarter.waarde)} zijn (${f.grensStarter.jaar}). Hier telt je koopsom als woningwaarde.`),
        h('label', { class: 'keuze', for: 'k-leeftijd' }, h('input', { type: 'checkbox', id: 'k-leeftijd', checked: k.leeftijdOk, onchange: (e) => { pas((x) => { x.leeftijdOk = e.target.checked; }); tekenUitkomsten(); } }),
          h('span', null, `Ik ben op de dag van de akte ${f.leeftijdMin.waarde} jaar of ouder en jonger dan ${f.leeftijdMax.waarde} jaar`)),
        h('label', { class: 'keuze', for: 'k-eerder' }, h('input', { type: 'checkbox', id: 'k-eerder', checked: k.nietEerderGebruikt, onchange: (e) => { pas((x) => { x.nietEerderGebruikt = e.target.checked; }); tekenUitkomsten(); } }),
          h('span', null, 'Ik heb de startersvrijstelling nog niet eerder gebruikt')),
        !starter.geldt && (k.leeftijdOk || k.nietEerderGebruikt || reden.length < 3) ? h('p', { class: 'kleiner' }, `Nog geen vrijstelling: ${reden.join(' ')}`) : null));
  }

  leeg(uitOverdracht);
  if (od.bedrag === null) {
    uitOverdracht.append(h('p', { class: 'kleiner' }, od.reden));
  } else {
    voeg(uitOverdracht,
      h('p', { class: 'uitkomst' }, h('strong', null, `Overdrachtsbelasting: ${formatEuro(od.bedrag)}`),
        od.handmatig ? ' (het bedrag dat je zelf invulde)' : ` (${procentTekst(od.tarief)} procent van de koopsom)`),
      od.feit ? bronRegel(od.feit) : null,
      od.feit && od.feit.jaar !== jaarNu ? h('p', { class: 'kleiner' }, `Let op: dit tarief geldt voor ${od.feit.jaar}. Teken je in een ander jaar, kijk dan bij de Belastingdienst welk tarief dan geldt.`) : null,
      k.situatie === 'niet_zelf' && !od.handmatig ? h('p', { class: 'kleiner' }, `Voorgesteld voor ${f.voorstelNietZelf.jaar}: ${procentTekst(f.voorstelNietZelf.waarde)} procent. Dat is een voorstel en nog geen regel. We rekenen er daarom niet mee.`) : null);
  }

  leeg(uitNhg);
  const grens = nhgGrensCheck({ koopsom: k.koopsom }, f);
  if (k.nhg) {
    if (nhg) {
      voeg(uitNhg, h('p', { class: 'uitkomst' }, h('strong', null, `Borgtochtprovisie NHG: ${formatEuro(nhg.bedrag)}`), ` (${procentTekst(nhg.tarief)} procent van de hypotheek)`), bronRegel(nhg.feit));
    } else {
      uitNhg.append(h('p', { class: 'kleiner' }, 'Vul het bedrag van je hypotheek in om de provisie te zien.'));
    }
    if (grens) {
      uitNhg.append(h('p', { class: 'kleiner' }, grens.binnenGrens
        ? `De NHG-grens is ${formatEuro(grens.grens)} (${grens.feit.jaar}). Je koopsom ligt daaronder. De grens geldt voor het aankoopbedrag inclusief verbouwingskosten.`
        : `De NHG-grens is ${formatEuro(grens.grens)} (${grens.feit.jaar}). Je koopsom ligt daarboven, dus een hypotheek met NHG kan dan niet.`));
    }
  }

  leeg(uitTotaal);
  voeg(uitTotaal,
    h('table', { class: 'kostentabel' },
      h('caption', { class: 'kleiner' }, 'Overzicht van de kosten'),
      h('tbody', null,
        h('tr', null, h('th', { scope: 'row' }, 'Overdrachtsbelasting'), h('td', null, od.bedrag === null ? 'nog niet bekend' : formatEuro(od.bedrag))),
        k.nhg ? h('tr', null, h('th', { scope: 'row' }, 'Borgtochtprovisie NHG'), h('td', null, nhg ? formatEuro(nhg.bedrag) : 'nog niet bekend')) : null,
        h('tr', null, h('th', { scope: 'row' }, 'Andere kosten en verhuiskosten'), h('td', null, formatEuro(andere)))),
      h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Totaal'), h('td', null, formatEuro(totaal))))),
    h('p', { class: 'kleiner' }, 'Kosten koper kun je meestal niet meefinancieren in je hypotheek. Je betaalt ze dus uit eigen geld.'),
    k.eigenGeld !== null
      ? h('p', { class: 'uitkomst' }, totaal <= k.eigenGeld ? `Met je eigen geld van ${formatEuro(k.eigenGeld)} houd je ${formatEuro(k.eigenGeld - totaal)} over.` : `Met je eigen geld van ${formatEuro(k.eigenGeld)} kom je ${formatEuro(totaal - k.eigenGeld)} tekort.`)
      : null);
}

// Posts: the visitor fills in what the sources give no fixed amount for.

function bewaarPosten(nieuw) {
  pas((x) => { x.posten = nieuw.slice(0, MAX_POSTEN); });
}

function tekenPosten(focusId = null) {
  leeg(postenBox);
  const lijst = posten();
  postenBox.append(
    h('ul', { class: 'postenlijst' }, lijst.map((p, i) => h('li', { class: 'post' },
      h('label', { for: `post-${p.id}` }, p.label || 'Eigen post'),
      h('input', { type: 'text', id: `post-${p.id}`, inputmode: 'numeric', autocomplete: 'off', 'aria-label': `${p.label || 'Eigen post'}, bedrag in euro`, value: p.bedrag === null ? '' : String(p.bedrag),
        oninput: (e) => {
          const n = parseBedrag(e.target.value);
          e.target.setAttribute('aria-invalid', String(e.target.value.trim() !== '' && n === null));
          const nieuw = posten().map((x) => ({ ...x }));
          nieuw[i].bedrag = n;
          bewaarPosten(nieuw);
          tekenUitkomsten();
        } }),
      h('button', { type: 'button', class: 'knop knop-klein knop-rustig', 'aria-label': `${p.label || 'Eigen post'} weghalen`, onclick: () => {
        bewaarPosten(posten().filter((_, j) => j !== i));
        tekenPosten();
        tekenUitkomsten();
      } }, 'Weghalen')))));
  if (lijst.length < MAX_POSTEN) {
    const naam = h('input', { type: 'text', id: 'nieuwe-post', maxlength: '60', autocomplete: 'off' });
    postenBox.append(h('form', { class: 'datumveld', onsubmit: (e) => {
      e.preventDefault();
      const label = naam.value.trim();
      if (!label) return;
      const id = `eigen${Date.now().toString(36)}`;
      bewaarPosten([...posten().map((x) => ({ ...x })), { id, label, bedrag: null }]);
      tekenPosten(`post-${id}`);
    } }, h('label', { for: 'nieuwe-post' }, 'Een eigen post toevoegen (bijvoorbeeld "Parkeervergunning")'),
    h('div', { class: 'zoekrij' }, naam, h('button', { type: 'submit', class: 'knop knop-rustig' }, 'Toevoegen'))));
  }
  if (focusId) document.getElementById(focusId)?.focus();
}

function bouw() {
  const k = kosten();
  const situatieRadios = Object.entries(SITUATIE_TEKST).map(([id, tekst]) =>
    h('label', { class: 'keuze', for: `sit-${id}` }, h('input', { type: 'radio', name: 'situatie', id: `sit-${id}`, checked: k.situatie === id, onchange: () => { pas((x) => { x.situatie = id; }); tekenUitkomsten(); } }), h('span', null, tekst)));
  leeg(root); // remove "Even laden..."
  root.append(
    h('p', { class: 'conceptbalk', role: 'note' }, 'Dit is een rekenhulp en geen advies. Je notaris en de Belastingdienst bepalen wat je betaalt. Je invoer blijft op dit apparaat.'),

    h('section', { class: 'blok', 'aria-labelledby': 'kop-od' },
      h('h2', { id: 'kop-od' }, 'Overdrachtsbelasting'),
      geldVeld({ id: 'k-koopsom', label: 'Koopsom in euro', waarde: k.koopsom, bijWijziging: (n) => { pas((x) => { x.koopsom = n; }); tekenUitkomsten(); } }),
      h('fieldset', null, h('legend', null, 'Wat is je situatie?'), situatieRadios),
      startersBox,
      uitOverdracht,
      h('details', null, h('summary', null, 'Ik weet het bedrag al van de notaris of de Belastingdienst'),
        geldVeld({ id: 'k-handmatig', label: 'Overdrachtsbelasting in euro', waarde: k.handmatig, hint: 'Dit bedrag telt dan in plaats van de berekening hierboven.', bijWijziging: (n) => { pas((x) => { x.handmatig = n; }); tekenUitkomsten(); } }))),

    h('section', { class: 'blok', 'aria-labelledby': 'kop-nhg' },
      h('h2', { id: 'kop-nhg' }, 'Hypotheek en NHG'),
      geldVeld({ id: 'k-hypotheek', label: 'Hypotheek in euro', waarde: k.hypotheek, bijWijziging: (n) => { pas((x) => { x.hypotheek = n; }); tekenUitkomsten(); } }),
      h('label', { class: 'keuze', for: 'k-nhg' }, h('input', { type: 'checkbox', id: 'k-nhg', checked: k.nhg, onchange: (e) => { pas((x) => { x.nhg = e.target.checked; }); tekenUitkomsten(); } }), h('span', null, 'Ik neem een hypotheek met NHG')),
      uitNhg),

    h('section', { class: 'blok', 'aria-labelledby': 'kop-posten' },
      h('h2', { id: 'kop-posten' }, 'Andere kosten en verhuiskosten'),
      h('p', { class: 'kleiner' }, 'Hiervoor geven de bronnen geen vast bedrag. Vul in wat je offertes of schattingen zijn. Welke kosten je hebt, hangt af van je situatie.'),
      postenBox),

    h('section', { class: 'blok', 'aria-labelledby': 'kop-totaal' },
      h('h2', { id: 'kop-totaal' }, 'Totaal'),
      uitTotaal,
      geldVeld({ id: 'k-eigen', label: 'Eigen geld dat je hebt (niet verplicht)', waarde: k.eigenGeld, bijWijziging: (n) => { pas((x) => { x.eigenGeld = n; }); tekenUitkomsten(); } }),
      h('div', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-rustig', onclick: () => window.print() }, 'Print dit overzicht')),
      h('p', { class: 'kleiner' }, 'Je invoer wordt bewaard met de rest van je gegevens. Bewaar ze af en toe als bestand op ', h('a', { href: siteUrl('dashboard/') }, 'Mijn verhuizing'), '.')));
  tekenPosten();
  tekenUitkomsten();
}

bouw();
