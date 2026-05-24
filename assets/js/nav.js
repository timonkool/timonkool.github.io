/**
 * Site-wide navigation
 * Requires NAV_ROOT to be set before this script runs:
 *   <script>const NAV_ROOT = './';</script>   <!-- index.html -->
 *   <script>const NAV_ROOT = '../';</script>   <!-- pages/*.html -->
 *   <script>const NAV_ROOT = '../../';</script> <!-- pages/portfolio/*.html -->
 */
(function () {
  const root = (typeof NAV_ROOT !== 'undefined') ? NAV_ROOT : './';

  // On the homepage, section links are plain anchors.
  // On subpages, they navigate to the homepage first.
  const path = window.location.pathname;
  const isHome = path === '/' || path.endsWith('/index.html') || path.endsWith('/timonkool.github.io/');

  function href(rel) {
    return root + rel;
  }

  function sectionHref(id) {
    return isHome ? '#' + id : href('index.html#' + id);
  }

  // Determine which nav item is "active"
  const isCV        = path.includes('cv.html');
  const isPortfolio = path.includes('/portfolio/');

  const nav = document.getElementById('site-nav');
  if (!nav) return;

  nav.innerHTML = `
    <a class="nav-logo" href="${href('index.html')}">Timon Kool</a>

    <button class="nav-toggle" aria-label="Menu openen" aria-expanded="false" aria-controls="nav-menu">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <ul class="nav-links" id="nav-menu" role="list">
      <li><a href="${sectionHref('over-mij')}">Over mij</a></li>
      <li><a href="${sectionHref('ervaring')}">Ervaring</a></li>
      <li><a href="${sectionHref('portfolio')}"${isPortfolio ? ' class="nav-active"' : ''}>Portfolio</a></li>
      <li><a href="${sectionHref('contact')}">Contact</a></li>
      <li class="nav-item-cv"><a href="${href('pages/cv.html')}"${isCV ? ' class="nav-active"' : ''}>CV</a></li>
    </ul>
  `;

  // Scroll shadow
  function onScroll() {
    nav.classList.toggle('nav-scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load

  // Mobile toggle
  const toggle = nav.querySelector('.nav-toggle');
  const menu   = nav.querySelector('.nav-links');

  toggle.addEventListener('click', function () {
    const open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    this.setAttribute('aria-label', open ? 'Menu openen' : 'Menu sluiten');
    menu.classList.toggle('nav-open', !open);
  });

  // Close menu when any link is clicked (useful on mobile)
  menu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
      menu.classList.remove('nav-open');
    });
  });

  // Close menu on Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('nav-open')) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
      menu.classList.remove('nav-open');
      toggle.focus();
    }
  });
})();
