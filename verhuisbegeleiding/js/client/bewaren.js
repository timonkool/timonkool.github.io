// Saving and sharing (TL-06): the state as a file, through the share sheet of the phone where that works, restoring from
// a file, a message with "laatst bewaard", and the share link for a partner (only when the build switched it on).
// Everything stays on the device. A link carries the state in its fragment, which is never sent to a server.

import { h, voeg } from './dom.js';
import { deelOfDownload } from './bestand.js';
import { exporteer, importeer } from '../lib/opslag.js';
import { maakDeellink, leesDeellink } from '../lib/deellink.js';
import { formatLang } from '../lib/datum.js';
import { opties } from './opties.js';
import { siteUrl } from './state.js';

const BESTAND = 'verhuisbegeleiding-status.json';
const TWEE_WEKEN_MS = 14 * 24 * 3600 * 1000;

const knop = (tekst, bijKlik, klasse = 'knop knop-klein knop-rustig') => h('button', { type: 'button', class: klasse, onclick: bijKlik }, tekst);

function lokaleDatum(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "8 oktober 2026 om 14:32" in the time of the visitor. */
export function dagTijd(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatLang(lokaleDatum(d))} om ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
}

export function heeftInhoud(state) {
  return Boolean(state.intake) || state.afgevinkt.length > 0 || state.nietVanToepassing.length > 0 || Object.keys(state.datums).length > 0;
}

/** Where the data was last saved, in one or two sentences. */
export function statusTekst(app) {
  const delen = [];
  if (app.status === 'geblokkeerd') delen.push('Je browser laat geen opslag toe, dus er wordt niets bewaard op dit apparaat.');
  else if (app.state.laatstBewaard) delen.push(`Laatst bewaard in deze browser: ${dagTijd(app.state.laatstBewaard)}.`);
  delen.push(app.state.laatstBestand ? `Laatst als bestand bewaard: ${dagTijd(app.state.laatstBestand)}.` : 'Nog niet als bestand bewaard.');
  return delen.join(' ');
}

/** A reminder to save a file, or null when that is not needed. */
export function herinneringTekst(state, nu = Date.now()) {
  if (!heeftInhoud(state)) return null;
  if (!state.laatstBestand) {
    return 'Bewaar je gegevens ook als bestand. Sommige browsers, zoals Safari, kunnen opgeslagen gegevens van een site opruimen als je die een tijd niet gebruikt.';
  }
  const t = Date.parse(state.laatstBestand);
  if (!Number.isNaN(t) && nu - t > TWEE_WEKEN_MS) return 'Je laatste bestand is van meer dan twee weken geleden. Bewaar een nieuw bestand, dan raak je geen werk kwijt.';
  return null;
}

/**
 * Offer the state as a file. On a phone this opens the share sheet, so the file can go to a mail, a chat or a cloud folder.
 * Without a share sheet it becomes a download.
 * @returns {Promise<'gedeeld'|'gedownload'|'afgebroken'>}
 */
export async function bewaarBestand(app) {
  const nu = new Date().toISOString();
  const tekst = exporteer({ ...app.state, laatstBestand: nu });
  const uitkomst = await deelOfDownload({ tekst, naam: BESTAND, titel: 'Mijn verhuisplanning' });
  if (uitkomst === 'afgebroken') return uitkomst;
  app.wijzig((s) => { s.laatstBestand = nu; });
  return uitkomst;
}

/** The dates in a state as lines of text, so the visitor sees exactly what a link would contain. */
export function datumRegels(state, model) {
  const regels = [];
  for (const a of model.ankers) {
    const w = state.datums[a.id];
    if (Array.isArray(w)) for (const x of w) regels.push(`${a.naam}${x.label ? ` (${x.label})` : ''}: ${formatLang(x.waarde)}`);
    else if (typeof w === 'string') regels.push(`${a.naam}: ${formatLang(w)}`);
  }
  return regels;
}

async function kopieer(tekst, veld) {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    try {
      veld.select();
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

const deel = { open: false, bezig: false, link: null, fout: null, gekopieerd: false };

function deelBlok(app, { model, opnieuw }) {
  if (!opties.deellink) return null;
  if (!deel.open) {
    return h('div', { class: 'deelblok' },
      h('h3', null, 'Deel met je partner'),
      h('p', { class: 'kleiner' }, 'Maak een link met je planning, voor iemand die met je meeverhuist. De link gaat nergens naartoe, tot jij hem verstuurt.'),
      knop('Maak een link', () => { Object.assign(deel, { open: true, link: null, fout: null, gekopieerd: false }); opnieuw(); }));
  }
  const regels = datumRegels(app.state, model);
  const maak = async () => {
    deel.bezig = true;
    opnieuw();
    const r = await maakDeellink(app.state, siteUrl('dashboard/'));
    deel.bezig = false;
    if (r.ok) Object.assign(deel, { link: r.url, fout: null });
    else Object.assign(deel, { link: null, fout: 'De link is te lang geworden voor een bericht. Bewaar je gegevens als bestand en stuur dat bestand.' });
    opnieuw();
  };
  const veld = h('input', { type: 'text', readonly: true, id: 'deellink-tekst', 'aria-label': 'Je link', value: deel.link ?? '' });
  return h('div', { class: 'deelblok' },
    h('h3', null, 'Deel met je partner'),
    h('p', null, 'In de link staan je antwoorden op de vijf vragen, je datums, de momenten die je hebt gekozen en welke taken je hebt afgevinkt. Wie de link heeft, kan dat lezen. De link gaat niet via onze site, maar wel via de app waarmee je hem verstuurt.'),
    h('p', { class: 'kleiner' }, regels.length ? 'Deze datums komen in de link:' : 'Je hebt nog geen datums ingevuld, dus die staan er niet in.'),
    regels.length ? h('ul', { class: 'kleiner' }, regels.map((r) => h('li', null, r))) : null,
    deel.fout ? h('p', { class: 'fout', role: 'alert' }, deel.fout) : null,
    deel.link
      ? h('div', null,
        h('label', { for: 'deellink-tekst' }, 'Je link'),
        veld,
        h('div', { class: 'knoppen' },
          knop('Kopieer de link', async () => { deel.gekopieerd = await kopieer(deel.link, veld); opnieuw(); }),
          navigator.share ? knop('Deel de link', () => navigator.share({ title: 'Mijn verhuisplanning', url: deel.link }).catch(() => {})) : null),
        deel.gekopieerd ? h('p', { class: 'kleiner', role: 'status' }, 'De link is gekopieerd.') : null)
      : h('p', null, knop(deel.bezig ? 'Even wachten...' : 'Maak de link', maak, 'knop')),
    knop('Sluiten', () => { Object.assign(deel, { open: false, link: null, fout: null }); opnieuw(); }));
}

/**
 * The part of the dashboard for saving: status line, reminder, file buttons and the share link.
 * @param {{model: object, meld: (tekst: string) => void, opnieuw: () => void}} ctx
 */
export function bewarenOnderdeel(app, ctx) {
  const { model, meld, opnieuw } = ctx;
  const herinnering = herinneringTekst(app.state);
  const invoer = h('input', { type: 'file', id: 'importbestand', class: 'verborgen-invoer', accept: '.json,application/json', onchange: async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const r = importeer(await f.text(), model);
    if (!r.ok) { app.melding = r.problemen[0]; opnieuw(); return; }
    app.melding = null;
    app.vervang(r.state);
    meld('Je gegevens zijn teruggezet uit het bestand.');
  } });
  return h('div', { class: 'bewaren' },
    h('p', { class: 'kleiner', role: 'status' }, statusTekst(app)),
    herinnering ? h('p', { class: 'herinnering' }, herinnering) : null,
    h('p', { class: 'kleiner' }, 'Je gegevens staan alleen op dit apparaat. Bewaar ze af en toe als bestand, zodat je ze niet kwijtraakt.'),
    h('div', { class: 'knoppen' },
      knop('Bewaar als bestand', async () => {
        const uitkomst = await bewaarBestand(app);
        if (uitkomst === 'gedeeld') meld('Bestand gedeeld. Het staat nu ook buiten dit apparaat.');
        else if (uitkomst === 'gedownload') meld('Bestand bewaard. Kijk in je downloads en zet het op een plek buiten dit apparaat.');
      }, 'knop'),
      h('label', { class: 'knop knop-rustig bestandsknop' }, 'Bestand terugzetten', invoer)),
    deelBlok(app, ctx));
}

/**
 * When the page is opened with a share link, offer to use it. Nothing is applied before the visitor says so.
 * @returns {Promise<{element: HTMLElement, klaar: boolean}|null>}
 */
export async function maakOntvangst(app, { model, meld, opnieuw }) {
  if (!opties.deellink || !window.location.hash.startsWith('#d=')) return null;
  const r = await leesDeellink(window.location.hash, model);
  const uit = { element: h('section', { class: 'blok uitnodiging', 'aria-labelledby': 'kop-ontvangst' }), klaar: false };
  let zeker = false;
  const wisHash = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const sluit = () => { wisHash(); uit.klaar = true; opnieuw(); };
  const teken = () => {
    uit.element.replaceChildren();
    uit.element.append(h('h2', { id: 'kop-ontvangst' }, 'Er zit een planning in deze link'));
    if (!r.ok) {
      uit.element.append(h('p', { role: 'alert' }, r.problemen[0]), knop('Sluiten', sluit));
      return;
    }
    const regels = datumRegels(r.state, model);
    const bevat = heeftInhoud(app.state);
    voeg(uit.element,
      h('p', null, `De link bevat ${regels.length} ${regels.length === 1 ? 'datum' : 'datums'} en ${r.state.afgevinkt.length} ${r.state.afgevinkt.length === 1 ? 'afgevinkte taak' : 'afgevinkte taken'}.`),
      regels.length ? h('ul', { class: 'kleiner' }, regels.map((x) => h('li', null, x))) : null,
      bevat ? h('p', { class: 'herinnering' }, 'Als je deze planning gebruikt, wordt wat je nu op dit apparaat hebt vervangen. Wil je dat houden, bewaar het dan eerst als bestand.') : null,
      h('div', { class: 'knoppen' },
        knop(zeker ? 'Zeker weten? Tik nog een keer' : 'Gebruik deze planning', () => {
          if (bevat && !zeker) { zeker = true; teken(); setTimeout(() => { zeker = false; if (!uit.klaar) teken(); }, 4000); return; }
          wisHash();
          uit.klaar = true;
          app.vervang({ ...r.state, laatstBestand: null, exportTeller: app.state.exportTeller, instellingen: app.state.instellingen });
          meld('De planning uit de link wordt nu gebruikt.');
        }, 'knop'),
        knop('Nee, laat mijn gegevens staan', sluit)));
  };
  teken();
  return uit;
}
