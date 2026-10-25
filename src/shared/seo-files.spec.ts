import { readFileSync } from 'node:fs';
import { MAIN_ROUTES } from './main-routes';
import { SITE_CONFIG } from './config/site.config';

/** The static SEO files in public/ must stay in step with the routes and config. */
describe('public SEO files', () => {
  it('sitemap.xml lists the greeting and every main route', () => {
    const sitemap = readFileSync('public/sitemap.xml', 'utf8');
    expect(sitemap).toContain(`<loc>${SITE_CONFIG.url}/</loc>`);
    for (const { path } of MAIN_ROUTES) {
      expect(sitemap).toContain(`<loc>${SITE_CONFIG.url}/${path}/</loc>`);
    }
    expect(sitemap.match(/<loc>/g)?.length).toBe(MAIN_ROUTES.length + 1);
  });

  it('robots.txt points at the sitemap', () => {
    expect(readFileSync('public/robots.txt', 'utf8')).toContain(`Sitemap: ${SITE_CONFIG.url}/sitemap.xml`);
  });

  it('index.html carries the default description and Open Graph image', () => {
    const html = readFileSync('src/index.html', 'utf8');
    expect(html).toContain(`content="${SITE_CONFIG.defaultDescription}"`);
    expect(html).toContain(`${SITE_CONFIG.url}/og-image.jpg`);
    expect(html).toContain('rel="manifest"');
  });
});
