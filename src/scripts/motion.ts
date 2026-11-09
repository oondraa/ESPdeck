/**
 * Animace s GSAP + ScrollTrigger (+ Lenis na jemných ukazatelích).
 * Načítá se dynamicky a jen bez prefers-reduced-motion. Každá animace něco vysvětluje:
 *  - explodovaný pohled rozkládá prototyp na díly podle pozice ve čtení,
 *  - vodiče se kreslí po skupinách v pořadí zapojování (napájení, GND, I²C, enkodér, dotyk).
 * Obsah je bez animace vždy plně viditelný, skripty ho nikdy předem neskrývají v CSS.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { setExplode, type PartId } from './deck3d/bus';

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
    // Kotvy na téže stránce přes Lenis, ať se neztratí plynulost
    const onClick = (e: MouseEvent): void => {
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="#"]');
      if (!a || a.hash.length < 2 || a.pathname !== location.pathname) return;
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
    /* ---------- Explodovaný pohled ---------- */
    const inside = document.querySelector<HTMLElement>('[data-inside]');
    const steps = gsap.utils.toArray<HTMLElement>('[data-inside-step]');
    if (inside && steps.length) {
      const setStep = (el: HTMLElement | null): void => {
        steps.forEach((s) => s.toggleAttribute('data-active', s === el));
      };
      let active: PartId | null = null;
      let progress = 0;
      const push = (): void => setExplode(progress, active);
      ScrollTrigger.create({
        trigger: inside,
        start: 'top 62%',
        end: 'top 6%',
        scrub: true,
        onUpdate: (self) => {
          progress = self.progress;
          push();
        },
      });
      steps.forEach((step) => {
        ScrollTrigger.create({
          trigger: step,
          start: 'top 58%',
          end: 'bottom 42%',
          onToggle: (self) => {
            if (self.isActive) {
              active = (step.dataset.insideStep ?? null) as PartId | null;
              setStep(step);
              push();
            }
          },
        });
      });
    }

    /* ---------- Vodiče ---------- */
    const diagram = document.querySelector<HTMLElement>('.diagram-box');
    const groups = gsap.utils.toArray<SVGGElement>('[data-wire-group]');
    if (diagram && groups.length) {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: diagram, start: 'top 80%', end: 'top 25%', scrub: 0.5 },
      });
      groups.forEach((g) => {
        const paths = g.querySelectorAll<SVGPathElement>('path');
        gsap.set(paths, { strokeDashoffset: 1 });
        tl.to(paths, { strokeDashoffset: 0, duration: 1, stagger: 0.08 });
      });
    }
  });

  // Po načtení fontů se mění výšky, přepočítej spouštěče
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());

  return () => {
    ctx.revert();
    cleanups.forEach((fn) => fn());
  };
}
