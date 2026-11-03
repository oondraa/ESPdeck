import type { APIRoute } from 'astro';
import { withBase } from '../lib/url';

// Web má jedinou stránku; při přidání dalších je doplň do PAGES.
const PAGES = [''];

export const GET: APIRoute = ({ site }) => {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = PAGES.map(
    (p) =>
      `  <url>\n    <loc>${new URL(withBase(p), site).href}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`,
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
