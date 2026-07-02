import './style.css';
import { Game, type GameDom } from './game/Game';

// dev-only remote console for on-device debugging: open http://<ip>:5174/?debug
// on the phone and an inspectable console appears (errors, DOM, network).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/eruda';
  s.onload = () => (window as unknown as { eruda?: { init: () => void } }).eruda?.init();
  document.head.appendChild(s);
}

/**
 * Mobile width is computed at load (constants.ts). If the page loads in PORTRAIT
 * the landscape width is only an estimate (screen ratio), which can leave a thin
 * letterbox after rotating. So: on a touch/short device that loaded portrait,
 * reload ONCE the moment it becomes landscape — the reload recomputes width from
 * the live landscape viewport for an exact, zero-bar fill. The user is still on
 * the "rotate your device" card at that point, so it's seamless. sessionStorage
 * guards against any reload loop.
 */
function setupOrientationRefit(): void {
  const coarse = window.matchMedia?.('(pointer:coarse)').matches ?? false;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  if (!(coarse || shortSide <= 600)) return; // desktop — fixed 1.48:1, no refit
  if (window.innerWidth >= window.innerHeight) return; // loaded landscape → already exact
  try { if (sessionStorage.getItem('bccc-refit')) return; } catch { /* no storage */ }

  const refit = (): void => {
    if (window.innerWidth <= window.innerHeight) return; // still portrait
    try { sessionStorage.setItem('bccc-refit', '1'); } catch { /* no storage */ }
    location.reload();
  };
  window.matchMedia('(orientation: landscape)').addEventListener?.('change', () => setTimeout(refit, 200));
  window.addEventListener('orientationchange', () => setTimeout(refit, 250));
}
setupOrientationRefit();

/** iOS Safari's URL bar makes 100vh/100dvh unreliable, which clips the bottom of
 *  the scene. Mirror the live viewport height into --app-height and keep it fresh
 *  on resize/rotate; the mobile layout sizes to this instead of 100dvh. */
/**
 * Drive the full-screen mobile layout from JS classes instead of relying solely
 * on CSS media features (pointer/height), which behaved inconsistently in iOS
 * Chrome and left the game rendering as a small centered card. `immersive` =
 * touch device OR small viewport; `landscape` = wider than tall. CSS keys the
 * full-bleed layout off html.immersive.landscape and the rotate prompt off
 * html.immersive:not(.landscape).
 */
// a friend's share link carries ?ref=<their handle>; remember it so the claim
// can credit the referrer (the "+5% when a friend plays" bonus flow)
try {
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref) localStorage.setItem('bccc-ref-by', ref.slice(0, 40));
} catch {
  /* no storage */
}

// the .brand-logo CSS mask must respect the deploy base (vite base './'). Resolve
// to an ABSOLUTE url against the document — a relative url() inside a CSS custom
// property resolves against the *stylesheet* file in WebKit, which on a subpath
// deploy (GitHub Pages) doubles the path (/assets/assets/...) and the logo vanishes.
const logoUrl = new URL(`${import.meta.env.BASE_URL}assets/art/trollco-logo.png`, document.baseURI).href;
document.documentElement.style.setProperty('--logo-mask', `url("${logoUrl}")`);

function applyLayoutClasses(): void {
  const root = document.documentElement;
  const coarse = window.matchMedia?.('(pointer:coarse)').matches ?? false;
  const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window; // iOS always reports this
  const small = Math.min(window.innerWidth, window.innerHeight) <= 600; // phone-ish short side
  root.classList.toggle('immersive', coarse || touch || small);
  root.classList.toggle('landscape', window.innerWidth > window.innerHeight);
}
applyLayoutClasses();
window.addEventListener('resize', applyLayoutClasses);
window.addEventListener('orientationchange', () => setTimeout(applyLayoutClasses, 100));

function trackViewportHeight(): void {
  const set = (): void => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`);
  };
  set();
  window.addEventListener('resize', set);
  window.addEventListener('orientationchange', () => setTimeout(set, 300));
  window.visualViewport?.addEventListener('resize', set);
}
trackViewportHeight();

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`[bccc] missing #${id} in index.html`);
  return node as T;
}

async function boot(): Promise<void> {
  const dom: GameDom = {
    stage: el('stage'),
    overlay: el('overlay'),
    ballNo: el('ballNo'),
    best: el('best'),
    footTag: el('footTag'),
    soundBtn: el<HTMLButtonElement>('soundBtn'),
  };

  // wait for the brand webfonts so Pixi Text measures correctly on first paint
  try {
    await document.fonts.ready;
  } catch {
    /* no-op — proceed with fallback serif */
  }

  const game = new Game(dom);
  await game.start();

  // handy for tuning from the console: window.__bccc.grade.setOptions({ halation: 1.6 })
  (window as unknown as { __bccc: unknown }).__bccc = game;
}

void boot();
