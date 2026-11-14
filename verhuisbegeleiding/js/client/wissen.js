// Wipe everything this site keeps on the device: the status of the dashboard (with the cost overview, the list of things and
// my file), the furniture planner with its floor plans, the preferences and the measurement of the session.
// Everything the site writes starts with "vb:", so that is what goes. Other sites are not touched.

const VOORVOEGSEL = 'vb:';

function wisUit(opslag) {
  let gewist = 0;
  try {
    const sleutels = [];
    for (let i = 0; i < opslag.length; i += 1) {
      const k = opslag.key(i);
      if (k?.startsWith(VOORVOEGSEL)) sleutels.push(k);
    }
    for (const k of sleutels) {
      opslag.removeItem(k);
      gewist += 1;
    }
  } catch {
    // storage is blocked: there is nothing to wipe
  }
  return gewist;
}

/** @returns {number} how many items were removed */
export function wisAlleGegevens() {
  let n = 0;
  try {
    n += wisUit(globalThis.localStorage);
  } catch {
    // blocked
  }
  try {
    n += wisUit(globalThis.sessionStorage);
  } catch {
    // blocked
  }
  return n;
}
