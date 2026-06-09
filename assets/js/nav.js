/**
 * Site-wide navigation
 * Requires NAV_ROOT to be set before this script runs:
 *   <script>const NAV_ROOT = './';</script>    <!-- index.html -->
 *   <script>const NAV_ROOT = '../';</script>    <!-- pages/*.html -->
 *   <script>const NAV_ROOT = '../../';</script> <!-- pages/portfolio/*.html -->
 *
 * To add a new portfolio project, add an entry to portfolioItems below.
 */
(function () {
  const root = (typeof NAV_ROOT !== 'undefined') ? NAV_ROOT : './';
  const path = window.location.pathname;
  const isHome = path === '/' || path.endsWith('/index.html') || path.endsWith('/timonkool.github.io/');

  function href(rel) { return root + rel; }
  function sectionHref(id) {
    return isHome ? '#' + id : href('index.html#' + id);
  }

  const isCV        = path.includes('cv.html');
  const isPortfolio = path.includes('/portfolio/');

  // ── Portfolio items ───────────────────────────────────────────────────────
  // Add new portfolio projects here. Each item: { label, href, tag }
  const portfolioItems = [
    {
      label: 'Handboek AI & Cowork voor leiders',
      href:  href('pages/portfolio/handboek-ai-cowork.html'),
      tag:   'Handboek'
    },
    {
      label: 'Basistraining AI voor stichtingen',
      href:  href('pages/portfolio/basistraining-ai.html'),
      tag:   'Training'
    }
  ];

  const dropdownItems = portfolioItems.map(function (item) {
    return '<li>'
      + '<a href="' + item.href + '">'
      + '<span class="nav-dropdown-tag">' + item.tag + '</span>'
      + item.label
      + '</a>'
      + '</li>';
  }).join('');

  // ── Render ────────────────────────────────────────────────────────────────
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  nav.innerHTML =
    '<a class="nav-logo" href="' + href('index.html') + '">Timon Kool</a>'

    + '<button class="nav-toggle" aria-label="Menu openen" aria-expanded="false" aria-controls="nav-menu">'
    +   '<span></span><span></span><span></span>'
    + '</button>'

    + '<ul class="nav-links" id="nav-menu" role="list">'
    +   '<li><a href="' + sectionHref('over-mij') + '">Over mij</a></li>'
    +   '<li><a href="' + sectionHref('ervaring') + '">Ervaring</a></li>'

    +   '<li class="nav-item-dropdown" id="nav-portfolio-item">'
    +     '<div class="nav-item-row">'
    +       '<a href="' + sectionHref('portfolio') + '"' + (isPortfolio ? ' class="nav-active"' : '') + '>Portfolio</a>'
    +       '<button class="nav-dropdown-toggle" aria-expanded="false" aria-haspopup="true" aria-label="Toon projecten">'
    +         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'
    +           '<polyline points="6 9 12 15 18 9"/>'
    +         '</svg>'
    +       '</button>'
    +     '</div>'
    +     '<ul class="nav-dropdown" role="list">' + dropdownItems + '</ul>'
    +   '</li>'

    +   '<li><a href="' + sectionHref('contact') + '">Contact</a></li>'
    +   '<li class="nav-item-cv"><a href="' + href('pages/cv.html') + '"' + (isCV ? ' class="nav-active"' : '') + '>CV</a></li>'
    + '</ul>';

  // ── Scroll shadow ─────────────────────────────────────────────────────────
  function onScroll() {
    nav.classList.toggle('nav-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ── Mobile main toggle ────────────────────────────────────────────────────
  var toggle = nav.querySelector('.nav-toggle');
  var menu   = nav.querySelector('.nav-links');

  toggle.addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    this.setAttribute('aria-label', open ? 'Menu openen' : 'Menu sluiten');
    menu.classList.toggle('nav-open', !open);
  });

  // Close main menu when a non-dropdown link is clicked
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
      menu.classList.remove('nav-open');
    });
  });

  // ── Portfolio dropdown ────────────────────────────────────────────────────
  var portfolioItem  = document.getElementById('nav-portfolio-item');
  var dropdownToggle = portfolioItem && portfolioItem.querySelector('.nav-dropdown-toggle');

  function openDropdown() {
    portfolioItem.classList.add('dropdown-open');
    dropdownToggle.setAttribute('aria-expanded', 'true');
  }

  function closeDropdown() {
    portfolioItem.classList.remove('dropdown-open');
    dropdownToggle.setAttribute('aria-expanded', 'false');
  }

  if (portfolioItem && dropdownToggle) {
    // Chevron button: toggle open/closed
    dropdownToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      portfolioItem.classList.contains('dropdown-open') ? closeDropdown() : openDropdown();
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (!portfolioItem.contains(e.target)) closeDropdown();
    });
  }

  // ── Keyboard: Escape closes everything ───────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (menu.classList.contains('nav-open')) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
      menu.classList.remove('nav-open');
      toggle.focus();
    }
    if (portfolioItem && portfolioItem.classList.contains('dropdown-open')) {
      closeDropdown();
    }
  });
})();
