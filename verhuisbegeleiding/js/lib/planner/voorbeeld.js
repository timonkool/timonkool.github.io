// The example of the furniture planner: an own floor plan, drawn here in code (no plan from anyone else is included),
// with 17 pieces of furniture and a layout without overlap. The example project stores the tokens "voorbeeld:begane-grond"
// and "voorbeeld:verdieping" instead of a picture. The browser turns a token into a picture with voorbeeldUri().

import { normProject, nieuwId } from './model.js';

export const VOORBEELD_TOKENS = ['voorbeeld:begane-grond', 'voorbeeld:verdieping'];

const MUUR = '#4b5563';
const TEKST = '#8a96a3';

const lijn = (x1, y1, x2, y2, w = 8) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${MUUR}" stroke-width="${w}" stroke-linecap="square"/>`;
const raam = (x, y, b, d) => `<rect x="${x}" y="${y}" width="${b}" height="${d}" fill="#cfe3f7" stroke="#6b8cae" stroke-width="2"/>`;
const label = (x, y, tekst) => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="22" fill="${TEKST}">${tekst}</text>`;

function omlijning(delen) {
  const buiten = [lijn(20, 20, 880, 20, 10), lijn(880, 20, 880, 580, 10), lijn(20, 20, 20, 580, 10), ...delen.buiten];
  return buiten.join('');
}

const PLATTEGRONDEN = {
  'voorbeeld:begane-grond': () => [
    omlijning({ buiten: [lijn(20, 580, 100, 580, 10), lijn(190, 580, 880, 580, 10)] }),
    // wall between the living room and the kitchen with a wide opening, and the wall along the lower rooms
    lijn(470, 20, 470, 150), lijn(470, 300, 470, 400),
    lijn(20, 400, 90, 400), lijn(180, 400, 600, 400), lijn(690, 400, 880, 400),
    lijn(250, 400, 250, 450), lijn(250, 540, 250, 580), lijn(470, 400, 470, 580),
    raam(300, 15, 120, 10), raam(560, 15, 150, 10), raam(15, 120, 10, 130), raam(875, 120, 10, 130),
    label(40, 100, 'Woonkamer'),
    label(500, 60, 'Keuken en eethoek'),
    label(40, 440, 'Gang'),
    label(262, 500, 'Bijkeuken'),
    label(500, 440, 'Trap en gang'),
  ].join(''),
  'voorbeeld:verdieping': () => [
    omlijning({ buiten: [] }),
    lijn(400, 20, 400, 400), lijn(400, 490, 400, 580),
    lijn(520, 20, 520, 120), lijn(520, 210, 520, 430), lijn(520, 520, 520, 580),
    lijn(520, 330, 880, 330),
    raam(120, 15, 160, 10), raam(620, 15, 160, 10), raam(15, 250, 10, 120), raam(875, 400, 10, 100),
    label(40, 300, 'Slaapkamer 1'),
    label(414, 566, 'Gang'),
    label(536, 250, 'Slaapkamer 2'),
    label(536, 566, 'Badkamer'),
  ].join(''),
};

/** The picture of an example floor plan as an SVG, 900 by 600 pixels where one pixel is one centimeter. */
export function plattegrondSvg(token) {
  const teken = PLATTEGRONDEN[token];
  if (!teken) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" width="900" height="600"><rect width="900" height="600" fill="#ffffff"/>${teken()}</svg>`;
}

/** The address of the picture for a token, or an empty string for an unknown token. */
export function voorbeeldUri(token) {
  const svg = plattegrondSvg(token);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : '';
}

const M = (id, naam, b, d, h, kleur, volgorde, vloerkleed = false) => ({ id: `ex-${id}`, naam, b, d, h, kleur, vloerkleed, voorbeeld: true, volgorde });

const MEUBELS = [
  M('bank', 'Bank', 210, 95, 80, 'blauw', 1),
  M('fauteuil', 'Fauteuil', 85, 90, 85, 'indigo', 2),
  M('salontafel', 'Salontafel', 110, 60, 42, 'teal', 3),
  M('tvmeubel', 'TV-meubel', 160, 40, 50, 'grijs', 4),
  M('boekenkast', 'Boekenkast', 100, 35, 200, 'paars', 5),
  M('eettafel', 'Eettafel', 180, 90, 76, 'groen', 6),
  M('dressoir', 'Dressoir', 150, 45, 85, 'magenta', 7),
  M('vloerkleed', 'Vloerkleed woonkamer', 170, 230, 0, 'grijs', 8, true),
  M('tweepersoonsbed', 'Tweepersoonsbed', 160, 200, 45, 'blauw', 9),
  M('nachtkastje', 'Nachtkastje', 45, 40, 50, 'paars', 10),
  M('kledingkast', 'Kledingkast', 200, 60, 220, 'grijs', 11),
  M('eenpersoonsbed', 'Eenpersoonsbed', 90, 200, 40, 'groen', 12),
  M('commode', 'Commode', 100, 50, 90, 'magenta', 13),
  M('bureau', 'Bureau', 140, 70, 75, 'teal', 14),
  M('wasmachine', 'Wasmachine', 60, 60, 85, 'grijs', 15),
  M('droger', 'Droger', 60, 60, 85, 'indigo', 16),
  M('schuurkast', 'Schuurkast', 100, 50, 180, 'paars', 17),
];

// x and y are the middle of the piece in cm. r = 180 puts the front (the side that is marked) towards the top, r = 0 towards the bottom.
const BG = 'ex-bg';
const VD = 'ex-vd';
const PLAATSING = {
  'ex-bank': { p: BG, x: 150, y: 346.5, r: 180 },
  'ex-fauteuil': { p: BG, x: 390, y: 300, r: 90 },
  'ex-salontafel': { p: BG, x: 150, y: 235, r: 0 },
  'ex-tvmeubel': { p: BG, x: 150, y: 47, r: 0 },
  'ex-boekenkast': { p: BG, x: 330, y: 44.5, r: 0 },
  'ex-eettafel': { p: BG, x: 675, y: 200, r: 0 },
  'ex-dressoir': { p: BG, x: 675, y: 371.5, r: 180 },
  'ex-vloerkleed': { p: BG, x: 150, y: 225, r: 0 },
  'ex-wasmachine': { p: BG, x: 286, y: 436, r: 0 },
  'ex-droger': { p: BG, x: 348, y: 436, r: 0 },
  'ex-schuurkast': { p: BG, x: 410, y: 548, r: 180 },
  'ex-tweepersoonsbed': { p: VD, x: 210, y: 128, r: 0 },
  'ex-nachtkastje': { p: VD, x: 105, y: 52, r: 0 },
  'ex-kledingkast': { p: VD, x: 200, y: 544, r: 180 },
  'ex-eenpersoonsbed': { p: VD, x: 574, y: 128, r: 0 },
  'ex-commode': { p: VD, x: 849, y: 150, r: 90 },
  'ex-bureau': { p: VD, x: 700, y: 289, r: 180 },
};

/** A complete example project with an own floor plan, 17 pieces and a layout without overlap. */
export function voorbeeldProject(nu = Date.now()) {
  return normProject({
    id: nieuwId('p', nu),
    naam: 'Voorbeeldwoning',
    gemaakt: nu,
    gewijzigd: nu,
    voorbeeld: true,
    plattegronden: [
      { id: BG, naam: 'Begane grond', uri: 'voorbeeld:begane-grond', pw: 900, ph: 600, k: 1 },
      { id: VD, naam: 'Eerste verdieping', uri: 'voorbeeld:verdieping', pw: 900, ph: 600, k: 1 },
    ],
    meubels: MEUBELS,
    versies: [{ id: 'ex-indeling', naam: 'Voorbeeldindeling', gemaakt: nu, gewijzigd: nu, voorbeeld: true, plaatsing: PLAATSING }],
    actief: 'ex-indeling',
  }, nu);
}
