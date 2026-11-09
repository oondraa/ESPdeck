/** Drobné interakce bez závislostí: motiv, menu, hlavička, kopírování, checklist, diagram. */

const THEME_KEY = 'espdeck:theme';
const CHECK_KEY = 'espdeck:bringup:v1';

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* úložiště nedostupné (soukromé okno), stav se jen nezapamatuje */
  }
}

/* ---------- Motiv ---------- */

export function initTheme(): void {
  const btn = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
  const label = document.querySelector<HTMLElement>('[data-theme-label]');
  if (!btn) return;
  const root = document.documentElement;
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const current = (): 'light' | 'dark' => {
    const t = root.dataset.theme;
    if (t === 'light' || t === 'dark') return t;
    return mq.matches ? 'light' : 'dark';
  };
  const sync = (): void => {
    const t = current();
    btn.setAttribute('aria-pressed', String(t === 'light'));
    if (label) label.textContent = t === 'light' ? 'Světlý' : 'Tmavý';
  };
  btn.addEventListener('click', () => {
    const next = current() === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    safeSet(THEME_KEY, next);
    sync();
  });
  mq.addEventListener('change', sync);
  sync();
}

/* ---------- Hlavička a menu ---------- */

export function initHeader(): void {
  const header = document.querySelector<HTMLElement>('[data-header]');
  const btn = document.querySelector<HTMLButtonElement>('[data-menu-btn]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!header) return;

  const sentinel = document.getElementById('top');
  if (sentinel) {
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        if (e.boundingClientRect.top < -40) header.setAttribute('data-scrolled', '');
        else header.removeAttribute('data-scrolled');
      },
      { threshold: [0, 0.98, 1] },
    );
    io.observe(sentinel);
  }

  if (btn && menu) {
    const close = (focusBtn: boolean): void => {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'Menu';
      if (focusBtn) btn.focus();
    };
    btn.addEventListener('click', () => {
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Zavřít' : 'Menu';
      if (open) menu.querySelector<HTMLAnchorElement>('a')?.focus();
    });
    menu.addEventListener('click', (e) => {
      if ((e.target as Element).closest('[data-menu-link]')) close(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !menu.hidden) close(true);
    });
    window.matchMedia('(min-width: 1081px)').addEventListener('change', (e) => {
      if (e.matches) close(false);
    });
  }

  // Aktivní sekce v navigaci
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.nav a[data-section]')).filter(
    (a) => a.pathname === location.pathname,
  );
  const map = new Map<string, HTMLAnchorElement>();
  links.forEach((a) => map.set(a.hash.slice(1), a));
  const sections = Array.from(map.keys())
    .map((id) => document.getElementById(id))
    .filter((el): el is HTMLElement => el !== null);
  if (sections.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          const a = map.get(en.target.id);
          if (!a) continue;
          if (en.isIntersecting) {
            links.forEach((l) => l.removeAttribute('aria-current'));
            a.setAttribute('aria-current', 'true');
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
  }
}

/* ---------- Kopírování kódu ---------- */

export function initCopy(): void {
  document.querySelectorAll<HTMLElement>('[data-copy-root]').forEach((root) => {
    const btn = root.querySelector<HTMLButtonElement>('[data-copy]');
    const label = root.querySelector<HTMLElement>('[data-copy-label]');
    const src = root.querySelector<HTMLTextAreaElement>('[data-copy-src]');
    if (!btn || !label || !src) return;
    let timer = 0;
    const show = (state: 'ok' | 'err' | null, text: string): void => {
      if (state) btn.dataset.state = state;
      else delete btn.dataset.state;
      label.textContent = text;
    };
    btn.addEventListener('click', async () => {
      window.clearTimeout(timer);
      btn.disabled = true;
      const text = src.value;
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          ok = true;
        }
      } catch {
        ok = false;
      }
      if (!ok) {
        try {
          src.removeAttribute('aria-hidden');
          src.select();
          ok = document.execCommand('copy');
        } catch {
          ok = false;
        } finally {
          src.setAttribute('aria-hidden', 'true');
          window.getSelection()?.removeAllRanges();
        }
      }
      show(ok ? 'ok' : 'err', ok ? 'Zkopírováno' : 'Nepovedlo se, označ kód ručně');
      btn.disabled = false;
      timer = window.setTimeout(() => show(null, 'Kopírovat'), 2200);
    });
  });
}

/* ---------- Checklist oživení ---------- */

export function initChecklist(): void {
  const root = document.querySelector<HTMLElement>('[data-checklist]');
  if (!root) return;
  const boxes = Array.from(root.querySelectorAll<HTMLInputElement>('[data-check]'));
  const cells = Array.from(root.querySelectorAll<HTMLElement>('[data-cell]'));
  const done = root.querySelector<HTMLElement>('[data-done]');
  const status = root.querySelector<HTMLElement>('[data-status]');
  const reset = root.querySelector<HTMLButtonElement>('[data-reset]');
  const total = boxes.length;

  const load = (): Set<number> => {
    const raw = safeGet(CHECK_KEY);
    if (!raw) return new Set();
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < total));
    } catch {
      return new Set();
    }
  };

  const state = load();

  const render = (changed: number | null): void => {
    boxes.forEach((b) => {
      b.checked = state.has(Number(b.dataset.check));
    });
    cells.forEach((c) => {
      const i = Number(c.dataset.cell);
      c.classList.toggle('on', state.has(i));
      if (i === changed) {
        c.classList.add('pop');
        window.setTimeout(() => c.classList.remove('pop'), 180);
      }
    });
    if (done) done.textContent = String(state.size);
    if (reset) reset.disabled = state.size === 0;
  };

  boxes.forEach((b) => {
    b.addEventListener('change', () => {
      const i = Number(b.dataset.check);
      if (!Number.isInteger(i)) return;
      if (b.checked) state.add(i);
      else state.delete(i);
      safeSet(CHECK_KEY, JSON.stringify([...state].sort((x, y) => x - y)));
      render(i);
      if (status) status.textContent = `Hotovo ${state.size} z ${total} kontrol.`;
    });
  });

  reset?.addEventListener('click', () => {
    state.clear();
    safeSet(CHECK_KEY, null);
    render(null);
    if (status) status.textContent = 'Zaškrtnutí vymazáno.';
    boxes[0]?.focus();
  });

  window.addEventListener('storage', (e) => {
    if (e.key !== CHECK_KEY) return;
    const fresh = load();
    state.clear();
    fresh.forEach((n) => state.add(n));
    render(null);
  });

  render(null);
}

/* ---------- Dokumentace: aktivní kapitola v postranní navigaci ---------- */

export function initDocsNav(): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-docs-nav] a'));
  if (links.length === 0) return;
  const map = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        links.forEach((l) => l.removeAttribute('aria-current'));
        map.get(en.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-20% 0px -70% 0px' },
  );
  map.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

/* ---------- Diagram: zvýraznění trasy ---------- */

export function initWiring(): void {
  const root = document.querySelector<HTMLElement>('[data-wiring]');
  const svg = root?.querySelector<SVGSVGElement>('[data-wsvg]');
  if (!root || !svg) return;

  const wires = new Map<number, SVGGElement>();
  svg.querySelectorAll<SVGGElement>('[data-wire]').forEach((g) => wires.set(Number(g.dataset.wire), g));
  const pins = Array.from(svg.querySelectorAll<SVGGElement>('.pin[data-wires]'));
  const rows = new Map<number, HTMLTableRowElement>();
  root.querySelectorAll<HTMLTableRowElement>('[data-wire-row]').forEach((r) => rows.set(Number(r.dataset.wireRow), r));
  const groupBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-group-btn]'));

  let pinned: string | null = null;

  const parse = (s: string | undefined): number[] =>
    (s ?? '')
      .split(' ')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);

  const apply = (ns: readonly number[]): void => {
    const set = new Set(ns);
    if (set.size) svg.setAttribute('data-focus', '');
    else svg.removeAttribute('data-focus');
    wires.forEach((g, n) => g.classList.toggle('is-on', set.has(n)));
    rows.forEach((r, n) => r.classList.toggle('is-on', set.has(n)));
    pins.forEach((p) => p.classList.toggle('is-on', parse(p.dataset.wires).some((n) => set.has(n))));
  };

  const groupWires = (g: string): number[] =>
    Array.from(rows.entries())
      .filter(([, r]) => r.dataset.group === g)
      .map(([n]) => n);

  const restore = (): void => {
    if (pinned === null) {
      apply([]);
      return;
    }
    if (pinned.startsWith('g:')) apply(groupWires(pinned.slice(2)));
    else apply(parse(pinned));
  };

  pins.forEach((p) => {
    p.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') apply(parse(p.dataset.wires));
    });
    p.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') restore();
    });
    p.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = p.dataset.wires ?? '';
      pinned = pinned === key ? null : key;
      groupBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      restore();
      const first = parse(key)[0];
      if (pinned && first !== undefined && window.matchMedia('(min-width: 1101px)').matches) {
        rows.get(first)?.scrollIntoView({ block: 'nearest' });
      }
    });
  });

  svg.addEventListener('click', () => {
    if (pinned && !pinned.startsWith('g:')) {
      pinned = null;
      restore();
    }
  });

  rows.forEach((r, n) => {
    r.addEventListener('pointerenter', () => apply([n]));
    r.addEventListener('pointerleave', restore);
    r.addEventListener('focus', () => apply([n]));
    r.addEventListener('blur', restore);
    r.addEventListener('click', () => {
      pinned = pinned === String(n) ? null : String(n);
      restore();
    });
    r.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pinned = pinned === String(n) ? null : String(n);
        restore();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        rows.get(n + (e.key === 'ArrowDown' ? 1 : -1))?.focus();
      } else if (e.key === 'Escape') {
        pinned = null;
        restore();
      }
    });
  });

  groupBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const g = b.dataset.groupBtn ?? '';
      const on = b.getAttribute('aria-pressed') !== 'true';
      groupBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b && on)));
      pinned = on ? `g:${g}` : null;
      restore();
    });
    b.addEventListener('pointerenter', () => apply(groupWires(b.dataset.groupBtn ?? '')));
    b.addEventListener('pointerleave', restore);
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pinned) {
      pinned = null;
      groupBtns.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      restore();
    }
  });
}
