/**
 * The small amount of astronomy the sky needs for stars and the Sun, kept
 * dependency-free so it can run (and be tested) without astronomy-engine.
 * The Moon and planets come from astronomy-engine in sky-bodies.ts.
 *
 * Conventions: angles in degrees unless a name says otherwise. A "horizontal
 * vector" is a unit vector [north, east, up] for the observer.
 */

export type Vec3 = readonly [number, number, number];
/** Row-major 3×3 matrix. */
export type Mat3 = readonly [Vec3, Vec3, Vec3];

const RAD = Math.PI / 180;
const J2000_JD = 2451545.0;

/** Julian Date (UT) of a JS date. */
export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2440587.5;
}

/** Normalise an angle into [0, 360). */
export function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Greenwich mean sidereal time in degrees (IAU 1982; good to well under a second of time for decades). */
export function gmstDeg(date: Date): number {
  const d = julianDate(date) - J2000_JD;
  const t = d / 36525;
  return wrap360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38_710_000);
}

/** Local mean sidereal time in degrees; longitude positive east. */
export function lstDeg(date: Date, lonDeg: number): number {
  return wrap360(gmstDeg(date) + lonDeg);
}

/** Unit vector for right ascension / declination (degrees). */
export function raDecToVector(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * RAD;
  const dec = decDeg * RAD;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

export function multiply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function multiplyMatrices(a: Mat3, b: Mat3): Mat3 {
  const row = (i: number): Vec3 => [
    a[i][0] * b[0][0] + a[i][1] * b[1][0] + a[i][2] * b[2][0],
    a[i][0] * b[0][1] + a[i][1] * b[1][1] + a[i][2] * b[2][1],
    a[i][0] * b[0][2] + a[i][1] * b[1][2] + a[i][2] * b[2][2],
  ];
  return [row(0), row(1), row(2)];
}

/**
 * Precession from J2000 to the mean equator and equinox of `date`
 * (Lieske 1977 angles). Nutation and aberration (both under 0.01°) are left out.
 */
export function precessionMatrix(date: Date): Mat3 {
  const t = (julianDate(date) - J2000_JD) / 36525;
  const arcsec = RAD / 3600;
  const zeta = (2306.2181 * t + 0.30188 * t * t + 0.017998 * t * t * t) * arcsec;
  const z = (2306.2181 * t + 1.09468 * t * t + 0.018203 * t * t * t) * arcsec;
  const theta = (2004.3109 * t - 0.42665 * t * t - 0.041833 * t * t * t) * arcsec;
  const [cz, sz, cZ, sZ, ct, st] = [Math.cos(zeta), Math.sin(zeta), Math.cos(z), Math.sin(z), Math.cos(theta), Math.sin(theta)];
  return [
    [cZ * ct * cz - sZ * sz, -cZ * ct * sz - sZ * cz, -cZ * st],
    [sZ * ct * cz + cZ * sz, -sZ * ct * sz + cZ * cz, -sZ * st],
    [st * cz, -st * sz, ct],
  ];
}

/** Equatorial (of date) → horizontal [north, east, up] for an observer at `latDeg` with local sidereal time `lstDegrees`. */
export function equatorialToHorizontalMatrix(latDeg: number, lstDegrees: number): Mat3 {
  const lst = lstDegrees * RAD;
  const lat = latDeg * RAD;
  const [cl, sl, cp, sp] = [Math.cos(lst), Math.sin(lst), Math.cos(lat), Math.sin(lat)];
  // First into the hour-angle frame (x toward the meridian, y toward the east),
  // then tilt by latitude. Derived from the standard alt/az formulas.
  const hourAngle: Mat3 = [
    [cl, sl, 0],
    [-sl, cl, 0],
    [0, 0, 1],
  ];
  const tilt: Mat3 = [
    [-sp, 0, cp],
    [0, 1, 0],
    [cp, 0, sp],
  ];
  return multiplyMatrices(tilt, hourAngle);
}

/** One matrix taking J2000 star vectors straight to the observer's horizontal frame at `date`. */
export function j2000ToHorizontalMatrix(date: Date, latDeg: number, lonDeg: number): Mat3 {
  return multiplyMatrices(equatorialToHorizontalMatrix(latDeg, lstDeg(date, lonDeg)), precessionMatrix(date));
}

/** Altitude and azimuth (degrees, azimuth from north through east) of a horizontal vector. */
export function altAz(h: Vec3): { alt: number; az: number } {
  return {
    alt: Math.asin(Math.max(-1, Math.min(1, h[2]))) / RAD,
    az: wrap360(Math.atan2(h[1], h[0]) / RAD),
  };
}

/** Horizontal vector for an altitude / azimuth in degrees. */
export function altAzToVector(altDeg: number, azDeg: number): Vec3 {
  const alt = altDeg * RAD;
  const az = azDeg * RAD;
  return [Math.cos(alt) * Math.cos(az), Math.cos(alt) * Math.sin(az), Math.sin(alt)];
}

/**
 * Stereographic projection of a horizontal vector for a viewer facing due
 * south. Conformal, so constellations keep their shapes; the horizon is a
 * straight line through the origin, east and west (on the horizon) land at
 * x = ∓2, and the zenith at y = 2. Returns null for points too close to the
 * north point to project. x grows to the right (west), y grows upward.
 */
export function projectSouth(h: Vec3): { x: number; y: number } | null {
  const denom = 1 - h[0];
  if (denom < 1e-6) return null;
  return { x: (-2 * h[1]) / denom, y: (2 * h[2]) / denom };
}

/**
 * Low-precision Sun position (Astronomical Almanac; about 0.01° from 1950 to
 * 2050), as right ascension / declination of date in degrees.
 */
export function sunRaDec(date: Date): { ra: number; dec: number } {
  const n = julianDate(date) - J2000_JD;
  const meanLongitude = wrap360(280.46 + 0.9856474 * n);
  const meanAnomaly = wrap360(357.528 + 0.9856003 * n) * RAD;
  const lambda = (meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const epsilon = (23.439 - 0.0000004 * n) * RAD;
  return {
    ra: wrap360(Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda)) / RAD),
    dec: Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / RAD,
  };
}

/** The Sun as a horizontal vector for the observer (no refraction). */
export function sunHorizontal(date: Date, latDeg: number, lonDeg: number): Vec3 {
  const { ra, dec } = sunRaDec(date);
  return multiply(equatorialToHorizontalMatrix(latDeg, lstDeg(date, lonDeg)), raDecToVector(ra, dec));
}
