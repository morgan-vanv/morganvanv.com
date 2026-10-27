// Builds the compact star and constellation data for the "Tonight's sky" background.
//
//   git clone --depth 1 https://github.com/ofrohn/d3-celestial /tmp/d3-celestial
//   node scripts/build-sky-data.mjs /tmp/d3-celestial
//
// Source: d3-celestial by Olaf Frohn (BSD-3-Clause), data derived from the Yale
// Bright Star Catalog / Hipparcos. Positions are J2000; the app precesses them
// to the current date. Output is committed; this only needs re-running to
// change the magnitude cut or the constellation list.
//
// It writes stars.json, constellations.json and names.json, nothing else:
// visitor-names.json in the same folder is hand-edited (approved visitor star
// names) and must never be regenerated, so the writes below are checked
// against that list.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/build-sky-data.mjs <path to d3-celestial checkout>');
  process.exit(1);
}

/** Faintest star drawn. ~4.5 is roughly a suburban naked-eye limit. */
const MAG_LIMIT = 4.5;

/** "Major" constellations visible from mid-northern latitudes: the zodiac plus the famous ones. */
const CONSTELLATIONS = [
  'Ari', 'Tau', 'Gem', 'Cnc', 'Leo', 'Vir', 'Lib', 'Sco', 'Sgr', 'Cap', 'Aqr', 'Psc',
  'Ori', 'UMa', 'UMi', 'Cas', 'Cep', 'Per', 'And', 'Peg', 'Cyg', 'Lyr', 'Aql', 'Boo',
  'CrB', 'Her', 'CMa', 'CMi', 'Aur', 'Dra',
];

const ra = lon => +(((lon % 360) + 360) % 360).toFixed(3);   // GeoJSON lon (-180..180) → RA degrees (0..360)
const dec = lat => +lat.toFixed(3);

const stars = JSON.parse(readFileSync(join(src, 'data/stars.6.json'), 'utf8')).features
  .filter(f => f.properties.mag <= MAG_LIMIT)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .map(f => {
    const [lon, lat] = f.geometry.coordinates;
    const bv = Number.parseFloat(f.properties.bv);
    return [ra(lon), dec(lat), +f.properties.mag.toFixed(2), Number.isFinite(bv) ? +bv.toFixed(2) : 0.6];
  });

const lines = JSON.parse(readFileSync(join(src, 'data/constellations.lines.json'), 'utf8')).features
  .filter(f => CONSTELLATIONS.includes(f.id))
  .map(f => ({ id: f.id, lines: f.geometry.coordinates.map(line => line.map(([lon, lat]) => [ra(lon), dec(lat)])) }));

/** Stars bright enough to get a hover label, if they have a traditional name. */
const NAME_MAG_LIMIT = 3;
const starNames = JSON.parse(readFileSync(join(src, 'data/starnames.json'), 'utf8'));
const names = JSON.parse(readFileSync(join(src, 'data/stars.6.json'), 'utf8')).features
  .filter(f => f.properties.mag <= NAME_MAG_LIMIT && starNames[f.id]?.name)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .map(f => {
    const [lon, lat] = f.geometry.coordinates;
    return [ra(lon), dec(lat), starNames[f.id].name, starNames[f.id].c];
  })
  // A few names are shared by two stars (Alnair); keep the brighter.
  .filter((entry, i, all) => all.findIndex(other => other[2] === entry[2]) === i);

const missing = CONSTELLATIONS.filter(id => !lines.some(l => l.id === id));
if (missing.length) throw new Error(`constellations not found: ${missing.join(', ')}`);

const out = fileURLToPath(new URL('../public/data/sky/', import.meta.url));
mkdirSync(out, { recursive: true });
const header = { source: 'd3-celestial (BSD-3-Clause, Olaf Frohn); Yale Bright Star Catalog / Hipparcos', epoch: 'J2000' };
const GENERATED = ['stars.json', 'constellations.json', 'names.json'];
const write = (file, data) => {
  if (!GENERATED.includes(file)) throw new Error(`build-sky-data only writes ${GENERATED.join(', ')}, not ${file}`);
  writeFileSync(join(out, file), data);
};
write('stars.json', JSON.stringify({ ...header, format: '[raDeg, decDeg, mag, bv]', magLimit: MAG_LIMIT, stars }));
write('constellations.json', JSON.stringify({ ...header, format: '[[raDeg, decDeg], ...] polylines', constellations: lines }));
write('names.json', JSON.stringify({ ...header, format: '[raDeg, decDeg, name, constellation]', magLimit: NAME_MAG_LIMIT, names }));
console.log(`build-sky-data: ${stars.length} stars (mag ≤ ${MAG_LIMIT}), ${lines.length} constellations, ${names.length} named stars (mag ≤ ${NAME_MAG_LIMIT})`);
