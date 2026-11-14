// Agenda export (TL-05, overzicht 6.5): an .ics file (RFC 5545) with all-day events, a fixed UID per item,
// a DTSTAMP, a SEQUENCE that rises with every export, one reminder per event, lines of at most 75 octets,
// CRLF line endings and escaped text. Pure functions; the browser code only offers the file for download.

import { plusDagen } from './datum.js';
import { rekenItem } from './tijd.js';

const CRLF = '\r\n';
const encoder = new TextEncoder();

/** Escape a TEXT value: backslash, semicolon, comma and line breaks. Control characters are dropped. */
export function escapeTekst(waarde) {
  const schoon = [...String(waarde)]
    .filter((ch) => {
      const c = ch.codePointAt(0);
      return c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
    })
    .join('');
  return schoon.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** Fold one content line at 75 octets (not characters). Multi-byte characters are never split. */
export function vouwRegel(regel) {
  if (encoder.encode(regel).length <= 75) return regel;
  const delen = [];
  let huidig = '';
  let bytes = 0;
  let max = 75;
  for (const ch of regel) {
    const b = encoder.encode(ch).length;
    if (bytes + b > max) {
      delen.push(huidig);
      huidig = '';
      bytes = 0;
      max = 74; // a continuation line starts with one space
    }
    huidig += ch;
    bytes += b;
  }
  delen.push(huidig);
  return delen.join(`${CRLF} `);
}

function stempel(nu) {
  return nu.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsDatum(datum) {
  return datum.replaceAll('-', '');
}

/** The reminder fires `dagen` days before the date at 09:00 local time. For all-day events a trigger is relative to 00:00. */
export function triggerVoorDagen(dagen) {
  const n = Math.max(0, Math.trunc(dagen));
  if (n === 0) return 'PT9H';
  if (n === 1) return '-PT15H';
  return `-P${n - 1}DT15H`;
}

export function maakUid(sleutel, domein = 'verhuisbegeleiding.invalid') {
  return `vb-${String(sleutel).replace(/[^A-Za-z0-9._-]/g, '-')}@${domein}`;
}

/**
 * @param {{sleutel: string, titel: string, datum: string, beschrijving?: string, herinneringDagen?: number}[]} gebeurtenissen
 * @param {{naam?: string, domein?: string, nu?: Date, volgnummer?: number}} [opties]
 *        volgnummer must rise with every export of the same calendar (SEQUENCE)
 */
export function maakIcs(gebeurtenissen, { naam = 'Verhuisbegeleiding', domein = 'verhuisbegeleiding.invalid', nu = new Date(), volgnummer = 0 } = {}) {
  const regels = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Verhuisbegeleiding//Agenda-export 1//NL', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeTekst(naam)}`];
  const gesorteerd = [...gebeurtenissen].sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.sleutel < b.sleutel ? -1 : 1));
  for (const g of gesorteerd) {
    regels.push(
      'BEGIN:VEVENT',
      `UID:${maakUid(g.sleutel, domein)}`,
      `DTSTAMP:${stempel(nu)}`,
      `DTSTART;VALUE=DATE:${icsDatum(g.datum)}`,
      `DTEND;VALUE=DATE:${icsDatum(plusDagen(g.datum, 1))}`,
      `SEQUENCE:${Math.max(0, Math.trunc(volgnummer))}`,
      `SUMMARY:${escapeTekst(g.titel)}`,
      `DESCRIPTION:${escapeTekst(g.beschrijving ?? '')}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeTekst(g.titel)}`,
      `TRIGGER:${triggerVoorDagen(g.herinneringDagen ?? 7)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  regels.push('END:VCALENDAR');
  return regels.map(vouwRegel).join(CRLF) + CRLF;
}

/**
 * Events from the tasks and dates of the user. The title says which kind of date it is ("Deadline", "Tip", ...).
 * @param {object[]} items tasks with id, titel, uitleg, tijd, waarschuwing_dagen
 * @param {{datums: object, overrides?: object}} state
 * @param {{model: object, tipsUitsluiten?: boolean, geselecteerd?: Set<string>|null, metDatums?: boolean}} opties
 */
export function gebeurtenissenUitItems(items, state, { model, tipsUitsluiten = false, geselecteerd = null, metDatums = true } = {}) {
  const uit = [];
  const soortNaam = (soort) => (soort === 'wettelijk' ? 'Deadline' : soort === 'contractueel' ? 'Contract' : soort === 'richtlijn' ? 'Tip' : 'Door jou ingevuld');
  for (const item of items) {
    for (const r of rekenItem(item, state)) {
      if (!r.deadline || r.onbekend) continue;
      if (tipsUitsluiten && r.soort === 'richtlijn') continue;
      if (geselecteerd && !geselecteerd.has(r.sleutel)) continue;
      const label = r.label ? ` (${r.label})` : '';
      const delen = [item.uitleg ?? '', r.van && r.van !== r.deadline ? `Kan vanaf ${r.van}.` : '', model?.tijdsoorten?.[r.soort]?.naam ? `Soort datum: ${model.tijdsoorten[r.soort].naam}.` : ''];
      if (r.soort === 'contractueel') delen.push('Controleer dit in je koopovereenkomst. De koopovereenkomst is leidend.');
      if (r.soort === 'richtlijn') delen.push('Dit is een tip van ons, geen regel.');
      uit.push({
        sleutel: r.sleutel,
        titel: `${soortNaam(r.soort)}: ${item.titel}${label}`,
        datum: r.deadline,
        beschrijving: delen.filter(Boolean).join(' '),
        herinneringDagen: item.waarschuwing_dagen ?? (r.soort === 'richtlijn' || r.soort === 'ingevuld' ? 1 : 7),
      });
    }
  }
  if (metDatums && model) {
    for (const anker of model.ankers) {
      const w = state.datums?.[anker.id];
      const lijst = Array.isArray(w) ? w.map((x, i) => ({ datum: x.waarde, label: x.label, i })) : w ? [{ datum: w, label: null, i: 0 }] : [];
      for (const { datum, label, i } of lijst) {
        const sleutel = `datum-${anker.id}${Array.isArray(w) ? `-${i}` : ''}`;
        if (geselecteerd && !geselecteerd.has(sleutel)) continue;
        uit.push({ sleutel, titel: `Door jou ingevuld: ${anker.naam}${label ? ` (${label})` : ''}`, datum, beschrijving: 'Dit is een datum die je zelf hebt ingevuld.', herinneringDagen: 1 });
      }
    }
  }
  return uit;
}
