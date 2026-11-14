// Data model of the furniture planner and the checks on everything that comes from outside (storage, imports).
// Nothing from the outside is copied as it is: every normaliser builds a NEW object from known fields only, so keys like
// "__proto__" and unknown fields never end up in a project. Names lose control characters and angle brackets, the interface
// shows them with textContent only.
//
//   project   { v, id, naam, gemaakt, gewijzigd, voorbeeld, plattegronden[], meubels[], versies[], actief }
//   plattegrond { id, naam, uri, pw, ph, k }   uri: data url of the picture, pw and ph in pixels, k = pixels per cm
//   meubel    { id, naam, b, d, h, kleur, vloerkleed, voorbeeld, volgorde, bron? }   sizes in cm
//   versie    { id, naam, gemaakt, gewijzigd, voorbeeld, plaatsing }
//   plaatsing { [meubelId]: { p: plattegrondId, x, y, r } }   x and y are the middle of the piece in cm, r in degrees

import { schoonLabel } from '../schema.js';
import { hoekNormaal, klem, r1 } from './meetkunde.js';
import { afmetingenCm, MAX_K, MIN_K } from './schaal.js';

export const VERSIE = 1;

export const KLEUREN = [
  { id: 'blauw', hex: '#2c6bdc' },
  { id: 'groen', hex: '#15805a' },
  { id: 'paars', hex: '#7448cc' },
  { id: 'magenta', hex: '#c23a8a' },
  { id: 'teal', hex: '#0c8199' },
  { id: 'indigo', hex: '#3e4fc4' },
  { id: 'grijs', hex: '#566578' },
];
export const KLEUR_HEX = Object.fromEntries(KLEUREN.map((k) => [k.id, k.hex]));

export const LIMIETEN = {
  projecten: 20,
  plattegronden: 8,
  meubels: 500,
  versies: 100,
  naam: 60,
  maatCm: 2000,
  plattegrondPx: 4000,
  plattegrondMinPx: 50,
  uriTekens: 2_000_000,
  importTekens: 25_000_000,
};

const VERBODEN = new Set(['__proto__', 'constructor', 'prototype']);
const URI_AFBEELDING = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const URI_VOORBEELD = /^voorbeeld:[a-z0-9-]{1,40}$/;

let teller = 0;

/** A new id for a project (p), floor plan (f), piece (m) or version (v). */
export function nieuwId(voorvoegsel = 'x', nu = Date.now(), willekeur = Math.random) {
  teller += 1;
  return `${voorvoegsel}${nu.toString(36)}${Math.floor(willekeur() * 36 ** 3).toString(36)}${teller.toString(36)}`;
}

export function schoonId(x) {
  return String(x ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

/** A usable id from outside, or a new one. */
export function veiligeId(x, voorvoegsel) {
  const id = schoonId(x);
  return id && !VERBODEN.has(id) ? id : nieuwId(voorvoegsel);
}

export function schoonNaam(x, terugval = 'Zonder naam') {
  return schoonLabel(x, LIMIETEN.naam) || terugval;
}

export function getal(x) {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number.parseFloat(x) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function tijd(x, terugval) {
  const n = getal(x);
  return n !== null && n >= 0 && n < 8.64e15 ? Math.trunc(n) : terugval;
}

export function geldigeUri(uri) {
  if (typeof uri !== 'string' || uri.length > LIMIETEN.uriTekens) return false;
  return URI_VOORBEELD.test(uri) || URI_AFBEELDING.test(uri);
}

export function normMeubel(x) {
  if (!isObject(x)) return null;
  const b = getal(x.b);
  const d = getal(x.d);
  if (!(b > 0) || !(d > 0) || b > LIMIETEN.maatCm || d > LIMIETEN.maatCm) return null;
  const h = getal(x.h);
  const volgorde = getal(x.volgorde);
  const uit = {
    id: veiligeId(x.id, 'm'),
    naam: schoonNaam(x.naam),
    b: r1(b),
    d: r1(d),
    h: h > 0 && h <= LIMIETEN.maatCm ? r1(h) : 0,
    kleur: typeof x.kleur === 'string' && Object.hasOwn(KLEUR_HEX, x.kleur) ? x.kleur : 'blauw',
    vloerkleed: x.vloerkleed === true,
    voorbeeld: x.voorbeeld === true,
    volgorde: volgorde === null ? 0 : Math.trunc(volgorde),
  };
  const bron = schoonId(x.bron);
  if (bron && !VERBODEN.has(bron)) uit.bron = bron;
  return uit;
}

export function normPlattegrond(x) {
  if (!isObject(x) || !geldigeUri(x.uri)) return null;
  const pw = Math.round(getal(x.pw) ?? 0);
  const ph = Math.round(getal(x.ph) ?? 0);
  const k = getal(x.k);
  const { plattegrondMinPx: min, plattegrondPx: max } = LIMIETEN;
  if (pw < min || pw > max || ph < min || ph > max) return null;
  if (k === null || k < MIN_K || k > MAX_K) return null;
  return { id: veiligeId(x.id, 'f'), naam: schoonNaam(x.naam, 'Plattegrond'), uri: x.uri, pw, ph, k };
}

/**
 * Placements of a version. Pieces that do not exist, floor plans that do not exist and positions outside the floor plan
 * are dropped or pulled inside.
 * @param {Set<string>|null} meubelIds the ids of the pieces that exist, or null to accept any id
 */
export function normPlaatsing(bron, plattegronden, meubelIds = null) {
  const uit = {};
  if (!isObject(bron)) return uit;
  const plan = new Map(plattegronden.map((f) => [f.id, f]));
  let aantal = 0;
  for (const sleutel of Object.keys(bron)) {
    const id = schoonId(sleutel);
    const p = bron[sleutel];
    if (!id || VERBODEN.has(id) || !isObject(p) || (meubelIds && !meubelIds.has(id)) || aantal >= LIMIETEN.meubels) continue;
    const f = plan.get(schoonId(p.p));
    const x = getal(p.x);
    const y = getal(p.y);
    if (!f || x === null || y === null) continue;
    const { W, H } = afmetingenCm(f);
    uit[id] = { p: f.id, x: r1(klem(x, 0, W)), y: r1(klem(y, 0, H)), r: hoekNormaal(getal(p.r) ?? 0) };
    aantal += 1;
  }
  return uit;
}

export function maakVersie(naam, nu = Date.now(), plaatsing = {}) {
  return { id: nieuwId('v', nu), naam: schoonNaam(naam, 'Indeling'), gemaakt: nu, gewijzigd: nu, voorbeeld: false, plaatsing };
}

export function normVersie(x, plattegronden, meubelIds, nu = Date.now()) {
  if (!isObject(x)) return null;
  return {
    id: veiligeId(x.id, 'v'),
    naam: schoonNaam(x.naam),
    gemaakt: tijd(x.gemaakt, nu),
    gewijzigd: tijd(x.gewijzigd, 0),
    voorbeeld: x.voorbeeld === true,
    plaatsing: normPlaatsing(x.plaatsing, plattegronden, meubelIds),
  };
}

/** Keep the first of every id. Later ones get a new id with the prefix, so nothing is lost and ids stay unique. */
function uniek(lijst, voorvoegsel) {
  const gezien = new Set();
  return lijst.map((x) => {
    if (!gezien.has(x.id)) {
      gezien.add(x.id);
      return x;
    }
    const nieuw = { ...x, id: nieuwId(voorvoegsel) };
    gezien.add(nieuw.id);
    return nieuw;
  });
}

/**
 * A project from outside (storage or import), or null when it is not a project.
 * Always has at least one version, and an existing active version.
 */
export function normProject(x, nu = Date.now()) {
  if (!isObject(x)) return null;
  const lijst = (v) => (Array.isArray(v) ? v : []);
  const plattegronden = uniek(lijst(x.plattegronden).slice(0, LIMIETEN.plattegronden).map(normPlattegrond).filter(Boolean), 'f');
  const meubels = uniek(lijst(x.meubels).slice(0, LIMIETEN.meubels).map(normMeubel).filter(Boolean), 'm');
  const meubelIds = new Set(meubels.map((m) => m.id));
  let versies = uniek(lijst(x.versies).slice(0, LIMIETEN.versies).map((v) => normVersie(v, plattegronden, meubelIds, nu)).filter(Boolean), 'v');
  if (versies.length === 0) versies = [maakVersie('Indeling 1', nu)];
  const gewenst = schoonId(x.actief);
  const nieuwste = [...versies].sort((a, b) => b.gewijzigd - a.gewijzigd)[0];
  return {
    v: VERSIE,
    id: veiligeId(x.id, 'p'),
    naam: schoonNaam(x.naam, 'Mijn woning'),
    gemaakt: tijd(x.gemaakt, nu),
    gewijzigd: tijd(x.gewijzigd, nu),
    voorbeeld: x.voorbeeld === true,
    plattegronden,
    meubels,
    versies,
    actief: versies.some((v) => v.id === gewenst) ? gewenst : nieuwste.id,
  };
}

export function leegProject(naam = 'Mijn woning', nu = Date.now()) {
  return normProject({ naam, gemaakt: nu, gewijzigd: nu }, nu);
}

function hash(tekst) {
  let h = 5381;
  for (let i = 0; i < tekst.length; i += 1) h = ((h << 5) + h + tekst.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** A short fingerprint of the content, so importing the same export twice can be recognised. Dates and the project name do not count. */
export function vingerafdruk(project) {
  const kern = {
    plattegronden: project.plattegronden,
    meubels: project.meubels,
    versies: project.versies.map((v) => ({ id: v.id, naam: v.naam, plaatsing: v.plaatsing })),
  };
  return hash(JSON.stringify(kern));
}
