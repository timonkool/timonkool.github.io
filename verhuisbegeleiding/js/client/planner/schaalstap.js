// Adding a floor plan: choose a picture, then set the scale by clicking two points and saying how far apart they are.
// The picture is made smaller in the browser (at most 1600 pixels) and stored as JPEG, so the storage does not fill up.
// Everything happens on this device: the picture is not uploaded anywhere.

import { h, s } from '../dom.js';
import { afmetingenCm, afstandInCm, schaalUitPunten } from '../../lib/planner/schaal.js';
import { LIMIETEN } from '../../lib/planner/model.js';
import { afbeeldingUri } from './werkblad.js';

const MAX_BRON_BYTES = 25_000_000;
const MAX_ZIJDE = 1600;

async function laadBitmap(bestand) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(bestand);
    } catch {
      // fall back to an image element
    }
  }
  const url = URL.createObjectURL(bestand);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

/** Read a picture file, make it smaller and turn it into a JPEG data url. Throws an Error with a message in Dutch. */
export async function leesAfbeelding(bestand) {
  if (bestand.type === 'application/pdf') throw new Error('Een pdf kan hier niet worden gebruikt. Maak er een schermafbeelding of foto van en kies die.');
  if (!bestand.type.startsWith('image/')) throw new Error('Kies een afbeelding, bijvoorbeeld een jpg, png of webp.');
  if (bestand.size > MAX_BRON_BYTES) throw new Error('Deze afbeelding is te groot. Kies een kleinere afbeelding of maak een schermafbeelding.');
  let bron;
  try {
    bron = await laadBitmap(bestand);
  } catch {
    throw new Error('Deze afbeelding kon niet worden gelezen. Probeer een jpg of png.');
  }
  const breed = bron.width || bron.naturalWidth;
  const hoog = bron.height || bron.naturalHeight;
  const f = Math.min(1, MAX_ZIJDE / Math.max(breed, hoog));
  const pw = Math.max(LIMIETEN.plattegrondMinPx, Math.round(breed * f));
  const ph = Math.max(LIMIETEN.plattegrondMinPx, Math.round(hoog * f));
  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pw, ph);
  ctx.drawImage(bron, 0, 0, pw, ph);
  let kwaliteit = 0.85;
  let uri = canvas.toDataURL('image/jpeg', kwaliteit);
  while (uri.length > 1_500_000 && kwaliteit > 0.4) {
    kwaliteit -= 0.15;
    uri = canvas.toDataURL('image/jpeg', kwaliteit);
  }
  if (uri.length >= LIMIETEN.uriTekens) throw new Error('Deze afbeelding wordt te groot om te bewaren. Kies een eenvoudiger afbeelding.');
  return { uri, pw, ph };
}

const meter = (cm) => `${(cm / 100).toFixed(1).replace('.', ',')} m`;

/**
 * Show the scale step in the given element.
 * @param {HTMLElement} doel
 * @param {{uri: string, pw: number, ph: number, k?: number, naam?: string}} plan  the picture; k and naam when the plan already exists
 * @param {{nieuw: boolean, bijKlaar: (r: {naam: string, k: number}) => void, bijAnnuleren: () => void}} opties
 */
export function toonSchaalstap(doel, plan, { nieuw, bijKlaar, bijAnnuleren }) {
  const { pw, ph } = plan;
  let punten = [];
  let actief = null;
  const klein = { r: 10 };

  const lijn = s('line', { class: 'meetlijn', x1: 0, y1: 0, x2: 0, y2: 0, hidden: true });
  const markers = ['A', 'B'].map((naam, i) => s('g', { class: 'meetpunt', tabindex: 0, role: 'img', 'aria-label': `Punt ${naam}`, hidden: true, 'data-punt': i },
    s('circle', { r: klein.r }), s('text', { y: 4, 'text-anchor': 'middle' }, naam)));
  const svg = s('svg', { class: 'schaalbeeld', viewBox: `0 0 ${pw} ${ph}`, preserveAspectRatio: 'xMidYMid meet', role: 'group', 'aria-label': 'Plattegrond om de schaal op in te stellen' },
    s('rect', { width: pw, height: ph, fill: '#fff' }),
    s('image', { href: plan.uri.startsWith('voorbeeld:') ? afbeeldingUri(plan) : plan.uri, width: pw, height: ph, preserveAspectRatio: 'none' }),
    lijn, ...markers);

  const naamVeld = h('input', { type: 'text', id: 'sc-naam', maxlength: '60', autocomplete: 'off', value: plan.naam ?? '' });
  const afstandVeld = h('input', { type: 'text', id: 'sc-afstand', inputmode: 'decimal', autocomplete: 'off', 'aria-describedby': 'sc-uitslag' });
  const eenheidVeld = h('select', { id: 'sc-eenheid' }, h('option', { value: 'm' }, 'meter'), h('option', { value: 'cm' }, 'centimeter'));
  const uitslag = h('p', { id: 'sc-uitslag', class: 'kleiner', role: 'status' });
  const bewaarKnop = h('button', { type: 'button', class: 'knop', id: 'sc-bewaar', disabled: true }, nieuw ? 'Plattegrond toevoegen' : 'Schaal bewaren');

  const pasRadiusAan = () => {
    const breedte = svg.getBoundingClientRect().width || pw;
    klein.r = (11 * pw) / breedte;
    for (const m of markers) {
      m.firstChild.setAttribute('r', klein.r);
      m.lastChild.setAttribute('font-size', klein.r * 1.2);
      m.lastChild.setAttribute('y', klein.r * 0.4);
    }
    lijn.setAttribute('stroke-width', klein.r * 0.25);
  };

  const bereken = () => {
    const cm = afstandInCm(afstandVeld.value, eenheidVeld.value);
    const r = punten.length === 2 ? schaalUitPunten(punten[0], punten[1], cm) : null;
    bewaarKnop.disabled = !r?.ok || (nieuw && !naamVeld.value.trim());
    if (punten.length < 2) uitslag.textContent = 'Zet eerst twee punten op de plattegrond.';
    else if (!r?.ok) uitslag.textContent = r?.reden ?? '';
    else {
      const { W, H } = afmetingenCm({ pw, ph, k: r.k });
      uitslag.textContent = `Controle: de plattegrond is dan ongeveer ${meter(W)} breed en ${meter(H)} diep. Klopt dat? Pas anders de punten of de afstand aan.`;
    }
    return r;
  };

  const teken = () => {
    punten.forEach((p, i) => {
      markers[i].removeAttribute('hidden');
      markers[i].setAttribute('transform', `translate(${p.x} ${p.y})`);
    });
    if (punten.length === 2) {
      lijn.removeAttribute('hidden');
      lijn.setAttribute('x1', punten[0].x);
      lijn.setAttribute('y1', punten[0].y);
      lijn.setAttribute('x2', punten[1].x);
      lijn.setAttribute('y2', punten[1].y);
    }
    bereken();
  };

  const naarBeeld = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: Math.min(pw, Math.max(0, p.x)), y: Math.min(ph, Math.max(0, p.y)) };
  };

  svg.addEventListener('pointerdown', (e) => {
    const m = e.target.closest('[data-punt]');
    const p = naarBeeld(e);
    if (m) actief = Number(m.getAttribute('data-punt'));
    else if (punten.length < 2) {
      punten.push(p);
      actief = punten.length - 1;
    } else {
      actief = Math.hypot(p.x - punten[0].x, p.y - punten[0].y) <= Math.hypot(p.x - punten[1].x, p.y - punten[1].y) ? 0 : 1;
      punten[actief] = p;
    }
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    teken();
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (actief === null || !punten[actief]) return;
    punten[actief] = naarBeeld(e);
    teken();
  });
  const los = () => { actief = null; };
  svg.addEventListener('pointerup', los);
  svg.addEventListener('pointercancel', los);
  svg.addEventListener('keydown', (e) => {
    const m = e.target.closest?.('[data-punt]');
    const stap = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-stap, 0], ArrowRight: [stap, 0], ArrowUp: [0, -stap], ArrowDown: [0, stap] }[e.key];
    if (!m || !d) return;
    const i = Number(m.getAttribute('data-punt'));
    punten[i] = { x: Math.min(pw, Math.max(0, punten[i].x + d[0])), y: Math.min(ph, Math.max(0, punten[i].y + d[1])) };
    teken();
    e.preventDefault();
  });

  for (const veld of [afstandVeld, eenheidVeld, naamVeld]) veld.addEventListener('input', bereken);
  bewaarKnop.addEventListener('click', () => {
    const r = bereken();
    if (r?.ok) bijKlaar({ naam: naamVeld.value.trim(), k: r.k });
  });

  doel.replaceChildren(
    h('h2', null, nieuw ? 'Stel de schaal van de plattegrond in' : `Schaal van ${plan.naam}`),
    h('p', null, 'Tik of klik twee punten aan op de plattegrond, bijvoorbeeld de twee uiteinden van een muur waar de lengte bij staat. Je kunt de punten daarna slepen. Vul dan in hoe ver ze in het echt uit elkaar liggen.'),
    nieuw ? h('div', { class: 'fld' }, h('label', { for: 'sc-naam' }, 'Naam van de plattegrond (bijvoorbeeld Begane grond)'), naamVeld) : null,
    svg,
    h('p', { class: 'knoppen' }, h('button', { type: 'button', class: 'knop knop-rustig knop-klein', id: 'sc-midden', onclick: () => {
      punten = [{ x: pw * 0.3, y: ph * 0.5 }, { x: pw * 0.7, y: ph * 0.5 }];
      teken();
      markers[0].focus();
    } }, 'Zet de punten in het midden (met het toetsenbord bij te stellen)')),
    h('div', { class: 'fld' }, h('label', { for: 'sc-afstand' }, 'Afstand tussen de twee punten in het echt'), h('div', { class: 'zoekrij' }, afstandVeld, eenheidVeld)),
    uitslag,
    h('div', { class: 'knoppen' }, bewaarKnop, h('button', { type: 'button', class: 'knop knop-rustig', id: 'sc-annuleer', onclick: bijAnnuleren }, 'Annuleren')));
  pasRadiusAan();
  new ResizeObserver(pasRadiusAan).observe(svg);
  bereken();
}
