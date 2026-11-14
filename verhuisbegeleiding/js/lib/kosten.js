// The cost overview (TL-09): transfer tax and the NHG fee from the facts in the data (with year and source), plus the amounts
// the visitor fills in. This is a calculation aid, not advice: the notary and the Belastingdienst decide. The rates are not in
// the code. They come from data/feiten/A1.yaml through the roles below, so a new year only needs new facts and new ids here.

/** Which fact plays which role. The test in test/kosten.test.js checks these ids against the real data. */
export const ROLLEN = {
  tariefZelf: 'F-100',
  starter: 'F-101',
  tariefNietZelf: 'F-102',
  voorstelNietZelf: 'F-103',
  tariefOverig: 'F-104',
  leeftijdMax: 'F-105',
  leeftijdMin: 'F-106',
  grensStarter: 'F-107',
  nhgGrens: 'F-109',
  nhgProvisie: 'F-111',
};

export const SITUATIES = ['zelf', 'niet_zelf', 'overig'];
export const MAX_BEDRAG = 1_000_000_000;

/**
 * @param {Record<string, object>} feitenById the facts for this tool, by id
 * @returns {{ok: true, feiten: Record<string, object>} | {ok: false, ontbreekt: string[]}}
 */
export function leesFeiten(feitenById) {
  const feiten = {};
  const ontbreekt = [];
  for (const [rol, id] of Object.entries(ROLLEN)) {
    const f = feitenById?.[id];
    if (f && Number.isFinite(f.waarde)) feiten[rol] = f;
    else ontbreekt.push(id);
  }
  return ontbreekt.length ? { ok: false, ontbreekt } : { ok: true, feiten };
}

const geldig = (n) => Number.isFinite(n) && n >= 0 && n <= MAX_BEDRAG;

/**
 * Does the starters exemption apply? All conditions must hold. The value of the home is taken as the purchase price.
 * @returns {{geldt: boolean, nietVoldaan: string[]}}
 */
export function startersvrijstelling({ situatie, leeftijdOk, nietEerderGebruikt, koopsom }, feiten) {
  const nietVoldaan = [];
  if (situatie !== 'zelf') nietVoldaan.push('Je gaat er niet zelf wonen.');
  if (!leeftijdOk) nietVoldaan.push(`Je bent op de dag van de akte niet ${feiten.leeftijdMin.waarde} jaar of ouder en jonger dan ${feiten.leeftijdMax.waarde} jaar.`);
  if (!nietEerderGebruikt) nietVoldaan.push('Je hebt de vrijstelling al eerder gebruikt of weet dat nog niet.');
  if (!geldig(koopsom) || koopsom > feiten.grensStarter.waarde) nietVoldaan.push('De koopsom ligt boven de grens voor de vrijstelling.');
  return { geldt: nietVoldaan.length === 0, nietVoldaan };
}

/**
 * Transfer tax over the purchase price, with the fact that was used. When the visitor typed an amount, that amount counts.
 * @returns {{bedrag: number, tarief: number|null, feit: object|null, handmatig: boolean} | {bedrag: null, reden: string}}
 */
export function overdrachtsbelasting({ koopsom, situatie, starterGeldt, handmatig = null }, feiten) {
  if (geldig(handmatig)) return { bedrag: Math.round(handmatig), tarief: null, feit: null, handmatig: true };
  if (!geldig(koopsom) || koopsom <= 0) return { bedrag: null, reden: 'Vul de koopsom in.' };
  if (!SITUATIES.includes(situatie)) return { bedrag: null, reden: 'Kies je situatie.' };
  const feit = situatie === 'zelf' ? (starterGeldt ? feiten.starter : feiten.tariefZelf) : situatie === 'niet_zelf' ? feiten.tariefNietZelf : feiten.tariefOverig;
  return { bedrag: Math.round((koopsom * feit.waarde) / 100), tarief: feit.waarde, feit, handmatig: false };
}

/** The one-off fee for a mortgage with NHG, over the amount borrowed. */
export function nhgProvisie({ hypotheek, nhg }, feiten) {
  if (!nhg || !geldig(hypotheek) || hypotheek <= 0) return null;
  return { bedrag: Math.round((hypotheek * feiten.nhgProvisie.waarde) / 100), tarief: feiten.nhgProvisie.waarde, feit: feiten.nhgProvisie };
}

/** Is the purchase price within the NHG limit? The limit counts the purchase price including renovation costs. */
export function nhgGrensCheck({ koopsom }, feiten) {
  if (!geldig(koopsom) || koopsom <= 0) return null;
  return { binnenGrens: koopsom <= feiten.nhgGrens.waarde, grens: feiten.nhgGrens.waarde, feit: feiten.nhgGrens };
}

export function somPosten(posten) {
  return (posten ?? []).reduce((n, p) => n + (geldig(p?.bedrag) ? p.bedrag : 0), 0);
}

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function formatEuro(n) {
  return euro.format(n);
}

/** The percentage as text with a comma: 10.4 becomes "10,4". */
export function procentTekst(waarde) {
  return String(waarde).replace('.', ',');
}

/**
 * A number from what the visitor typed: "350.000", "€ 1.234,56", "5000". Whole euros. null for empty or unusable text.
 * A dot followed by exactly three digits counts as a thousands separator.
 */
export function parseBedrag(tekst) {
  // Remove the euro sign and any whitespace (\s also covers the no-break space).
  let t = String(tekst ?? '').replace(new RegExp(`[${String.fromCharCode(0x20ac)}\\s]`, 'g'), '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Math.round(Number.parseFloat(t));
  return geldig(n) ? n : null;
}
