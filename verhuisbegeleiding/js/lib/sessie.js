// The definition of an "actieve sessie van vijf minuten" (overzicht, sectie 10): five minutes in which there was
// interaction within every 30 seconds. One gap longer than 30 seconds breaks the stretch and the count starts again.
// Pure logic: the caller passes the time of every interaction, so the rule is easy to test.

export const MAX_STILTE_MS = 30_000;
export const DOEL_MS = 300_000;

/**
 * @param {{bijVijfMinuten?: () => void, maxStilte?: number, doel?: number, begin?: {start: number, laatste: number, geteld: boolean}|null}} [opties]
 *        begin: a stretch that was saved earlier (for example when the visitor went to another page in the same tab).
 */
export function maakSessieMeter({ bijVijfMinuten, maxStilte = MAX_STILTE_MS, doel = DOEL_MS, begin = null } = {}) {
  let start = begin && Number.isFinite(begin.start) ? begin.start : null;
  let laatste = begin && Number.isFinite(begin.laatste) ? begin.laatste : null;
  let geteld = begin?.geteld === true;

  return {
    /** Call with the time (in milliseconds) of every interaction. Returns true when this interaction completed the five minutes. */
    interactie(nu) {
      if (!Number.isFinite(nu)) return false;
      // The first interaction, a pause that was too long or a clock that went back: start a new stretch.
      if (laatste === null || nu < laatste || nu - laatste > maxStilte) start = nu;
      laatste = nu;
      if (!geteld && nu - start >= doel) {
        geteld = true;
        bijVijfMinuten?.();
        return true;
      }
      return false;
    },
    get geteld() {
      return geteld;
    },
    /** Milliseconds of the current unbroken stretch, up to the last interaction. */
    get aaneengesloten() {
      return laatste === null ? 0 : laatste - start;
    },
    /** What to save between pages. Contains times only. */
    get stand() {
      return start === null ? null : { start, laatste, geteld };
    },
  };
}
