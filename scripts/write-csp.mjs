// The `postbuild` hook: puts the site's Content Security Policy (src/shared/csp/csp.ts) into every built
// page as a <meta http-equiv>, with the SHA-256 of that page's own inline scripts. GitHub Pages can't send
// headers, so this is the only way. Runs on Node 24, which strips the types from the .ts file it imports.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentSecurityPolicy } from '../src/shared/csp/csp.ts';

const root = process.argv[2] ?? 'dist/browser';
const MARKER = 'http-equiv="Content-Security-Policy"';

/** Every .html file under `dir`. */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

/** A script the browser runs: no src, and no type, or a JavaScript one. JSON data blocks don't run. */
function runs(attributes) {
  if (/\bsrc\s*=/i.test(attributes)) return false;
  const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase();
  return !type || type === 'module' || type === 'text/javascript' || type === 'application/javascript';
}

/** The `'sha256-…'` source for each inline script on the page, in order, without repeats. */
export function inlineScriptHashes(html) {
  const hashes = new Set();
  for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (runs(attributes)) hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  }
  return [...hashes];
}

/** The page with its policy as the first thing in <head> after the charset. */
export function withPolicy(html) {
  if (html.includes(MARKER)) throw new Error('already has a Content-Security-Policy meta tag');
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, ''))) {
    // An inline handler (onload="…") can't be allowed by a hash without 'unsafe-hashes': fail loudly.
    throw new Error('has an inline event handler attribute, which the policy would block');
  }
  const policy = contentSecurityPolicy(inlineScriptHashes(html));
  const tag = `<meta ${MARKER} content="${policy.replace(/"/g, '&quot;')}">`;
  const charset = /<meta charset="[^"]*">/i.exec(html);
  if (!charset) throw new Error('has no <meta charset> to put the policy after');
  const at = charset.index + charset[0].length;
  return html.slice(0, at) + tag + html.slice(at);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = htmlFiles(root);
  if (!files.length) throw new Error(`write-csp: no .html files under ${root}; build first`);
  for (const file of files) {
    try {
      writeFileSync(file, withPolicy(readFileSync(file, 'utf8')));
    } catch (error) {
      throw new Error(`write-csp: ${file} ${error.message}`);
    }
  }
  console.log(`Content-Security-Policy written into ${files.length} pages.`);
}
