// Share link (TL-06): the state sits in the fragment of the url (#d=...), compressed and base64url encoded.
// A fragment is never sent to a server. The caller must show a privacy warning before the link is shared,
// and falls back to a file when the link gets too long. The link carries only what a partner needs:
// the intake, the dates, the moments and what is checked. No free text except the labels of dates.

import { valideerState } from './schema.js';

export const MAX_LINK_LENGTE = 2000;
export const MAX_GEDECOMPRIMEERD = 100000;
const VOORVOEGSEL = '#d=';

function naarBase64Url(bytes) {
  let binair = '';
  for (const b of bytes) binair += String.fromCharCode(b);
  return btoa(binair).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function vanBase64Url(tekst) {
  if (!/^[A-Za-z0-9_-]*$/.test(tekst)) throw new Error('Ongeldige tekens in de link.');
  const gevuld = tekst.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(tekst.length / 4) * 4, '=');
  const binair = atob(gevuld);
  return Uint8Array.from(binair, (c) => c.charCodeAt(0));
}

async function lees(stroom, limiet) {
  const lezer = stroom.getReader();
  const delen = [];
  let totaal = 0;
  for (;;) {
    const { done, value } = await lezer.read();
    if (done) break;
    totaal += value.length;
    if (totaal > limiet) {
      await lezer.cancel();
      throw new Error('De link is te groot om te lezen.');
    }
    delen.push(value);
  }
  const uit = new Uint8Array(totaal);
  let pos = 0;
  for (const d of delen) {
    uit.set(d, pos);
    pos += d.length;
  }
  return uit;
}

async function comprimeer(bytes) {
  return lees(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw')), MAX_GEDECOMPRIMEERD);
}

async function decomprimeer(bytes) {
  return lees(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')), MAX_GEDECOMPRIMEERD);
}

/** The part of the state that goes into a link. */
export function deelVoorLink(state) {
  return {
    versie: state.versie,
    intake: state.intake,
    datums: state.datums,
    momenten: state.momenten,
    nietVanToepassingSporen: state.nietVanToepassingSporen,
    afgevinkt: state.afgevinkt,
    nietVanToepassing: state.nietVanToepassing,
    overrides: state.overrides,
  };
}

/**
 * @returns {Promise<{ok: true, url: string, lengte: number} | {ok: false, reden: 'te_lang', lengte: number}>}
 */
export async function maakDeellink(state, basisUrl, { maxLengte = MAX_LINK_LENGTE } = {}) {
  const json = JSON.stringify(deelVoorLink(state));
  const gecomprimeerd = await comprimeer(new TextEncoder().encode(json));
  const url = `${basisUrl.split('#')[0]}${VOORVOEGSEL}${naarBase64Url(gecomprimeerd)}`;
  if (url.length > maxLengte) return { ok: false, reden: 'te_lang', lengte: url.length };
  return { ok: true, url, lengte: url.length };
}

/** Read a link or a fragment. Untrusted: it is checked against the schema and nothing else is used. */
export async function leesDeellink(fragmentOfUrl, model) {
  const i = String(fragmentOfUrl).indexOf(VOORVOEGSEL);
  if (i === -1) return { ok: false, state: null, problemen: ['Dit is geen link met gegevens.'] };
  try {
    const bytes = await decomprimeer(vanBase64Url(String(fragmentOfUrl).slice(i + VOORVOEGSEL.length)));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return valideerState(json, { model });
  } catch {
    return { ok: false, state: null, problemen: ['De link is beschadigd of onvolledig en kon niet worden gelezen.'] };
  }
}
