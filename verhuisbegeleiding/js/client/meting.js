// Measurement (BC-06). By default this does nothing: no request leaves the device and nothing is stored that identifies
// a visitor. Events have fixed names. A receiver can be connected with zetOntvanger() once the site owner has chosen a tool and the
// privacy review is done (OPEN-VRAGEN, METING.md). Without a receiver, track() is a no-op, also when "meting" is on.

import { maakSessieMeter } from '../lib/sessie.js';
import { opties } from './opties.js';

export const GEBEURTENISSEN = ['intake_voltooid', 'taak_afgevinkt', 'datum_ingevuld', 'agenda_geexporteerd', 'meubel_geplaatst', 'sessie_5_minuten'];

let ontvanger = null;

export function zetOntvanger(fn) {
  ontvanger = typeof fn === 'function' ? fn : null;
}

/** Report an event. Unknown names and errors in the receiver are ignored: measuring never breaks the page. */
export function track(gebeurtenis) {
  if (!opties.meting || !GEBEURTENISSEN.includes(gebeurtenis)) return;
  try {
    ontvanger?.(gebeurtenis);
  } catch {
    // ignore
  }
}

const SESSIE_SLEUTEL = 'vb:sessie';

function leesStand() {
  try {
    const x = JSON.parse(sessionStorage.getItem(SESSIE_SLEUTEL) ?? 'null');
    return x && typeof x === 'object' ? x : null;
  } catch {
    return null;
  }
}

function bewaarStand(stand) {
  try {
    if (stand) sessionStorage.setItem(SESSIE_SLEUTEL, JSON.stringify(stand));
  } catch {
    // no storage: the stretch then runs per page only
  }
}

/**
 * Start counting the active session of five minutes on this page. The stretch is kept in sessionStorage (times only, gone when
 * the tab closes), so reading on from one page to the next in the same tab counts as one session.
 */
export function startSessiemeting(doc = document, nu = () => Date.now()) {
  if (!opties.meting) return null;
  const meter = maakSessieMeter({ begin: leesStand(), bijVijfMinuten: () => track('sessie_5_minuten') });
  let laatsteBewaard = 0;
  const bijInteractie = () => {
    const t = nu();
    meter.interactie(t);
    if (t - laatsteBewaard > 5000) {
      laatsteBewaard = t;
      bewaarStand(meter.stand);
    }
  };
  for (const naam of ['pointerdown', 'keydown', 'scroll', 'input', 'touchstart']) doc.addEventListener(naam, bijInteractie, { passive: true, capture: true });
  doc.addEventListener('visibilitychange', () => bewaarStand(meter.stand));
  return meter;
}
