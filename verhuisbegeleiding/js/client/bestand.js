// Offer a text as a file: through the share sheet of the phone when that can share files, as a download otherwise.
// Used for the status of the dashboard and for the furniture planner.

import { download } from './dom.js';

/**
 * @returns {Promise<'gedeeld'|'gedownload'|'afgebroken'>}
 */
export async function deelOfDownload({ tekst, naam, type = 'application/json', titel }) {
  try {
    const bestand = new File([tekst], naam, { type });
    if (navigator.canShare?.({ files: [bestand] })) {
      await navigator.share({ files: [bestand], title: titel });
      return 'gedeeld';
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'afgebroken';
  }
  download(tekst, type, naam);
  return 'gedownload';
}
