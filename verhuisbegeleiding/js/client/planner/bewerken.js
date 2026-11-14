// Editing the layout: the actions behind the buttons, the selection bar and the keyboard.
// Each action takes a snapshot for undo, changes the project through the functions in src/lib/planner/acties.js,
// and then calls naBewerking, which saves soon and draws everything again.

import { draaiMet, haalWeg, plaats, verplaatsNaar, zetDraaiing } from '../../lib/planner/acties.js';
import { bewaarVoorOngedaan, momentopname, naBewerking, ongedaanMaken, opnieuwDoen, S, teken, versie } from './staat.js';
import { middenVanBeeld, toonMeubel } from './werkblad.js';
import { track } from '../meting.js';

export function plaatsMeubel(id) {
  const voor = momentopname();
  const m = middenVanBeeld();
  const p = plaats(S.project, id, S.plattegrondId, m);
  if (!p) return;
  bewaarVoorOngedaan(voor);
  S.sel = id;
  naBewerking();
  track('meubel_geplaatst');
}

export function haalMeubelWeg(id) {
  const voor = momentopname();
  if (!haalWeg(S.project, id)) return;
  bewaarVoorOngedaan(voor);
  if (S.sel === id) S.sel = null;
  naBewerking();
}

export function draaiSelectie(graden) {
  if (!S.sel) return;
  const voor = momentopname();
  if (draaiMet(S.project, S.sel, graden)) {
    bewaarVoorOngedaan(voor);
    naBewerking();
  }
}

export function zetHoekSelectie(graden) {
  if (!S.sel || !Number.isFinite(graden)) return;
  const voor = momentopname();
  if (zetDraaiing(S.project, S.sel, graden)) {
    bewaarVoorOngedaan(voor);
    naBewerking();
  }
}

let laatsteSchuif = { tijd: 0, id: null };

/** Move the selected piece by dx, dy cm. Keys pressed in quick succession count as one step for undo. */
export function schuifSelectie(dx, dy) {
  const v = versie();
  const p = S.sel && v?.plaatsing[S.sel];
  if (!p) return;
  const nu = Date.now();
  if (nu - laatsteSchuif.tijd > 700 || laatsteSchuif.id !== S.sel) bewaarVoorOngedaan(momentopname());
  laatsteSchuif = { tijd: nu, id: S.sel };
  verplaatsNaar(S.project, S.sel, p.x + dx, p.y + dy);
  naBewerking();
}

export function doeOngedaan() {
  if (ongedaanMaken()) naBewerking();
}

export function doeOpnieuw() {
  if (opnieuwDoen()) naBewerking();
}

export function kiesMeubel(id) {
  const v = versie();
  if (v?.plaatsing[id]) toonMeubel(id);
}

/** Keyboard: undo, redo, move, rotate, remove from the plan, deselect. Typing in a field is left alone. */
export function toetsenbord(e) {
  const t = e.target;
  const tag = t?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
  const mod = e.ctrlKey || e.metaKey;
  const toets = e.key.toLowerCase();
  if (mod && toets === 'z') {
    e.preventDefault();
    if (e.shiftKey) doeOpnieuw();
    else doeOngedaan();
    return;
  }
  if (mod && toets === 'y') {
    e.preventDefault();
    doeOpnieuw();
    return;
  }
  if (!S.sel || mod || e.altKey) return;
  if (e.key === 'Escape') {
    S.sel = null;
    teken.alles();
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    haalMeubelWeg(S.sel);
    return;
  }
  if (toets === 'r') {
    e.preventDefault();
    draaiSelectie(e.shiftKey ? -90 : 90);
    return;
  }
  const stap = e.shiftKey ? 10 : 1;
  const richting = { ArrowLeft: [-stap, 0], ArrowRight: [stap, 0], ArrowUp: [0, -stap], ArrowDown: [0, stap] }[e.key];
  if (!richting) return;
  e.preventDefault();
  schuifSelectie(...richting);
}
