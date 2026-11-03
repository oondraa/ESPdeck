/** Spojí BASE_URL (např. "/" nebo "/ESPdeck") s relativní cestou bez zdvojených lomítek. */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  const clean = path.replace(/^\/+/, '');
  return `${base}/${clean}`;
}
