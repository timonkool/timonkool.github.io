// The start page. Without this script the page shows one link to the questions.
// With it, a new visitor chooses right here what they are going to do and continues with the next question,
// and a visitor who already has a plan on this device gets one button back to it (D-037).
// Nothing is fetched and nothing is saved here except the choice, which the questions page reads once.

import { SLEUTEL } from '../lib/opslag.js';
import { formatLang, isDatum, vandaag, verschilDagen } from '../lib/datum.js';

const starter = document.getElementById('starter');
const zonder = document.getElementById('start-zonder');
const terug = document.getElementById('start-terug');

/** The saved state, only to see whether there is a plan and when the move is. The dashboard reads and checks it fully. */
function bewaard() {
  try {
    const s = JSON.parse(localStorage.getItem(SLEUTEL) ?? 'null');
    return s && typeof s === 'object' && s.intake && typeof s.intake === 'object' ? s : null;
  } catch {
    return null;
  }
}

function toonTerug(staat) {
  const datum = staat.datums?.verhuisdatum;
  const dagen = isDatum(datum) ? verschilDagen(vandaag(), datum) : null;
  const tekst = document.getElementById('start-terug-tekst');
  if (tekst && dagen !== null && dagen >= 0) {
    tekst.textContent = dagen === 0
      ? 'Welkom terug. Vandaag is je verhuisdag.'
      : `Welkom terug. Nog ${dagen} ${dagen === 1 ? 'dag' : 'dagen'} tot je verhuisdag, ${formatLang(datum)}.`;
  }
  // The invitation to start is for a new visitor.
  for (const el of document.querySelectorAll('.held-intro, .held-uitleg')) el.hidden = true;
  terug.hidden = false;
  zonder.hidden = true;
}

function toonStarter() {
  const fout = document.getElementById('starter-fout');
  starter.addEventListener('change', () => { fout.hidden = true; });
  starter.addEventListener('submit', (e) => {
    e.preventDefault();
    const gekozen = [...starter.querySelectorAll('input[name="doen"]:checked')].map((x) => x.value);
    if (gekozen.length === 0) {
      fout.hidden = false;
      return;
    }
    // Without session storage the questions page simply starts at its first screen.
    try { sessionStorage.setItem('vb:begin', JSON.stringify(gekozen)); } catch { /* start at the first question */ }
    window.location.href = starter.dataset.naar;
  });
  starter.hidden = false;
  zonder.hidden = true;
}

if (starter && zonder && terug) {
  const staat = bewaard();
  if (staat) toonTerug(staat);
  else toonStarter();
}
