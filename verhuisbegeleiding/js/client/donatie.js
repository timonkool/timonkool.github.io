// The donation block (TL-12). It shows only when a donation url is set in site.config.json and only after the visitor has
// finished something: a checklist, or a layout in the furniture planner. The visitor leaves the site for the payment page.

import { h } from './dom.js';
import { opties } from './opties.js';

/** @param {{id?: string, tekst: string}} p  the text says what was finished, for example "Je hebt alle taken van deze lijst gedaan." */
export function donatieBlok({ id = 'donatie', tekst }) {
  if (!opties.donatieUrl) return null;
  return h('aside', { class: 'uitnodiging donatie', 'aria-labelledby': `${id}-kop` },
    h('h2', { id: `${id}-kop` }, 'Heeft dit je geholpen?'),
    h('p', null, tekst),
    h('p', null, h('a', { class: 'knop knop-rustig', href: opties.donatieUrl, rel: 'noopener noreferrer' }, 'Steun deze site met een gift')),
    h('p', { class: 'kleiner' }, 'De site is gratis en blijft dat. Een gift is een bedankje, geen voorwaarde. Je gaat naar de pagina van de betaaldienst. Daar gelden hun eigen voorwaarden.'));
}
