// The move window (TL-03, overzicht 6.4): the dates of the user on one strip, with the days between
// each pair of consecutive dates. It only calculates with dates the user filled in. It estimates no costs.

import { isDatum, pasOffsetToe, verschilDagen } from './datum.js';

export const VENSTER_PUNTEN = [
  { id: 'overdracht_nieuw', naam: 'Overdracht nieuwe woning' },
  { id: 'overdracht_eigen', naam: 'Overdracht eigen woning' },
  { id: 'verhuisdatum', naam: 'Verhuisdatum' },
  { id: 'einde_huur', naam: 'Einde huidige huur' },
  { id: 'ingang_huur', naam: 'Ingang nieuwe huur' },
];

export const MELDING_TWEE_WONINGEN = 'Tussen deze twee datums heb je mogelijk twee woningen tegelijk.';
export const MELDING_GEEN_EIGEN_WONING = 'Tussen deze twee datums heb je mogelijk even geen eigen woning.';
export const MELDING_ZELFDE_DAG = 'De overdracht van je nieuwe en je eigen woning valt op dezelfde dag.';

/**
 * @param {Record<string, string>} datums dates of the user by anchor id
 * @param {{van: string, tot: string, bron_id?: string}|null} [gemeenteVenster] the legal window around the move date
 *        (taken from the data of the municipal task, for example { van: '-4w', tot: '+5d' })
 */
export function bouwVenster(datums, gemeenteVenster = null) {
  const punten = VENSTER_PUNTEN.filter((p) => isDatum(datums?.[p.id])).map((p, volgorde) => ({ ...p, datum: datums[p.id], soort: 'ingevuld', volgorde }));
  punten.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : a.volgorde - b.volgorde));

  const tussen = [];
  for (let i = 0; i < punten.length - 1; i += 1) {
    tussen.push({ van: punten[i].id, naar: punten[i + 1].id, dagen: verschilDagen(punten[i].datum, punten[i + 1].datum) });
  }

  let gemeente = null;
  if (gemeenteVenster && isDatum(datums?.verhuisdatum)) {
    gemeente = {
      van: pasOffsetToe(datums.verhuisdatum, gemeenteVenster.van),
      tot: pasOffsetToe(datums.verhuisdatum, gemeenteVenster.tot),
      soort: 'wettelijk',
      bron_id: gemeenteVenster.bron_id ?? null,
    };
  }

  let melding = null;
  if (isDatum(datums?.overdracht_nieuw) && isDatum(datums?.overdracht_eigen)) {
    const dagen = verschilDagen(datums.overdracht_nieuw, datums.overdracht_eigen);
    if (dagen > 0) melding = { soort: 'twee_woningen', tekst: MELDING_TWEE_WONINGEN, dagen, link: 'CL-D1' };
    else if (dagen < 0) melding = { soort: 'geen_eigen_woning', tekst: MELDING_GEEN_EIGEN_WONING, dagen: -dagen, link: 'CL-D1' };
    else melding = { soort: 'zelfde_dag', tekst: MELDING_ZELFDE_DAG, dagen: 0, link: 'CL-D1' };
  }

  return { zichtbaar: punten.length >= 2, punten, tussen, gemeente, melding };
}
