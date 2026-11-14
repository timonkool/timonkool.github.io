// The copy button of the example prompts (AI-03). The prompt is plain text in the page, so the page works without this
// script. With the script, every prompt gets a button that puts its text on the clipboard of the device.
// Nothing is sent anywhere, nothing is stored and nothing is measured: the button only copies.

import { h } from './dom.js';

const MELDING_KLAAR = 'De prompt staat op je klembord. Plak hem in je AI-assistent.';
const MELDING_MISLUKT = 'Kopiëren lukte niet. Selecteer de tekst zelf en kopieer hem.';

/** Fallback for a page without the clipboard interface: select the text in a temporary field and copy it. */
function kopieerViaVeld(tekst) {
  const vorige = document.activeElement;
  // Fixed at the top, so selecting the field does not scroll the page. The style goes through the CSSOM (see dom.js).
  const veld = h('textarea', { readonly: true, tabindex: '-1', 'aria-hidden': 'true', style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px' }, tekst);
  document.body.append(veld);
  veld.focus({ preventScroll: true });
  veld.select();
  veld.setSelectionRange(0, tekst.length);
  let gelukt;
  try {
    gelukt = document.execCommand('copy');
  } catch {
    gelukt = false;
  }
  veld.remove();
  if (vorige instanceof HTMLElement) vorige.focus();
  return gelukt;
}

/**
 * Put a text on the clipboard. Uses the clipboard interface and falls back to a temporary field.
 * @returns {Promise<boolean>} whether the text was copied
 */
export async function kopieer(tekst) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(tekst);
      return true;
    } catch {
      // No permission or no user gesture: try the fallback.
    }
  }
  return kopieerViaVeld(tekst);
}

function voegKnopToe(blok) {
  const tekstEl = blok.querySelector('pre.prompttekst');
  if (!tekstEl) return;
  const titel = blok.querySelector('h3')?.textContent ?? '';
  const melding = h('span', { class: 'promptmelding', role: 'status', 'aria-live': 'polite' });
  let timer;
  // Empty the area first, so a second copy of the same prompt is announced again.
  const meld = (tekst) => {
    clearTimeout(timer);
    melding.textContent = '';
    timer = setTimeout(() => {
      melding.textContent = tekst;
      timer = setTimeout(() => { melding.textContent = ''; }, 6000);
    }, 50);
  };
  const knop = h('button', {
    type: 'button',
    class: 'knop knop-klein',
    'aria-label': `Kopieer de prompt: ${titel}`,
    onclick: async () => {
      const gelukt = await kopieer(tekstEl.textContent);
      meld(gelukt ? MELDING_KLAAR : MELDING_MISLUKT);
    },
  }, 'Kopieer de prompt');
  tekstEl.after(h('p', { class: 'promptacties' }, knop, ' ', melding));
}

for (const blok of document.querySelectorAll('.promptblok')) voegKnopToe(blok);
