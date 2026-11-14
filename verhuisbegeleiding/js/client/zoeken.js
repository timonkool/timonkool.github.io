// Search in the browser (TL-10): the index is a local JSON file, the query never leaves the device.

import { h, leeg } from './dom.js';
import { siteUrl } from './state.js';

const INDEX_URL = new URL('../../data/zoekindex.json', import.meta.url);
const veld = document.getElementById('q');
const uitvoer = document.getElementById('resultaten');
const formulier = document.getElementById('zoekformulier');
// Without JavaScript the form stays hidden: submitting it would send the query to the host in the address.
formulier.hidden = false;

const schoon = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// The listeners below are attached at once: a visitor who types before the file has arrived still gets results.
let index = [];
const indexKlaar = fetch(INDEX_URL)
  .then((antwoord) => antwoord.json())
  .then((lijst) => {
    index = lijst.map((e) => ({ ...e, nt: schoon(e.t), ns: schoon(e.s), nx: schoon(e.x) }));
  });
indexKlaar.catch(() => {}); // toon() reports a failed load to the visitor

function zoek(vraag) {
  const termen = schoon(vraag).split(/\s+/).filter((t) => t.length > 1);
  if (termen.length === 0) return [];
  return index
    .map((e) => {
      let score = 0;
      for (const t of termen) {
        const inTitel = e.nt.includes(t);
        const inSamen = e.ns.includes(t);
        const inTekst = e.nx.includes(t);
        if (!inTitel && !inSamen && !inTekst) return null;
        score += (inTitel ? 5 : 0) + (inSamen ? 2 : 0) + (inTekst ? 1 : 0);
      }
      return { e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.e.t.localeCompare(b.e.t))
    .slice(0, 25);
}

async function toon(vraag) {
  if (!vraag.trim()) {
    leeg(uitvoer);
    return;
  }
  try {
    await indexKlaar;
  } catch {
    leeg(uitvoer);
    uitvoer.append(h('p', null, 'Het zoekbestand kon niet worden geladen. Ververs de pagina en probeer het opnieuw.'));
    return;
  }
  // A newer query may have been typed while the file loaded.
  if (vraag !== veld.value && veld.value.trim()) return;
  leeg(uitvoer);
  const treffers = zoek(vraag);
  if (treffers.length === 0) {
    uitvoer.append(h('p', null, 'Niets gevonden. Probeer een ander woord, bijvoorbeeld "bedenktijd", "notaris" of "huurcontract".'));
    return;
  }
  uitvoer.append(
    h('p', { class: 'kleiner' }, `${treffers.length} resultaten`),
    h('ul', { class: 'kaartlijst' }, treffers.map(({ e }) => h('li', null,
      h('a', { href: siteUrl(e.u) }, h('strong', null, e.t)),
      ' ',
      h('span', { class: 'badge' }, e.soort),
      h('br'),
      h('span', { class: 'kleiner' }, e.s.length > 180 ? `${e.s.slice(0, 177)}...` : e.s)))));
}

/** Keep the query in the fragment: a fragment is never sent to the host, a query string is. */
function zetAdres(vraag) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = vraag ? `q=${encodeURIComponent(vraag)}` : '';
  window.history.replaceState(null, '', url);
}

formulier.addEventListener('submit', (ev) => {
  ev.preventDefault();
  toon(veld.value);
  zetAdres(veld.value);
});
let wacht;
veld.addEventListener('input', () => {
  clearTimeout(wacht);
  wacht = setTimeout(() => toon(veld.value), 200);
});

const beginUrl = new URL(window.location.href);
const start = new URLSearchParams(beginUrl.hash.replace(/^#/, '')).get('q') ?? beginUrl.searchParams.get('q');
if (start) {
  veld.value = start;
  toon(start);
  zetAdres(start);
}
