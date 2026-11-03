/**
 * Animace s GSAP + ScrollTrigger (+ Lenis na jemných ukazatelích).
 * Načítá se dynamicky a jen bez prefers-reduced-motion.
 * Každá animace něco vysvětluje:
 *  - měděná stopa vlevo = pozice v dokumentaci,
 *  - vodiče se kreslí po skupinách v pořadí, v jakém se zapojují (napájení → GND → I²C → enkodér → dotyk),
 *  - řádky tabulek se odkrývají v pořadí čtení.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function initMotion(): () => void {
  const cleanups: Array<() => void> = [];

  /* ---------- Lenis ---------- */
  if (window.matchMedia('(pointer: fine)').matches) {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number): void => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Kotvy v navigaci přes Lenis, ať se neztratí plynulost
    const onClick = (e: MouseEvent): void => {
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a || a.hash.length < 2) return;
      const el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: -72 });
      history.pushState(null, '', a.hash);
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    };
    document.addEventListener('click', onClick);
    cleanups.push(() => {
      document.removeEventListener('click', onClick);
      gsap.ticker.remove(tick);
      lenis.destroy();
    });
  }

  const ctx = gsap.context(() => {
    /* ---------- Měděná stopa ---------- */
    const trace = document.querySelector<HTMLElement>('[data-trace]');
    if (trace) {
      gsap.to(trace, {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
      });
    }

    /* ---------- Vodiče ---------- */
    const diagram = document.querySelector<HTMLElement>('.diagram-scroll');
    const groups = gsap.utils.toArray<SVGGElement>('[data-wire-group]');
    if (diagram && groups.length) {
      const legend = new Map<string, HTMLElement>();
      document.querySelectorAll<HTMLElement>('[data-group-btn]').forEach((b) => {
        legend.set(b.dataset.groupBtn ?? '', b);
      });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: diagram,
          start: 'top 78%',
          end: 'bottom 55%',
          scrub: 0.6,
        },
      });
      groups.forEach((g) => {
        const name = g.dataset.wireGroup ?? '';
        const paths = g.querySelectorAll<SVGPathElement>('path');
        const labels = g.querySelectorAll<SVGTextElement>('text');
        gsap.set(paths, { strokeDashoffset: 1 });
        gsap.set(labels, { opacity: 0 });
        const btn = legend.get(name);
        tl.to(paths, {
          strokeDashoffset: 0,
          duration: 1,
          stagger: 0.08,
          onStart: () => btn?.setAttribute('data-drawing', ''),
          onComplete: () => btn?.removeAttribute('data-drawing'),
          onReverseComplete: () => btn?.removeAttribute('data-drawing'),
        });
        tl.to(labels, { opacity: 1, duration: 0.25 }, '<0.6');
      });
    }

    /* ---------- Tabulky ---------- */
    gsap.utils.toArray<HTMLElement>('[data-reveal-table]').forEach((wrap) => {
      const rows = wrap.querySelectorAll('tbody tr, tfoot tr');
      if (!rows.length) return;
      gsap.from(rows, {
        opacity: 0,
        y: 10,
        duration: 0.45,
        ease: 'power2.out',
        stagger: 0.035,
        scrollTrigger: { trigger: wrap, start: 'top 85%', once: true },
      });
    });
  });

  // Po načtení fontů se mění výšky, přepočítej spouštěče
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    ctx.revert();
    cleanups.forEach((fn) => fn());
  };
}
