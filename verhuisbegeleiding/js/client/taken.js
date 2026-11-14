// Checking off tasks on a checklist page (BC-01). The page works without this script: the tasks open and close with <details>.
// With the script, every task gets a checkbox and a "niet van toepassing" button, and the page shows the progress.
// The state is the same as on the dashboard, so a task checked here is checked there.

import { h, leeg } from './dom.js';
import { laadApp } from './state.js';
import { voortgang } from '../lib/aandacht.js';
import { donatieBlok } from './donatie.js';
import { track } from './meting.js';

const app = await laadApp();
const lijst = document.querySelector('ol.taken');

if (lijst) {
  const items = [...lijst.querySelectorAll('li.taak')];
  const ids = items.map((li) => li.dataset.taakId);
  const voortgangEl = h('p', { class: 'voortgang-lijst', 'aria-live': 'polite' });
  const donatieEl = h('div');
  lijst.before(voortgangEl);
  lijst.after(donatieEl);

  for (const li of items) {
    const id = li.dataset.taakId;
    const titel = li.querySelector('.taaktitel').textContent;
    li.prepend(h('input', { type: 'checkbox', class: 'afvinken', 'aria-label': `Gedaan: ${titel}`, onchange: (e) => {
      app.wissel('afgevinkt', id);
      if (e.target.checked) track('taak_afgevinkt');
    } }));
    li.querySelector('.taakinhoud').append(h('p', null, h('button', { type: 'button', class: 'knop knop-klein knop-rustig nvt-knop', onclick: () => app.wissel('nietVanToepassing', id) }, 'Niet van toepassing')));
    li.classList.add('js-aan');
  }

  const teken = () => {
    const klaar = new Set(app.state.afgevinkt);
    const nvt = new Set(app.state.nietVanToepassing);
    for (const li of items) {
      const id = li.dataset.taakId;
      li.classList.toggle('klaar', klaar.has(id));
      li.classList.toggle('nvt', nvt.has(id));
      li.querySelector('input.afvinken').checked = klaar.has(id);
      li.querySelector('.nvt-knop').textContent = nvt.has(id) ? 'Weer tonen' : 'Niet van toepassing';
    }
    const v = voortgang(ids, { afgevinkt: app.state.afgevinkt, nietVanToepassing: app.state.nietVanToepassing });
    voortgangEl.textContent = `${v.klaar} van ${v.totaal} taken gedaan.${app.melding ? ` ${app.melding}` : ''}`;
    leeg(donatieEl);
    if (v.totaal > 0 && v.klaar === v.totaal) donatieEl.append(donatieBlok({ tekst: 'Je hebt alle taken van deze lijst gedaan.' }) ?? '');
  };
  app.luisteraars.add(teken);
  teken();
}
