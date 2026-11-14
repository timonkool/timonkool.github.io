// The state of the visitor in the browser: loaded once, changed through app.wijzig(), saved after every change.

import { maakOpslag } from '../lib/opslag.js';

const DATA_URL = new URL('../../data/inhoud.json', import.meta.url);

/** Absolute url of a path relative to the site root (no leading slash). */
export function siteUrl(pad) {
  return new URL(`../../${pad}`, import.meta.url).href;
}

let gedeeld = null;

export async function laadApp() {
  if (gedeeld) return gedeeld;
  const antwoord = await fetch(DATA_URL);
  if (!antwoord.ok) throw new Error(`Gegevens niet geladen (${antwoord.status})`);
  const data = await antwoord.json();
  const opslag = maakOpslag();
  const geladen = opslag.laad(data.model);
  const app = { data, opslag, state: geladen.state, melding: geladen.melding, status: geladen.status, luisteraars: new Set() };

  const bewaar = (nieuw) => {
    app.state = nieuw;
    const b = opslag.bewaar(nieuw);
    app.melding = b.ok ? null : b.melding;
    if (b.ok) app.state = { ...app.state, laatstBewaard: b.laatstBewaard };
    for (const f of app.luisteraars) f();
  };
  /** Change a copy of the state and save it. */
  app.wijzig = (fn) => {
    const kopie = structuredClone(app.state);
    fn(kopie);
    bewaar(kopie);
  };
  /** Add an id to a list of the state (afgevinkt, nietVanToepassing) or remove it when it is already there. */
  app.wissel = (lijst, id) =>
    app.wijzig((s) => {
      const i = s[lijst].indexOf(id);
      if (i >= 0) s[lijst].splice(i, 1);
      else s[lijst].push(id);
    });
  /** Replace the whole state, for example after an import. */
  app.vervang = (nieuw) => bewaar(nieuw);
  gedeeld = app;
  return app;
}
