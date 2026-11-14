// The bar under the work area with what is selected: name, size, rotation and buttons.
// It is always there and keeps its height, otherwise the work area would jump when a piece is touched.

import { h, s } from '../dom.js';
import { r1 } from '../../lib/planner/meetkunde.js';
import { KLEUR_HEX } from '../../lib/planner/model.js';
import { S, versie } from './staat.js';
import { draaiSelectie, haalMeubelWeg, zetHoekSelectie } from './bewerken.js';
import { items, overlappen } from './werkblad.js';

const fmt = (v) => String(r1(v)).replace('.', ',');

export function ikoon(...paden) {
  return s('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, paden.map((d) => s('path', { d })));
}

export const IKONEN = {
  links: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v5h5'],
  rechts: ['M21 12a9 9 0 1 1-3-6.7', 'M21 4v5h-5'],
  uit: ['M4 12h11M11 7l5 5-5 5', 'M20 5v14'],
  plus: ['M12 5v14M5 12h14'],
  bewerk: ['M4 20h4L19 9l-4-4L4 16z', 'm13.5 6.5 4 4'],
  kopie: ['M9 9h11v11H9z', 'M5 15V6a2 2 0 0 1 2-2h8'],
  export: ['M12 15V4M8 8l4-4 4 4', 'M5 14v5h14v-5'],
};

export function maakSelectiebalk() {
  const bar = h('div', { class: 'selbar idle', id: 'selbar' });
  bar.setAttribute('data-idle', 'Tik op een meubel om het te selecteren. Sleep om te verplaatsen, draai met het bolletje.');
  return bar;
}

export function tekenSelectie() {
  const bar = document.getElementById('selbar');
  if (!bar) return;
  const v = versie();
  const m = S.sel && S.project.meubels.find((x) => x.id === S.sel);
  const p = m && v?.plaatsing[S.sel];
  const stil = !m || !p;
  const behoudFocus = document.activeElement?.id === 'selRot';
  let waarschuwing = ' ';
  if (!stil && S.overlap && !m.vloerkleed) {
    const lijst = overlappen().get(S.sel);
    if (lijst) waarschuwing = `Overlapt met: ${lijst.join(', ')}`;
  }
  bar.className = `selbar${stil ? ' idle' : ''}`;
  if (stil) bar.setAttribute('aria-hidden', 'true');
  else bar.removeAttribute('aria-hidden');
  const uit = stil ? { disabled: true, tabindex: -1 } : {};
  bar.replaceChildren(
    h('div', { class: 'who' },
      h('span', { class: 'sw', style: `background:${stil ? 'transparent' : (KLEUR_HEX[m.kleur] ?? KLEUR_HEX.blauw)}` }),
      h('b', null, stil ? 'Meubel' : m.naam),
      h('span', { class: 'dims' }, stil ? '0 × 0 cm' : `${fmt(m.b)} × ${fmt(m.d)} cm`)),
    h('label', null, 'Draaiing ', h('input', { id: 'selRot', type: 'number', min: 0, max: 359.9, step: 1, inputmode: 'decimal', value: stil ? 0 : r1(p.r), ...uit, onchange: (e) => zetHoekSelectie(Number.parseFloat(e.target.value)) }), ' °'),
    h('div', { class: 'acts' },
      h('button', { type: 'button', class: 'ib', 'aria-label': '90 graden linksom', title: '90° linksom (Shift+R)', ...uit, onclick: () => draaiSelectie(-90) }, ikoon(...IKONEN.links)),
      h('button', { type: 'button', class: 'ib', 'aria-label': '90 graden rechtsom', title: '90° rechtsom (R)', ...uit, onclick: () => draaiSelectie(90) }, ikoon(...IKONEN.rechts)),
      h('button', { type: 'button', class: 'btn', ...uit, onclick: () => haalMeubelWeg(S.sel) }, ikoon(...IKONEN.uit), 'Terug naar lijst')),
    h('p', { class: 'warn', role: 'status' }, waarschuwing));
  if (behoudFocus && !stil) document.getElementById('selRot')?.focus();
}

/** A short text with the state of the plan for people who do not see the drawing. */
export function samenvatting() {
  const lijst = items();
  const kaart = overlappen();
  if (!lijst.length) return 'Er staan geen meubels op deze plattegrond.';
  const namen = lijst.filter((i) => kaart.has(i.id)).map((i) => i.m.naam);
  return `${lijst.length} ${lijst.length === 1 ? 'meubel' : 'meubels'} op deze plattegrond.${namen.length ? ` Overlap bij: ${namen.join(', ')}.` : ''}`;
}
