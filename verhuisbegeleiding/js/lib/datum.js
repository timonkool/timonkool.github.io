// Calendar dates as "JJJJ-MM-DD" strings. All arithmetic happens at UTC midnight,
// so daylight saving time never shifts a day. Shared by the build, the browser code and the tests.

const MS_PER_DAG = 86400000;
const PATROON = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const WEEKDAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

export function isDatum(waarde) {
  if (typeof waarde !== 'string') return false;
  const m = PATROON.exec(waarde);
  if (!m) return false;
  const j = Number(m[1]);
  const mnd = Number(m[2]);
  const d = Number(m[3]);
  if (j < 1900 || j > 2200) return false;
  const dt = new Date(Date.UTC(j, mnd - 1, d));
  return dt.getUTCFullYear() === j && dt.getUTCMonth() === mnd - 1 && dt.getUTCDate() === d;
}

function eis(datum) {
  if (!isDatum(datum)) throw new Error(`Geen geldige datum: ${String(datum)}`);
}

/** Milliseconds at UTC midnight of the date. */
export function naarUtc(datum) {
  eis(datum);
  const [j, m, d] = datum.split('-').map(Number);
  return Date.UTC(j, m - 1, d);
}

export function vanUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function plusDagen(datum, aantal) {
  return vanUtc(naarUtc(datum) + Math.trunc(aantal) * MS_PER_DAG);
}

/** Whole days from `van` to `tot`. Positive when `tot` is later. */
export function verschilDagen(van, tot) {
  return Math.round((naarUtc(tot) - naarUtc(van)) / MS_PER_DAG);
}

/** "-4w", "+5d", "0d" becomes a signed number of days. */
export function parseOffset(offset) {
  const m = /^([+-]?)(\d+)([dw])$/.exec(String(offset).trim());
  if (!m) throw new Error(`Geen geldige verschuiving: ${String(offset)}`);
  const dagen = Number(m[2]) * (m[3] === 'w' ? 7 : 1);
  return m[1] === '-' ? -dagen : dagen;
}

export function pasOffsetToe(datum, offset) {
  return plusDagen(datum, parseOffset(offset));
}

/** Today as a calendar date in the local time zone. */
export function vandaag(nu = new Date()) {
  const j = nu.getFullYear();
  const m = String(nu.getMonth() + 1).padStart(2, '0');
  const d = String(nu.getDate()).padStart(2, '0');
  return `${j}-${m}-${d}`;
}

export function weekdagNaam(datum) {
  return WEEKDAGEN[new Date(naarUtc(datum)).getUTCDay()];
}

export function formatLang(datum) {
  eis(datum);
  const [j, m, d] = datum.split('-').map(Number);
  return `${d} ${MAANDEN[m - 1]} ${j}`;
}

export function formatKort(datum) {
  eis(datum);
  const [, m, d] = datum.split('-').map(Number);
  return `${d} ${MAANDEN[m - 1].slice(0, 3)}`;
}

/** "over 3 dagen", "vandaag", "2 dagen geleden". */
export function dagenTekst(aantal) {
  if (aantal === 0) return 'vandaag';
  if (aantal === 1) return 'morgen';
  if (aantal === -1) return 'gisteren';
  return aantal > 0 ? `over ${aantal} dagen` : `${-aantal} dagen geleden`;
}
