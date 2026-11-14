// Tiny DOM helper. Text is always added as text nodes, never as HTML, so imported or typed text cannot run as markup.

export function h(tag, attrs, ...kinderen) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = String(v); // through the CSSOM: the strict CSP blocks a style attribute in markup
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kind of kinderen.flat(Infinity)) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

/**
 * Append children to an existing element, with the same rules as h(): null, undefined and false are skipped.
 * The native el.append(null) would write the word "null" on the page.
 */
export function voeg(el, ...kinderen) {
  for (const kind of kinderen.flat(Infinity)) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}

export function leeg(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Offer a text as a file download. */
export function download(tekst, type, naam) {
  const blob = new Blob([tekst], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: naam });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Like h(), but for SVG elements. Text is added as text nodes. */
export function s(tag, attrs, ...kinderen) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'style') el.style.cssText = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kind of kinderen.flat(Infinity)) {
    if (kind === null || kind === undefined || kind === false) continue;
    el.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return el;
}
