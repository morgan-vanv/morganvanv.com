import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_CONFIG } from '../config/site.config';
import { CONNECT_ORIGINS, contentSecurityPolicy } from './csp';

/** Every https origin a service in src/shared/services calls (their `BASE_URL`s). */
function serviceOrigins(): string[] {
  const dir = join(process.cwd(), 'src/shared/services');
  return readdirSync(dir)
    .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .flatMap(name => [...readFileSync(join(dir, name), 'utf8').matchAll(/const BASE_URL = '(https:\/\/[^']+)'/g)].map(m => new URL(m[1]).origin));
}

describe('the Content Security Policy', () => {
  it('lets the site reach every API it calls', () => {
    const urls: string[] = [SITE_CONFIG.campfireUrl, SITE_CONFIG.askMorganSubmitUrl, SITE_CONFIG.weatherApiUrl];
    const origins = urls
      .filter(url => url !== '')
      .map(url => new URL(url).origin);
    const fromServices = serviceOrigins();
    expect(fromServices.length).toBeGreaterThanOrEqual(4);
    for (const origin of [...origins, ...fromServices]) expect(CONNECT_ORIGINS).toContain(origin);
  });

  it('runs only our own scripts and the inline ones it was given hashes for', () => {
    const policy = contentSecurityPolicy(["'sha256-abc='"]);
    const scripts = policy.split('; ').find(directive => directive.startsWith('script-src '));
    expect(scripts).toBe("script-src 'self' 'wasm-unsafe-eval' 'sha256-abc='");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("default-src 'self'");
  });
});
