import { initSimulator } from './simulator';
import { initChecklist, initCopy, initHeader, initTheme, initWiring } from './ui';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const run = (name: string, fn: () => void): void => {
  try {
    fn();
  } catch (err) {
    console.error(`[ESPDeck] ${name} selhalo`, err);
  }
};

run('theme', initTheme);
run('header', initHeader);
run('copy', initCopy);
run('checklist', initChecklist);
run('wiring', initWiring);
run('simulator', () => {
  const sim = document.querySelector<HTMLElement>('[data-sim]');
  if (sim) initSimulator(sim, reduce);
});

if (!reduce) {
  const start = (): void => {
    import('./motion')
      .then((m) => m.initMotion())
      .catch((err: unknown) => console.error('[ESPDeck] animace se nenačetly', err));
  };
  // GSAP potřebuje až pohyb po stránce: načti ho při první interakci, ne během načítání
  const events = ['scroll', 'wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
  let started = false;
  const once = (): void => {
    if (started) return;
    started = true;
    events.forEach((ev) => window.removeEventListener(ev, once));
    start();
  };
  if (window.scrollY > 0 || location.hash.length > 1) once();
  else events.forEach((ev) => window.addEventListener(ev, once, { passive: true }));
}
