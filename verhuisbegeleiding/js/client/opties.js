// The few settings the browser needs from the build (site.config.json). They sit in <meta name="vb-opties"> on every page.
// Everything is checked here again, so a changed page cannot switch on something that the build did not.

const STANDAARD = { deellink: false, meting: false, donatieUrl: '' };

function lees() {
  try {
    const el = document.querySelector('meta[name="vb-opties"]');
    const o = JSON.parse(el?.content ?? '{}');
    return {
      deellink: o.deellink === true,
      meting: o.meting === true,
      donatieUrl: typeof o.donatieUrl === 'string' && o.donatieUrl.startsWith('https://') ? o.donatieUrl : '',
    };
  } catch {
    return { ...STANDAARD };
  }
}

export const opties = lees();
