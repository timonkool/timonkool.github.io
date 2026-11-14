// The work area of the furniture planner: the floor plan with the furniture as an SVG, in centimeters.
// Dragging, rotating, panning and pinching all go through pointer events, so mouse, touch and pen use the same code.

import { h, leeg, s } from '../dom.js';
import { bbox, klem, overlapMap, r1 } from '../../lib/planner/meetkunde.js';
import { snapDraai, snapPositie } from '../../lib/planner/snap.js';
import { afmetingenCm } from '../../lib/planner/schaal.js';
import { KLEUR_HEX } from '../../lib/planner/model.js';
import { voorbeeldUri } from '../../lib/planner/voorbeeld.js';
import { bewaarVoorOngedaan, momentopname, naBewerking, plattegrond, S, teken, versie } from './staat.js';

const fmt = (v) => String(r1(v)).replace('.', ',');

export function afbeeldingUri(f) {
  return f.uri.startsWith('voorbeeld:') ? voorbeeldUri(f.uri) : f.uri;
}

/** The pieces of the active version that stand on the current floor plan, rugs first so they are drawn underneath. */
export function items() {
  const v = versie();
  if (!v || !S.project) return [];
  return S.project.meubels
    .filter((m) => v.plaatsing[m.id]?.p === S.plattegrondId)
    .map((m) => ({ id: m.id, m, p: v.plaatsing[m.id] }))
    .sort((a, b) => Number(b.m.vloerkleed) - Number(a.m.vloerkleed));
}

function maakItem(it, geselecteerd, overlapt) {
  const { m, p } = it;
  const kleur = KLEUR_HEX[m.kleur] ?? KLEUR_HEX.blauw;
  const hb = m.b / 2;
  const hd = m.d / 2;
  const bb = bbox(m, p.r);
  const kleinste = Math.min(m.b, m.d);
  const staand = bb.h > bb.w * 1.2;
  const ruimte = (staand ? bb.h : bb.w) - 6;
  const fs = Math.max(5.5, Math.min(klem(kleinste * 0.34, 6, 15), ruimte / (Math.max(1, m.naam.length) * 0.52)));
  const maxTekens = Math.max(2, Math.floor(ruimte / (fs * 0.52)));
  const naam = m.naam.length > maxTekens ? `${m.naam.slice(0, Math.max(1, maxTekens - 1))}…` : m.naam;
  const toonMaat = !m.vloerkleed && kleinste >= 45 && ruimte >= fs * 5;
  const maat = `${fmt(m.b)}×${fmt(m.d)}`;
  const rand = Math.max(0.5, fs * 0.14);
  const voor = Math.min(m.b * 0.2, 25);
  const klasse = `it${geselecteerd ? ' sel' : ''}${overlapt ? ' ovl' : ''}${m.vloerkleed ? ' vl' : ''}`;
  return s('g', { class: klasse, 'data-id': it.id },
    s('title', null, `${m.naam}, ${maat} cm`),
    s('g', { transform: `translate(${p.x} ${p.y}) rotate(${p.r})` },
      geselecteerd ? s('rect', { class: 'halo', x: -hb, y: -hd, width: m.b, height: m.d, rx: 2 }) : null,
      s('rect', { class: 'body', x: -hb, y: -hd, width: m.b, height: m.d, rx: 2, fill: kleur }),
      !m.vloerkleed && kleinste >= 30 ? s('line', { class: 'front', x1: -voor, y1: hd - 3.5, x2: voor, y2: hd - 3.5 }) : null),
    s('g', { class: `tx${m.vloerkleed ? ' vl' : ''}`, 'pointer-events': 'none', transform: `translate(${p.x} ${p.y}) rotate(${staand ? -90 : 0})` },
      s('text', { y: toonMaat ? -fs * 0.5 : 0, 'font-size': fs, style: `stroke-width:${rand}px` }, naam),
      toonMaat ? s('text', { class: 'dm', y: fs * 0.75, 'font-size': fs * 0.78, style: `stroke-width:${rand}px` }, maat) : null));
}

function maakGreep(it) {
  const v = huidigeView();
  const si = 1 / v.s;
  const steel = 26 * si;
  const straal = 11 * si;
  const top = -it.m.d / 2 - steel;
  return s('g', { transform: `translate(${it.p.x} ${it.p.y}) rotate(${it.p.r})` },
    s('line', { class: 'steel', x1: 0, y1: -it.m.d / 2, x2: 0, y2: top }),
    s('circle', { class: 'greepknop', cx: 0, cy: top, r: straal }),
    s('g', { transform: `translate(0 ${top}) scale(${si})` },
      s('path', { class: 'knopteken', d: 'M-4.6 1.2A4.8 4.8 0 1 1 0 4.8' }),
      s('path', { d: 'M-7.6 -0.4 -4.4 -3.6 -2.2 0.4z', fill: '#fff' })),
    s('circle', { cx: 0, cy: top, r: straal * 1.9, fill: 'transparent', 'data-handle': 'rot', style: 'cursor:grab' }));
}

// View: the middle (cx, cy) in cm and the scale s in screen pixels per cm.

let svg;
let elPapier;
let elPlan;
let elRasterGroep;
let elRasterA;
let elRasterB;
let elItems;
let elGrepen;
let elSchaalBalk;
let elSchaalTekst;
let elLabel;
let elHint;

function passend(f) {
  const { W, H } = afmetingenCm(f);
  return Math.max(0.05, Math.min(S.cw / W, S.ch / H) * 0.94);
}

export function huidigeView() {
  const f = plattegrond();
  let v = S.views[S.plattegrondId];
  if (!v && f) {
    const { W, H } = afmetingenCm(f);
    v = { cx: W / 2, cy: H / 2, s: passend(f) };
    S.views[S.plattegrondId] = v;
  }
  return v ?? { cx: 0, cy: 0, s: 1 };
}

function beperkSchaal(f, schaal) {
  const fit = passend(f);
  return klem(schaal, fit * 0.6, fit * 12);
}

export function pasBeeldAan() {
  const f = plattegrond();
  if (!f || !S.cw || !S.ch) return;
  const v = huidigeView();
  const w = S.cw / v.s;
  const hh = S.ch / v.s;
  svg.setAttribute('viewBox', `${v.cx - w / 2} ${v.cy - hh / 2} ${w} ${hh}`);
  const netjes = [25, 50, 100, 200, 500, 1000];
  let lengte = 100;
  for (const n of netjes) {
    lengte = n;
    if (n * v.s >= 60) break;
  }
  elSchaalBalk.style.width = `${lengte * v.s}px`;
  elSchaalTekst.textContent = lengte >= 100 ? `${lengte / 100} m` : `${lengte} cm`;
}

export function passendMaken() {
  const f = plattegrond();
  if (!f) return;
  const { W, H } = afmetingenCm(f);
  S.views[S.plattegrondId] = { cx: W / 2, cy: H / 2, s: passend(f) };
  pasBeeldAan();
  tekenItems();
}

export function zoomMet(factor) {
  const f = plattegrond();
  if (!f) return;
  const v = huidigeView();
  v.s = beperkSchaal(f, v.s * factor);
  pasBeeldAan();
  tekenItems();
}

function naarWereld(e) {
  const rect = svg.getBoundingClientRect();
  const v = huidigeView();
  return { x: v.cx + (e.clientX - rect.left - rect.width / 2) / v.s, y: v.cy + (e.clientY - rect.top - rect.height / 2) / v.s };
}

/** Show the active floor plan: the picture, the grid of 50 cm and the view. */
export function laadPlattegrond() {
  const f = plattegrond();
  elLabel.replaceChildren();
  if (!f) {
    for (const el of [elPapier, elPlan]) el.setAttribute('width', 0);
    leeg(elItems);
    leeg(elGrepen);
    tekenHint();
    return;
  }
  const { W, H } = afmetingenCm(f);
  for (const el of [elPapier, elPlan]) {
    el.setAttribute('x', 0);
    el.setAttribute('y', 0);
    el.setAttribute('width', W);
    el.setAttribute('height', H);
  }
  elPlan.setAttribute('href', afbeeldingUri(f));
  let a = '';
  let b = '';
  for (let x = 0; x <= W; x += 50) {
    if (Math.round(x) % 100 === 0) b += `M${x} 0V${H}`;
    else a += `M${x} 0V${H}`;
  }
  for (let y = 0; y <= H; y += 50) {
    if (Math.round(y) % 100 === 0) b += `M0 ${y}H${W}`;
    else a += `M0 ${y}H${W}`;
  }
  elRasterA.setAttribute('d', a);
  elRasterB.setAttribute('d', b);
  elRasterGroep.toggleAttribute('hidden', !S.raster);
  tekenLabel();
  pasBeeldAan();
}

export function tekenLabel() {
  const v = versie();
  const f = plattegrond();
  elLabel.replaceChildren(h('b', null, v ? v.naam : 'Geen versie'), f ? ` · ${f.naam}` : '');
}

export function zetRaster() {
  elRasterGroep.toggleAttribute('hidden', !S.raster);
}

export function tekenHint() {
  let tekst = '';
  if (!S.project?.plattegronden.length) tekst = 'Voeg eerst een plattegrond toe.';
  else if (!S.project.meubels.length) tekst = 'Nog geen meubels. Voeg er een toe in het paneel.';
  else {
    const v = versie();
    const geplaatst = v ? S.project.meubels.filter((m) => v.plaatsing[m.id]).length : 0;
    if (!geplaatst) tekst = 'Tik op een meubel in de lijst om het te plaatsen.';
  }
  elHint.hidden = !tekst;
  elHint.replaceChildren(h('span', null, tekst));
}

let rafItems = 0;

function plan() {
  if (rafItems) return;
  rafItems = requestAnimationFrame(() => {
    rafItems = 0;
    tekenItems();
  });
}

export function overlappen() {
  return S.overlap ? overlapMap(items()) : new Map();
}

export function tekenItems() {
  const lijst = items();
  const kaart = S.overlap ? overlapMap(lijst) : new Map();
  leeg(elItems);
  leeg(elGrepen);
  let gekozen = null;
  for (const it of lijst) {
    if (it.id === S.sel) {
      gekozen = it;
      continue;
    }
    elItems.append(maakItem(it, false, kaart.has(it.id)));
  }
  if (gekozen) {
    elItems.append(maakItem(gekozen, true, kaart.has(gekozen.id)));
    elGrepen.append(maakGreep(gekozen));
  }
}

/** Make a piece visible: switch to its floor plan, select it and move the view when it is out of sight. */
export function toonMeubel(id) {
  const v = versie();
  const p = v?.plaatsing[id];
  if (!p) return;
  if (S.plattegrondId !== p.p) kiesPlattegrond(p.p);
  S.sel = id;
  const view = huidigeView();
  const hw = S.cw / view.s / 2;
  const hh = S.ch / view.s / 2;
  if (Math.abs(p.x - view.cx) > hw * 0.85 || Math.abs(p.y - view.cy) > hh * 0.85) {
    view.cx = p.x;
    view.cy = p.y;
    pasBeeldAan();
  }
  tekenItems();
  teken.selectie();
  teken.paneel();
}

export function kiesPlattegrond(id) {
  if (!S.project?.plattegronden.some((f) => f.id === id)) return;
  S.plattegrondId = id;
  const v = versie();
  if (S.sel && v?.plaatsing[S.sel]?.p !== id) S.sel = null;
  laadPlattegrond();
  tekenItems();
  teken.kop();
  teken.selectie();
  teken.paneel();
}

/** The middle of what the visitor sees, in cm. New pieces are placed there. */
export function middenVanBeeld() {
  const v = huidigeView();
  return { x: v.cx, y: v.cy };
}

// Pointers: one finger or the mouse drags a piece or the plan, two fingers pinch.

const aanwijzers = new Map();
let gebaar = null;
let knijp = null;

function afstandEnMidden() {
  const [p, q] = [...aanwijzers.values()];
  return { d: Math.hypot(p.x - q.x, p.y - q.y) || 1, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

function breekGebaarAf() {
  if (gebaar && gebaar.soort !== 'pan' && gebaar.bewogen) {
    const v = versie();
    if (v) v.plaatsing = JSON.parse(gebaar.voor);
    plan();
  }
  gebaar = null;
  svg.classList.remove('panning');
}

function start(e) {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  try {
    svg.setPointerCapture(e.pointerId);
  } catch {
    // no capture: moves outside the work area are then not followed
  }
  aanwijzers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (aanwijzers.size >= 2) {
    breekGebaarAf();
    const m = afstandEnMidden();
    const v = huidigeView();
    const rect = svg.getBoundingClientRect();
    knijp = { d0: m.d, s0: v.s, wx: v.cx + (m.x - rect.left - rect.width / 2) / v.s, wy: v.cy + (m.y - rect.top - rect.height / 2) / v.s };
    e.preventDefault();
    return;
  }
  const v = versie();
  const greep = e.target.closest('[data-handle]');
  const el = e.target.closest('[data-id]');
  const w = naarWereld(e);
  const view = huidigeView();
  if (greep && S.sel && v?.plaatsing[S.sel]) {
    gebaar = { soort: 'draai', id: S.sel, voor: momentopname(), bewogen: false };
  } else if (el && v) {
    const id = el.getAttribute('data-id');
    const pl = v.plaatsing[id];
    if (pl) {
      if (S.sel !== id) {
        S.sel = id;
        teken.selectie();
        teken.paneel();
        tekenItems();
      }
      gebaar = { soort: 'verplaats', id, dx: w.x - pl.x, dy: w.y - pl.y, voor: momentopname(), bewogen: false, sx: e.clientX, sy: e.clientY };
    }
  }
  if (!gebaar) {
    gebaar = { soort: 'pan', sx: e.clientX, sy: e.clientY, cx: view.cx, cy: view.cy, bewogen: false };
    svg.classList.add('panning');
  }
  e.preventDefault();
}

function beweeg(e) {
  const pt = aanwijzers.get(e.pointerId);
  if (pt) {
    pt.x = e.clientX;
    pt.y = e.clientY;
  }
  const f = plattegrond();
  if (!f) return;
  if (knijp && aanwijzers.size >= 2) {
    const m = afstandEnMidden();
    const v = huidigeView();
    const rect = svg.getBoundingClientRect();
    v.s = beperkSchaal(f, (knijp.s0 * m.d) / knijp.d0);
    v.cx = knijp.wx - (m.x - rect.left - rect.width / 2) / v.s;
    v.cy = knijp.wy - (m.y - rect.top - rect.height / 2) / v.s;
    pasBeeldAan();
    plan();
    return;
  }
  if (!gebaar) return;
  const cv = huidigeView();
  if (gebaar.soort === 'pan') {
    if (Math.hypot(e.clientX - gebaar.sx, e.clientY - gebaar.sy) > 3) gebaar.bewogen = true;
    cv.cx = gebaar.cx - (e.clientX - gebaar.sx) / cv.s;
    cv.cy = gebaar.cy - (e.clientY - gebaar.sy) / cv.s;
    pasBeeldAan();
    return;
  }
  const v = versie();
  const pl = v?.plaatsing[gebaar.id];
  const m = S.project.meubels.find((x) => x.id === gebaar.id);
  if (!pl || !m) return;
  const w = naarWereld(e);
  if (gebaar.soort === 'verplaats') {
    if (!gebaar.bewogen && Math.hypot(e.clientX - gebaar.sx, e.clientY - gebaar.sy) <= 3) return;
    gebaar.bewogen = true;
    const anderen = items().filter((o) => o.id !== gebaar.id && !o.m.vloerkleed);
    const sp = snapPositie({ m, p: pl, x: w.x - gebaar.dx, y: w.y - gebaar.dy, anderen, drempel: 7 / cv.s, magneet: S.magneet });
    const { W, H } = afmetingenCm(f);
    pl.x = r1(klem(sp.x, 0, W));
    pl.y = r1(klem(sp.y, 0, H));
    plan();
  } else if (gebaar.soort === 'draai') {
    const hoek = (Math.atan2(w.y - pl.y, w.x - pl.x) * 180) / Math.PI + 90;
    pl.r = snapDraai(hoek, S.magneet);
    gebaar.bewogen = true;
    plan();
  }
}

function einde(e) {
  aanwijzers.delete(e.pointerId);
  if (knijp) {
    if (aanwijzers.size < 2) knijp = null;
    return;
  }
  if (!gebaar) return;
  const klaar = gebaar;
  gebaar = null;
  svg.classList.remove('panning');
  if (klaar.soort === 'pan') {
    if (!klaar.bewogen && S.sel) {
      S.sel = null;
      teken.selectie();
      teken.paneel();
      tekenItems();
    }
  } else if (klaar.bewogen) {
    bewaarVoorOngedaan(klaar.voor);
    naBewerking();
  }
}

function wiel(e) {
  e.preventDefault();
  const f = plattegrond();
  if (!f) return;
  const v = huidigeView();
  const rect = svg.getBoundingClientRect();
  const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
  const ox = e.clientX - rect.left - rect.width / 2;
  const oy = e.clientY - rect.top - rect.height / 2;
  const wx = v.cx + ox / v.s;
  const wy = v.cy + oy / v.s;
  v.s = beperkSchaal(f, v.s * k);
  v.cx = wx - ox / v.s;
  v.cy = wy - oy / v.s;
  pasBeeldAan();
  plan();
}

/** Build the work area. Returns the element to put in the page. */
export function maakWerkblad() {
  elPapier = s('rect', { class: 'papier' });
  elPlan = s('image', { preserveAspectRatio: 'none' });
  elRasterA = s('path', { class: 'raster-a' });
  elRasterB = s('path', { class: 'raster-b' });
  elRasterGroep = s('g', { hidden: true }, elRasterA, elRasterB);
  elItems = s('g');
  elGrepen = s('g');
  svg = s('svg', { id: 'svg', role: 'img', 'aria-label': 'Plattegrond met meubels', 'aria-describedby': 'plan-samenvatting', preserveAspectRatio: 'xMidYMid meet' }, elPapier, elPlan, elRasterGroep, elItems, elGrepen);
  elLabel = h('div', { class: 'ov ov-tl' });
  elSchaalBalk = h('i');
  elSchaalTekst = h('span');
  elHint = h('div', { class: 'hint', hidden: true });
  const wrapper = h('div', { class: 'canvas', id: 'canvas' }, svg, elLabel, h('div', { class: 'ov ov-bl' }, elSchaalBalk, elSchaalTekst), elHint);
  svg.addEventListener('pointerdown', start);
  svg.addEventListener('pointermove', beweeg);
  svg.addEventListener('pointerup', einde);
  svg.addEventListener('pointercancel', einde);
  svg.addEventListener('wheel', wiel, { passive: false });
  if (window.ResizeObserver) {
    new ResizeObserver(() => {
      const r = wrapper.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const eerste = !S.cw;
      S.cw = r.width;
      S.ch = r.height;
      if (eerste) {
        delete S.views[S.plattegrondId];
        laadPlattegrond();
      } else {
        pasBeeldAan();
      }
      tekenItems();
    }).observe(wrapper);
  }
  return wrapper;
}
