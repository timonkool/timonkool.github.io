// Loaded on every page. Pages work without JavaScript. This script only marks that scripting is available,
// so the stylesheet can show the interactive parts, opens the folded explanations while printing, and starts the
// measurement when the build switched it on (BC-06, off by default).

import { opties } from './opties.js';

document.documentElement.classList.add('js');

let eerderOpen = null;

window.addEventListener('beforeprint', () => {
  const lijst = [...document.querySelectorAll('main details')];
  eerderOpen = lijst.map((d) => [d, d.open]);
  for (const d of lijst) d.open = true;
});

window.addEventListener('afterprint', () => {
  for (const [d, open] of eerderOpen ?? []) d.open = open;
  eerderOpen = null;
});

// The menu is a <details>, so it opens without this script. The script closes it with Escape, with a click
// next to it, and when the focus leaves it.
const menu = document.querySelector('.sitekop details.menu');
if (menu) {
  const sluit = (terug) => {
    if (!menu.open) return;
    menu.open = false;
    if (terug) menu.querySelector('summary')?.focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sluit(menu.contains(document.activeElement));
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) sluit(false);
  });
  menu.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !menu.contains(e.relatedTarget)) sluit(false);
  });
}

if (opties.meting) {
  const { startSessiemeting } = await import('./meting.js');
  startSessiemeting();
}
