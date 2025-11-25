// astronomy.js - Astronomical calculations
import { calculateObliquity } from './epsilon.js';
import * as ephemeris from 'ephemeris';
import { DateTime } from 'luxon';

export class AstronomyCalculator {
  constructor() {
    this.J2000_EPOCH = 2451545.0;
    // nominal mean obliquity (radians) fallback — we still call calculateObliquity(JD) when needed
    this.OBLIQUITY = 23.44 * Math.PI / 180;

    // Keplerian orbital elements at J2000.0 epoch (Jan 1, 2000, 12:00 TT)
    // Based on NASA JPL approximations for 1800-2050
    // Format: { a: semi-major axis (AU), e: eccentricity, I: inclination (deg),
    //          L: mean longitude (deg), pomega: longitude of perihelion (deg),
    //          Omega: longitude of ascending node (deg) }
    this.orbitalElements = {
      mercury: { a: 0.38709927, e: 0.20563593, I: 7.00497902, L: 252.25032350, pomega: 77.45779628, Omega: 48.33076593 },
      venus:   { a: 0.72333566, e: 0.00677672, I: 3.39467605, L: 181.97909950, pomega: 131.60246718, Omega: 76.67984255 },
      earth:   { a: 1.00000261, e: 0.01671123, I: -0.00001531, L: 100.46457166, pomega: 102.93768193, Omega: 0.0 },
      mars:    { a: 1.52371034, e: 0.09339410, I: 1.84969142, L: -4.55343205, pomega: -23.94362959, Omega: 49.55953891 },
      jupiter: { a: 5.20288700, e: 0.04838624, I: 1.30439695, L: 34.39644051, pomega: 14.72847983, Omega: 100.47390909 },
      saturn:  { a: 9.53667594, e: 0.05386179, I: 2.48599187, L: 49.95424423, pomega: 92.59887831, Omega: 113.66242448 },
      uranus:  { a: 19.18916464, e: 0.04725744, I: 0.77263783, L: 313.23810451, pomega: 170.95427630, Omega: 74.01692503 },
      neptune: { a: 30.06992276, e: 0.00859048, I: 1.77004347, L: -55.12002969, pomega: 44.96476227, Omega: 131.78422574 },
      pluto:   { a: 39.48211675, e: 0.24882730, I: 17.14001206, L: 238.92903833, pomega: 224.06891629, Omega: 110.30393684 }
    };
  }

  // -----------------------
  // Helpers
  // -----------------------
  _deg(normDeg) {
    // normalise to [0,360)
    let d = normDeg % 360;
    if (d < 0) d += 360;
    return d;
  }

  _radToDeg(r) {
    return r * 180 / Math.PI;
  }

  _degToRad(d) {
    return d * Math.PI / 180;
  }

  /**
   * Calculate Local Sidereal Time
   * currentDay: day-of-year (1..365/366)
   * currentTime: minutes since 00:00 UTC (UI provides UTC time)
   * currentLongitude: degrees (east positive; negative for west)
   * currentYear: full year number (e.g. 2025 or 1979)
   *
   * Returns { LST: degrees (0..360), julianDate }
   */
  equatorialToEcliptic(raRad, decRad, obliquityRad) {
    const sinLon = Math.sin(raRad) * Math.cos(obliquityRad) + Math.tan(decRad) * Math.sin(obliquityRad);
    const cosLon = Math.cos(raRad);
    const lon = Math.atan2(sinLon, cosLon);

    const sinLat = Math.sin(decRad) * Math.cos(obliquityRad) - Math.cos(decRad) * Math.sin(obliquityRad) * Math.sin(raRad);
    const lat = Math.asin(sinLat);

    return { lon, lat };
  }

  calculateAyanamsha(year) {
    // Aldebaran J2000 coordinates: RA 4.599h, Dec 16.51°
    const ra = this._degToRad(4.599 * 15);
    const dec = this._degToRad(16.51);
    const oblJ2000 = this._degToRad(23.43929);

    // J2000 Ecliptic Longitude of Aldebaran
    const { lon } = this.equatorialToEcliptic(ra, dec, oblJ2000);

    // Precession: approx 50.29 arcsec/year
    const yearsSince2000 = year - 2000;
    const precession = this._degToRad(yearsSince2000 * (50.29 / 3600));

    // Current Tropical Longitude
    const currentLon = lon + precession;

    // Fagan-Bradley: Aldebaran at 15° Taurus (45°)
    const targetSiderealLon = this._degToRad(45);

    // Ayanamsha = Tropical - Sidereal
    return currentLon - targetSiderealLon;
  }

  calculateLST(currentDay, currentTime, currentLongitude, currentYear) {
    // Build a UTC Date from day-of-year + minutes:
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const { month, day } = this.dayOfYearToMonthDay(currentDay, isLeap);

    const hours = Math.floor(currentTime / 60);
    const minutes = Math.floor(currentTime % 60);

    // currentTime is already in UTC (provided by UI), so use it directly
    const dateUTC = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0, 0));

    // Convert JS time to Julian Date
    // JD = Unix epoch (ms) / 86400000 + 2440587.5
    const julianDate = dateUTC.getTime() / 86400000 + 2440587.5;

    // Use standard approximate formula for GMST (in degrees)
    // See: GMST ≈ 280.46061837 + 360.98564736629 * (JD - 2451545.0) + 0.000387933*T^2 - (T^3)/38710000
    const T = (julianDate - this.J2000_EPOCH) / 36525.0;
    const GMST = 280.46061837 +
                 360.98564736629 * (julianDate - this.J2000_EPOCH) +
                 0.000387933 * T * T -
                 (T * T * T) / 38710000.0;

    const GMST_norm = this._deg(GMST);

    // Local Sidereal Time (degrees) = GMST + longitude (east positive)
    // NOTE: we assume currentLongitude is degrees east (negative for west)
    let LST = GMST_norm + currentLongitude;
    LST = this._deg(LST);

    // debugLog.log('JD:', julianDate, 'GMST at 0h (deg):', GMST_norm, 'Hours UT:', currentTime / 60, 'LST (deg):', LST);

    return { LST, julianDate };
  }

  /**
   * Get precise obliquity for a given Julian Date (returns radians)
   */
  getObliquity(julianDate) {
    try {
      const eps = calculateObliquity(julianDate);
      if (typeof eps === 'number' && !Number.isNaN(eps)) return eps;
    } catch (e) {
      debugLog.warn('calculateObliquity failed, using nominal OBLIQUITY', e);
    }
    return this.OBLIQUITY;
  }

  /**
   * Calculate Midheaven (MC)
   * Inputs:
   *   lstRad: local sidereal time in RADIANS
   *   obliquity: obliquity in RADIANS
   * Returns MC in DEGREES (0..360)
   *
   * Formula used:
   *   MC = atan2( sin(LST), cos(LST) * cos(epsilon) )  (radians) --> convert to degrees
   */
  calculateMC(lstRad, obliquity) {
    const x = Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(obliquity));
    let MCdeg = this._radToDeg(x);
    MCdeg = this._deg(MCdeg);
    return MCdeg;
  }

  /**
   * Calculate Ascendant (AC) and Descendant (DSC)
   * Inputs:
   *   lstRad: local sidereal time in RADIANS
   *   latRad: observer latitude in RADIANS
   *   obliquity: obliquity in RADIANS
   *
   * Returns { AC, DSC } in DEGREES (0..360)
   *
   * Uses commonly used formula for ecliptic ascendant (works for typical latitudes; polar edge cases should be handled by caller)
   */
  calculateAscendant(lstRad, latRad, obliquity) {
    // The formula below computes the ecliptic longitude rising on the eastern horizon.
    // Following the convention: AC = atan2( sin(L), cos(L)*cos(eps) - tan(lat)*sin(eps) )
    // but different algebraic rearrangements exist. We use a stable form with atan2.
    const sinL = Math.sin(lstRad);
    const cosL = Math.cos(lstRad);
    const sinE = Math.sin(obliquity);
    const cosE = Math.cos(obliquity);
    const tanLat = Math.tan(latRad);

    // Compute ASC as ecliptic longitude (radians)
    const numerator = -cosL;
    const denominator = sinL * cosE + tanLat * sinE;
    let ascRad = Math.atan2(numerator, denominator);

    // Convert to degrees and normalise
    let DSCdeg = this._radToDeg(ascRad);
    DSCdeg = this._deg(DSCdeg); // this is the ecliptic longitude of the descendant in this algebraic variant
    // Ascendant is opposite point:
    let ACdeg = (DSCdeg + 180) % 360;

    return { AC: ACdeg, DSC: DSCdeg };
  }

  /**
   * Calculate Vertex (VTX) and Anti-Vertex (AVX)
   * The Vertex is the intersection of the ecliptic and the Prime Vertical (east-west great circle through zenith)
   * Inputs:
   *   lstRad: local sidereal time in RADIANS
   *   latRad: observer latitude in RADIANS
   *   obliquity: obliquity in RADIANS
   *
   * Returns { VTX, AVX } in DEGREES (0..360)
   *
   * The Vertex is traditionally the western intersection point (setting on the Prime Vertical)
   * The Anti-Vertex is the opposite point (eastern intersection, rising on the Prime Vertical)
   */
  calculateVertex(lstRad, latRad, obliquity) {
    // Vertex is the intersection of the Prime Vertical and the Ecliptic in the West.
    // It is calculated as the Ascendant for a location with latitude = (90 - observer_latitude)
    // and sidereal time = (LST + 180 degrees).

    const lstRadPrime = lstRad + Math.PI;

    // tan(90 - lat) = cot(lat) = 1/tan(lat)
    // JS handles 1/0 as Infinity, which works correctly in atan2
    const tanCoLat = 1.0 / Math.tan(latRad);

    const sinL = Math.sin(lstRadPrime);
    const cosL = Math.cos(lstRadPrime);
    const sinE = Math.sin(obliquity);
    const cosE = Math.cos(obliquity);

    // Using the Ascendant formula: atan2(-cosL, sinL*cosE + tanLat*sinE)
    // but with transformed coordinates
    const numerator = -cosL;
    const denominator = sinL * cosE + tanCoLat * sinE;

    let avtxRad = Math.atan2(numerator, denominator);
    let AVXdeg = this._radToDeg(avtxRad);
    AVXdeg = this._deg(AVXdeg);

    // Anti-Vertex is opposite
    let VTXdeg = (AVXdeg + 180) % 360;

    return { VTX: VTXdeg, AVX: AVXdeg };
  }

  /**
   * Calculate Sun's ecliptic longitude (radians) using ephemeris npm package
   * The function returns longitude in RADIANS (0..2π)
   *
   * @param {number} julianDate - Julian Date for the calculation
   */
  calculateSunPosition(julianDate, longitude = 0) {
    try {
      // Convert Julian Date to JavaScript Date for ephemeris library
      const date = new Date((julianDate - 2440587.5) * 86400000);

      // ephemeris.getAllPlanets(date, lat, lon) -> results vary by package version.
      // We try to read an apparent longitude in degrees, falling back gracefully.
      const result = ephemeris.getAllPlanets(date, 0, 0);

      // Try a couple of reasonable property names that ephemeris packages sometimes use:
      const sunObj = result && result.observed && result.observed.sun ? result.observed.sun : (result && result.sun ? result.sun : null);

      if (sunObj) {
        // many ephemeris libs provide apparentLongitudeDd or longitude or lon
        const maybeLon = sunObj.apparentLongitudeDd ?? sunObj.longitude ?? sunObj.lon ?? sunObj.lambda;
        if (typeof maybeLon === 'number' && !Number.isNaN(maybeLon)) {
          let lonDeg = maybeLon;
          // normalise
          lonDeg = this._deg(lonDeg);
          return this._degToRad(lonDeg);
        }
      }
    } catch (e) {
      debugLog.warn('Ephemeris call failed:', e);
    }

    // Fallback: simple mean-sun approximation based on Julian Date
    // Days since J2000.0 epoch
    const daysSinceJ2000 = julianDate - this.J2000_EPOCH;
    const approxLon = (280 + daysSinceJ2000 * (360 / 365.2425)) % 360;
    debugLog.warn('Using approximate Sun position (deg):', approxLon);
    return this._degToRad(approxLon);
  }

  /**
   * Calculate Moon's ecliptic position (longitude and latitude in radians) using ephemeris npm package
   * Returns { longitude: radians (0..2π), latitude: radians }
   *
   * @param {number} julianDate - Julian Date for the calculation
   */
  calculateMoonPosition(julianDate, longitude = 0) {
    try {
      // Convert Julian Date to JavaScript Date for ephemeris library
      const date = new Date((julianDate - 2440587.5) * 86400000);

      // ephemeris.getAllPlanets(date, lat, lon) -> results vary by package version.
      const result = ephemeris.getAllPlanets(date, 0, 0);

      // Try to read Moon's longitude
      const moonObj = result && result.observed && result.observed.moon ? result.observed.moon : (result && result.moon ? result.moon : null);

      if (moonObj) {
        const maybeLon = moonObj.apparentLongitudeDd ?? moonObj.longitude ?? moonObj.lon ?? moonObj.lambda;

        if (typeof maybeLon === 'number' && !Number.isNaN(maybeLon)) {
          let lonDeg = maybeLon;
          lonDeg = this._deg(lonDeg);

          // Calculate ecliptic latitude using orbital mechanics
          // The moon's orbit is inclined ~5.14° to the ecliptic
          // β ≈ i × sin(λ_moon - Ω) where i is inclination and Ω is ascending node
          const nodes = this.calculateLunarNodes(julianDate);
          const ascendingNodeDeg = nodes.ascending;

          const MOON_INCLINATION = 5.145; // degrees, mean inclination to ecliptic
          const latDeg = MOON_INCLINATION * Math.sin(this._degToRad(lonDeg - ascendingNodeDeg));
          const latRad = this._degToRad(latDeg);

          return {
            longitude: this._degToRad(lonDeg),
            latitude: latRad
          };
        }
      }
    } catch (e) {
      debugLog.warn('Moon ephemeris call failed:', e);
    }

    // Fallback: simple approximation - Moon moves ~13.176° per day
    const approxLon = (currentDay * 13.176) % 360;
    debugLog.warn('Using approximate Moon position (deg):', approxLon);
    return {
      longitude: this._degToRad(approxLon),
      latitude: 0
    };
  }

  /**
   * Calculate lunar argument of perigee (ω)
   * Returns the angle from ascending node to perigee direction
   * This is needed to orient the lunar orbit ellipse correctly
   *
   * @param {number} julianDate - Julian Date for the calculation
   * @param {Object} moonPosition - Optional moon position to derive perigee from
   * @returns {number} Argument of perigee in degrees (0..360)
   */
  calculateLunarArgumentOfPerigee(julianDate, moonPosition = null) {
    // Using Meeus formula for mean argument of perigee
    // T = centuries from J2000.0
    const T = (julianDate - this.J2000_EPOCH) / 36525.0;

    // Mean argument of perigee (ω) formula from Jean Meeus
    // ω = 318.0634 + 6003.1498 * T - 0.0128 * T^2
    let omega = 318.0634 + 6003.1498 * T - 0.0128 * T * T;

    // Normalize to [0, 360)
    return this._deg(omega);
  }

  /**
   * Calculate lunar nodes (ascending ☊ and descending ☋)
   * Uses TRUE node (instantaneous position with perturbations)
   * The ascending node is where the Moon crosses the ecliptic going north
   * The descending node is 180° opposite
   * Returns { ascending: degrees (0..360), descending: degrees (0..360) }
   *
   * @param {number} julianDate - Julian Date for the calculation
   */
  calculateLunarNodes(julianDate) {
    try {
      // Try to get from ephemeris library first
      const date = new Date((julianDate - 2440587.5) * 86400000);
      const result = ephemeris.getAllPlanets(date, 0, 0);
      const moonObj = result && result.observed && result.observed.moon ? result.observed.moon : (result && result.moon ? result.moon : null);

      if (moonObj && moonObj.node) {
        // Some ephemeris libraries provide the node longitude directly
        let nodeDeg = typeof moonObj.node === 'number' ? moonObj.node : moonObj.node.longitude;
        if (typeof nodeDeg === 'number' && !Number.isNaN(nodeDeg)) {
          nodeDeg = this._deg(nodeDeg);
          return {
            ascending: nodeDeg,
            descending: this._deg(nodeDeg + 180)
          };
        }
      }
    } catch (e) {
      // Fall through to calculation
    }

    // Calculate TRUE node (with perturbations)
    // julianDate is already provided as parameter
    const T = (julianDate - this.J2000_EPOCH) / 36525.0; // Julian centuries since J2000
    const D = (julianDate - this.J2000_EPOCH); // Days since J2000

    // Mean ascending node: Ω_mean
    let meanNode = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;

    // Calculate perturbation terms for TRUE node
    // These account for the Sun's gravitational influence on the Moon's orbit

    // Mean anomaly of the Sun
    const M_sun = 357.5291092 + 0.98560028 * D;

    // Mean anomaly of the Moon
    const M_moon = 134.9633964 + 13.06499295 * D;

    // Mean argument of latitude of the Moon (F = L - Ω)
    const F = 93.2720950 + 13.22935024 * D;

    // Mean longitude of Moon
    const L = 218.3164477 + 13.17639648 * D;

    // Calculate perturbations (main terms)
    // True node = Mean node + perturbations
    const perturbation =
      - 1.4979 * Math.sin(this._degToRad(2 * (L - F)))
      - 0.1500 * Math.sin(this._degToRad(M_sun))
      - 0.1226 * Math.sin(this._degToRad(2 * L))
      + 0.1176 * Math.sin(this._degToRad(2 * F))
      - 0.0801 * Math.sin(this._degToRad(2 * (F + M_moon)));

    let trueNode = meanNode + perturbation;
    trueNode = this._deg(trueNode);

    return {
      ascending: trueNode,
      descending: this._deg(trueNode + 180)
    };
  }

  /**
   * Calculate planetary nodes (ascending ☊ and descending ☋)
   * The nodes are where each planet's orbital plane crosses the ecliptic plane
   * Returns object with node longitudes for each planet in degrees (0..360)
   *
   * Format: { planetName: { ascending: degrees, descending: degrees } }
   *
   * @param {number} julianDate - Julian Date for the calculation (used for precession)
   */
  calculatePlanetaryNodes(julianDate) {
    const nodes = {};

    // For each planet, the ascending node longitude (Ω) is where the orbit
    // crosses the ecliptic going northward (increasing latitude)
    // The descending node is 180° opposite

    // Note: Omega values are at J2000.0 epoch; for high precision over long time spans,
    // we would apply secular variations. For now, using J2000.0 values.

    Object.entries(this.orbitalElements).forEach(([planetName, elements]) => {
      // Skip Earth (it defines the ecliptic plane, so nodes are undefined)
      if (planetName === 'earth') {
        return;
      }

      const Omega = elements.Omega; // Longitude of ascending node at J2000.0

      nodes[planetName] = {
        ascending: this._deg(Omega),
        descending: this._deg(Omega + 180)
      };
    });

    return nodes;
  }

  /**
   * Calculate planetary apsides (perihelion ⊙ and aphelion ⊚)
   * Perihelion is the closest point to the Sun, aphelion is the farthest
   * Returns object with apsis longitudes for each planet in degrees (0..360)
   *
   * Format: { planetName: { perihelion: degrees, aphelion: degrees, perihelionDistance: AU, aphelionDistance: AU } }
   *
   * @param {number} julianDate - Julian Date for the calculation (used for precession)
   */
  calculatePlanetaryApsides(julianDate) {
    const apsides = {};

    // For each planet, the longitude of perihelion (ϖ) = ω + Ω
    // where ω is the argument of perihelion and Ω is the longitude of ascending node
    // Aphelion is 180° opposite

    Object.entries(this.orbitalElements).forEach(([planetName, elements]) => {
      const a = elements.a;      // Semi-major axis in AU
      const e = elements.e;      // Eccentricity
      const pomega = elements.pomega; // Longitude of perihelion (ω + Ω) at J2000.0

      // Calculate perihelion and aphelion distances
      const perihelionDist = a * (1 - e); // Closest distance to Sun
      const aphelionDist = a * (1 + e);   // Farthest distance from Sun

      apsides[planetName] = {
        perihelion: this._deg(pomega),
        aphelion: this._deg(pomega + 180),
        perihelionDistance: perihelionDist,
        aphelionDistance: aphelionDist
      };
    });

    return apsides;
  }

  /**
   * Get Earth's heliocentric position derived from Sun's geocentric position
   * Returns { longitude: radians, distance: AU }
   *
   * @param {number} julianDate - Julian Date for the calculation
   */
  getEarthHeliocentricPosition(julianDate) {
    // Calculate Sun's geocentric position
    const sunLonRad = this.calculateSunPosition(julianDate);

    // Earth is opposite to Sun
    const earthLonRad = (sunLonRad + Math.PI) % (2 * Math.PI);

    // Distance is effectively 1 AU (simplified, or could use ephemeris distance if available)
    // Earth's ecliptic latitude is 0 by definition (Earth defines the ecliptic plane)
    return {
      longitude: earthLonRad,
      latitude: 0,
      distance: 1.0
    };
  }

  /**
   * Solve Kepler's equation: M = E - e*sin(E)
   * Uses Newton-Raphson iteration to find eccentric anomaly E
   * M: mean anomaly (radians)
   * e: eccentricity
   * Returns: eccentric anomaly E (radians)
   */
  solveKeplerEquation(M, e, tolerance = 1e-8, maxIterations = 30) {
    // Initial guess
    let E = M;

    for (let i = 0; i < maxIterations; i++) {
      const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;

      if (Math.abs(dE) < tolerance) {
        return E;
      }
    }

    return E; // Return best guess if not converged
  }

  /**
   * Calculate heliocentric position from Keplerian orbital elements
   * planetName: 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
   * Returns { longitude: radians, latitude: radians, distance: AU }
   */
  calculateHeliocentricFromKeplerian(planetName, julianDate) {
    const elements = this.orbitalElements[planetName];
    if (!elements) {
      return null;
    }

    // Calculate time from J2000 epoch in centuries
    const T = (julianDate - this.J2000_EPOCH) / 36525.0;

    // For first-order approximation, we assume elements are constant
    // (More accurate would include rates of change, but this is sufficient)
    const a = elements.a;
    const e = elements.e;
    const I = this._degToRad(elements.I);
    const L = this._degToRad(elements.L);
    const pomega = this._degToRad(elements.pomega); // longitude of perihelion
    const Omega = this._degToRad(elements.Omega); // longitude of ascending node

    // Calculate argument of perihelion (ω) and mean longitude at date
    const omega = pomega - Omega; // argument of perihelion

    // Mean anomaly: M = L - pomega
    // We need to account for time progression: mean longitude increases over time
    // Mean motion n (rad/day) = sqrt(GM_sun/a^3), but for our units:
    // n (deg/century) ≈ 360 * 36525 / period, where period depends on a^3
    // Simplified: use mean longitude at epoch and adjust by approximate rate
    const n = this._degToRad(360.0 / 365.25) / Math.pow(a, 1.5); // Mean motion in radians/day
    const daysSinceEpoch = (julianDate - this.J2000_EPOCH);
    const L_current = L + n * daysSinceEpoch;

    let M = L_current - pomega;

    // Normalize mean anomaly to [0, 2π]
    M = M % (2 * Math.PI);
    if (M < 0) M += 2 * Math.PI;

    // Solve Kepler's equation for eccentric anomaly
    const E = this.solveKeplerEquation(M, e);

    // Calculate true anomaly (ν) from eccentric anomaly
    const nu = 2 * Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    );

    // Calculate heliocentric distance
    const r = a * (1 - e * Math.cos(E));

    // Position in orbital plane (perihelion at x-axis)
    const xOrb = r * Math.cos(nu);
    const yOrb = r * Math.sin(nu);
    const zOrb = 0;

    // Transform to ecliptic coordinates:
    // 1. Rotate by argument of perihelion (ω) around z-axis
    // 2. Rotate by inclination (I) around x-axis
    // 3. Rotate by longitude of ascending node (Ω) around z-axis

    // Step 1: Rotate by ω
    const cosω = Math.cos(omega);
    const sinω = Math.sin(omega);
    const x1 = xOrb * cosω - yOrb * sinω;
    const y1 = xOrb * sinω + yOrb * cosω;
    const z1 = zOrb;

    // Step 2: Rotate by I
    const cosI = Math.cos(I);
    const sinI = Math.sin(I);
    const x2 = x1;
    const y2 = y1 * cosI - z1 * sinI;
    const z2 = y1 * sinI + z1 * cosI;

    // Step 3: Rotate by Ω
    const cosΩ = Math.cos(Omega);
    const sinΩ = Math.sin(Omega);
    const x3 = x2 * cosΩ - y2 * sinΩ;
    const y3 = x2 * sinΩ + y2 * cosΩ;
    const z3 = z2;

    // Convert Cartesian to ecliptic longitude and latitude
    const longitude = Math.atan2(y3, x3);
    const latitude = Math.atan2(z3, Math.sqrt(x3 * x3 + y3 * y3));
    const distance = r;

    return {
      longitude: (longitude + 2 * Math.PI) % (2 * Math.PI), // Normalize to [0, 2π]
      latitude: latitude,
      distance: distance
    };
  }

  /**
   * Calculate planet's position using ephemeris npm package
   * planetName: 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
   * Returns {
   *   geocentricLongitude: radians (0..2π) - for zodiac display
   *   heliocentricLongitude: radians (0..2π) - for 3D positioning
   *   heliocentricLatitude: radians - for 3D positioning
   *   heliocentricDistance: AU - distance from Sun
   * }
   */
  calculatePlanetPosition(planetName, julianDate) {
    debugLog.log(`calculatePlanetPosition called for ${planetName}`);

    // Convert Julian Date to JavaScript Date for ephemeris library
    const date = new Date((julianDate - 2440587.5) * 86400000);

    // Calculate heliocentric position from Keplerian elements
    const keplerianHelio = this.calculateHeliocentricFromKeplerian(planetName, julianDate);
    debugLog.log(`  Keplerian heliocentric for ${planetName}:`, keplerianHelio);

    try {
      debugLog.log(`  Date: ${date.toISOString()}`);
      const result = ephemeris.getAllPlanets(date, 0, 0);
      debugLog.log(`  Ephemeris result keys:`, result ? Object.keys(result) : 'null');

      // Get geocentric data (observed from Earth) for zodiac longitude
      const geocentricObj = result && result.observed && result.observed[planetName]
        ? result.observed[planetName]
        : (result && result[planetName] ? result[planetName] : null);

      debugLog.log(`  Geocentric object for ${planetName}:`, geocentricObj ? Object.keys(geocentricObj) : 'null');

      if (geocentricObj) {
        const geocentricLon = geocentricObj.apparentLongitudeDd ?? geocentricObj.longitude ?? geocentricObj.lon ?? geocentricObj.lambda;
        const geocentricLat = geocentricObj.apparentLatitudeDd ?? geocentricObj.latitude ?? geocentricObj.lat ?? geocentricObj.beta;

        debugLog.log(`  Geocentric longitude value:`, geocentricLon);
        debugLog.log(`  Geocentric latitude value:`, geocentricLat);

        if (typeof geocentricLon === 'number' && !Number.isNaN(geocentricLon)) {
          let geocentricLonDeg = this._deg(geocentricLon);
          debugLog.log(`  Normalized geocentric longitude (deg):`, geocentricLonDeg);

          // Use Keplerian heliocentric position for accurate prograde motion
          return {
            geocentricLongitude: this._degToRad(geocentricLonDeg),
            geocentricLatitude: (typeof geocentricLat === 'number' && !Number.isNaN(geocentricLat))
              ? this._degToRad(geocentricLat)
              : 0,
            heliocentricLongitude: keplerianHelio ? keplerianHelio.longitude : null,
            heliocentricLatitude: keplerianHelio ? keplerianHelio.latitude : 0,
            heliocentricDistance: keplerianHelio ? keplerianHelio.distance : null
          };
        }
      }
    } catch (e) {
      debugLog.warn(`${planetName} ephemeris call failed:`, e);
    }

    // Fallback - still use Keplerian for heliocentric if we have it
    debugLog.warn(`Using fallback position for ${planetName}`);
    return {
      geocentricLongitude: 0,
      geocentricLatitude: 0,
      heliocentricLongitude: keplerianHelio ? keplerianHelio.longitude : null,
      heliocentricLatitude: keplerianHelio ? keplerianHelio.latitude : 0,
      heliocentricDistance: keplerianHelio ? keplerianHelio.distance : null
    };
  }

  /**
   * NOTE: calculatePlanetOrbit was removed because the geocentric-to-heliocentric conversion
   * approach doesn't work for generating orbit paths. Sampling at different times while adding
   * Earth's moving position creates spirograph patterns instead of clean ellipses.
   *
   * Planet orbits are now generated using Keplerian orbital elements in planetaryReferences.js
   * This produces mathematically correct elliptical orbits in heliocentric coordinates.
   */

  /**
   * Calculate lunar phase from sun and moon ecliptic longitudes
   * sunLon, moonLon: in RADIANS
   * Returns: { phase: "New Moon"|"Waxing Crescent"|etc., illumination: 0-100 }
   */
  calculateLunarPhase(sunLonRad, moonLonRad) {
    // Calculate phase angle (elongation)
    let phaseDeg = this._radToDeg(moonLonRad - sunLonRad);
    phaseDeg = this._deg(phaseDeg); // Normalize to 0-360

    // Calculate illumination percentage
    const illumination = (1 - Math.cos(this._degToRad(phaseDeg))) / 2 * 100;

    // Determine phase name
    let phaseName;
    if (phaseDeg < 22.5 || phaseDeg >= 337.5) {
      phaseName = "New Moon";
    } else if (phaseDeg < 67.5) {
      phaseName = "Waxing Crescent";
    } else if (phaseDeg < 112.5) {
      phaseName = "First Quarter";
    } else if (phaseDeg < 157.5) {
      phaseName = "Waxing Gibbous";
    } else if (phaseDeg < 202.5) {
      phaseName = "Full Moon";
    } else if (phaseDeg < 247.5) {
      phaseName = "Waning Gibbous";
    } else if (phaseDeg < 292.5) {
      phaseName = "Last Quarter";
    } else {
      phaseName = "Waning Crescent";
    }

    return {
      phase: phaseName,
      illumination: Math.round(illumination)
    };
  }

  /**
   * Calculate sunrise and sunset times using ephemeris
   * Inputs:
   *   sunEclipticLon: in RADIANS (not used if ephemeris has rise/set)
   *   latitude, longitude: in DEGREES (longitude east-positive)
   *   dayOfYear: integer (UTC day-of-year)
   *   year: integer
   *   timezone: optional IANA timezone string (e.g., 'America/Anchorage')
   *
   * Returns { sunrise: "HH:MM", sunset: "HH:MM", transit: "HH:MM" } in local time if timezone provided, otherwise UTC
   */
  calculateRiseSet(sunEclipticLon, latitude, longitude, dayOfYear, year, timezone = null) {
    // Try to use ephemeris library for accurate rise/set times
    try {
      const { month, day } = this.dayOfYearToMonthDay(dayOfYear, year);
      const dateUTC = new Date(Date.UTC(year, month, day, 12, 0, 0)); // Use noon to get the day's rise/set

      // Try ephemeris rise/set functions if they exist
      if (ephemeris.sunRise && ephemeris.sunSet) {
        const sunriseResult = ephemeris.sunRise(dateUTC, latitude, longitude);
        const sunsetResult = ephemeris.sunSet(dateUTC, latitude, longitude);

        if (sunriseResult && sunsetResult) {
          const formatDate = (d) => {
            if (!d || !(d instanceof Date)) return "--:--";
            const dt = DateTime.fromJSDate(d, { zone: 'UTC' });
            if (timezone) {
              const local = dt.setZone(timezone);
              return local.toFormat('HH:mm');
            }
            return dt.toFormat('HH:mm');
          };

          return {
            sunrise: formatDate(sunriseResult),
            sunset: formatDate(sunsetResult),
            transit: "--:--" // Transit not provided by these functions
          };
        }
      }

      // Alternative: check if getAllPlanets returns rise/set data
      const result = ephemeris.getAllPlanets(dateUTC, latitude, longitude);
      const sunData = result?.observed?.sun || result?.sun;

      if (sunData && (sunData.rise || sunData.set)) {
        const formatDate = (d) => {
          if (!d || !(d instanceof Date)) return "--:--";
          const dt = DateTime.fromJSDate(d, { zone: 'UTC' });
          if (timezone) {
            const local = dt.setZone(timezone);
            return local.toFormat('HH:mm');
          }
          return dt.toFormat('HH:mm');
        };

        return {
          sunrise: formatDate(sunData.rise),
          sunset: formatDate(sunData.set),
          transit: formatDate(sunData.transit || null)
        };
      }
    } catch (e) {
      debugLog.warn('Ephemeris rise/set failed, using calculated values:', e);
    }

    // Fallback: Calculate rise/set by iterating through the day to find when sun crosses horizon
    // debugLog.log('Using iterative calculation for sunrise/sunset');

    const { month, day } = this.dayOfYearToMonthDay(dayOfYear, year);
    const SUN_ANGULAR_RADIUS = 0.267 * Math.PI / 180;
    const ATMOSPHERIC_REFRACTION = 0.567 * Math.PI / 180;
    const ALTITUDE_AT_RISE_SET = -(SUN_ANGULAR_RADIUS + ATMOSPHERIC_REFRACTION); // About -0.833 degrees

    // Helper: Calculate sun's altitude at a given time
    const getSunAltitude = (hours, minutes) => {
      try {
        // Calculate Julian Date for this time
        const date = new Date(Date.UTC(year, month, day, hours, minutes, 0));
        const jd = date.getTime() / 86400000 + 2440587.5;

        // Calculate sun's ecliptic longitude
        const sunLon = this.calculateSunPosition(jd, longitude);

        // Convert to equatorial coordinates
        const { ra, dec } = this.eclipticToEquatorial(sunLon, 0, this.OBLIQUITY);

        // Calculate LST for this time
        const timeMinutes = hours * 60 + minutes;
        const { LST: LSTdeg } = this.calculateLST(dayOfYear, timeMinutes, longitude, year);
        const lstRad = this._degToRad(LSTdeg);
        const latRad = this._degToRad(latitude);

        // Convert to horizontal coordinates
        const { alt } = this.equatorialToHorizontal(ra, dec, lstRad, latRad);

        return alt;
      } catch (e) {
        return null;
      }
    };

    // Search through the day to find sunrise, sunset, and transit
    // Track previous altitude to detect crossings
    let sunriseTime = null;
    let sunsetTime = null;
    let transitTime = null;
    let maxAltitude = -Math.PI;
    let prevAlt = getSunAltitude(0, 0);

    // Sample every minute for accuracy
    for (let totalMinutes = 1; totalMinutes < 24 * 60; totalMinutes++) {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const alt = getSunAltitude(h, m);

      if (alt === null || prevAlt === null) {
        prevAlt = alt;
        continue;
      }

      // Track transit (highest altitude)
      if (alt > maxAltitude) {
        maxAltitude = alt;
        transitTime = { hours: h, minutes: m };
      }

      // Detect sunrise: crossing from below to above threshold
      if (!sunriseTime && prevAlt < ALTITUDE_AT_RISE_SET && alt >= ALTITUDE_AT_RISE_SET) {
        sunriseTime = { hours: h, minutes: m };
        // debugLog.log('Found sunrise at', h, ':', m, 'alt:', alt, 'prevAlt:', prevAlt);
      }

      // Detect sunset: crossing from above to below threshold
      if (!sunsetTime && prevAlt > ALTITUDE_AT_RISE_SET && alt <= ALTITUDE_AT_RISE_SET) {
        sunsetTime = { hours: h, minutes: m };
        // debugLog.log('Found sunset at', h, ':', m, 'alt:', alt, 'prevAlt:', prevAlt);
      }

      prevAlt = alt;

      // Stop if we found both
      if (sunriseTime && sunsetTime) break;
    }

    // Handle special cases
    if (!sunriseTime && !sunsetTime) {
      const noonAlt = getSunAltitude(12, 0);
      if (noonAlt !== null) {
        if (noonAlt < ALTITUDE_AT_RISE_SET) {
          return { sunrise: "No sunrise", sunset: "No sunset", transit: "--:--" };
        } else {
          return { sunrise: "24h sun", sunset: "24h sun", transit: "--:--" };
        }
      }
    }

    // If we found sunset before sunrise in the UTC day, it means the sun was already up at UTC midnight
    // In this case, the "sunrise" we found is actually for the next occurrence
    // We should skip it and just show the sunset
    if (sunsetTime && sunriseTime &&
        (sunsetTime.hours * 60 + sunsetTime.minutes) < (sunriseTime.hours * 60 + sunriseTime.minutes)) {
      // debugLog.log('Sunset found before sunrise - sun was up at midnight');
      // The sunrise we found is for tomorrow, so ignore it for today's calculation
      // We could search backwards from midnight to find yesterday's sunrise, but for simplicity just use sunset
    }

    let sunriseUT = sunriseTime ? sunriseTime.hours + sunriseTime.minutes / 60 : 6;
    let sunsetUT = sunsetTime ? sunsetTime.hours + sunsetTime.minutes / 60 : 18;
    let transitUT = transitTime ? transitTime.hours + transitTime.minutes / 60 : 12;

    // debugLog.log('Rise/Set in UT:', sunriseUT, sunsetUT, 'Transit:', transitUT);

    const norm24 = (h) => {
      let hh = h % 24;
      if (hh < 0) hh += 24;
      return hh;
    };

    sunriseUT = norm24(sunriseUT);
    sunsetUT = norm24(sunsetUT);
    transitUT = norm24(transitUT);

    const formatTime = (hours) => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    // Convert UTC times to local timezone if provided
    if (timezone) {
      try {
        // Create UTC DateTimes and convert to local timezone (month, day already declared above)
        const sunriseUTC = DateTime.fromObject({
          year, month: month + 1, day,
          hour: Math.floor(sunriseUT), minute: Math.floor((sunriseUT % 1) * 60)
        }, { zone: 'UTC' });
        const sunsetUTC = DateTime.fromObject({
          year, month: month + 1, day,
          hour: Math.floor(sunsetUT), minute: Math.floor((sunsetUT % 1) * 60)
        }, { zone: 'UTC' });
        const transitUTC = DateTime.fromObject({
          year, month: month + 1, day,
          hour: Math.floor(transitUT), minute: Math.floor((transitUT % 1) * 60)
        }, { zone: 'UTC' });

        const sunriseLocal = sunriseUTC.setZone(timezone);
        const sunsetLocal = sunsetUTC.setZone(timezone);
        const transitLocal = transitUTC.setZone(timezone);

        return {
          sunrise: sunriseLocal.toFormat('HH:mm'),
          sunset: sunsetLocal.toFormat('HH:mm'),
          transit: transitLocal.toFormat('HH:mm')
        };
      } catch (e) {
        debugLog.warn('Timezone conversion failed:', e, 'Falling back to longitude offset');
      }
    }

    // Fallback: use longitude offset approximation
    const lonTimeOffset = longitude / 15.0; // hours
    let sunriseLocal = norm24(sunriseUT + lonTimeOffset);
    let sunsetLocal = norm24(sunsetUT + lonTimeOffset);
    let transitLocal = norm24(transitUT + lonTimeOffset);

    return {
      sunrise: formatTime(sunriseLocal),
      sunset: formatTime(sunsetLocal),
      transit: formatTime(transitLocal)
    };
  }

  /**
   * Convert ecliptic coordinates (lon, lat in radians) to equatorial (RA, Dec in radians)
   * obliquity: obliquity in radians
   */
  eclipticToEquatorial(eclipticLon, eclipticLat, obliquity) {
    const sinDec = Math.sin(eclipticLat) * Math.cos(obliquity) +
                   Math.cos(eclipticLat) * Math.sin(obliquity) * Math.sin(eclipticLon);
    const dec = Math.asin(sinDec);

    const ra = Math.atan2(
      Math.sin(eclipticLon) * Math.cos(obliquity) - Math.tan(eclipticLat) * Math.sin(obliquity),
      Math.cos(eclipticLon)
    );

    return { ra, dec };
  }

  /**
   * Convert equatorial coordinates (RA, Dec in radians) to horizontal (alt, az in radians)
   * ra, dec: right ascension and declination in radians
   * lstRad: local sidereal time in radians
   * latRad: observer latitude in radians
   */
  equatorialToHorizontal(ra, dec, lstRad, latRad) {
    const hourAngle = lstRad - ra;

    const sinAlt = Math.sin(dec) * Math.sin(latRad) +
                   Math.cos(dec) * Math.cos(latRad) * Math.cos(hourAngle);
    const alt = Math.asin(sinAlt);

    const az = Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(dec) * Math.cos(latRad)
    );

    return { alt, az };
  }

  /**
   * Convert to zodiac notation (e.g. "10♈05")
   * longitude: degrees 0..360
   */
  toZodiacString(longitude) {
    const signs = ['♈\uFE0E', '♉\uFE0E', '♊\uFE0E', '♋\uFE0E', '♌\uFE0E', '♍\uFE0E', '♎\uFE0E', '♏\uFE0E', '♐\uFE0E', '♑\uFE0E', '♒\uFE0E', '♓\uFE0E'];
    let lon = longitude % 360;
    if (lon < 0) lon += 360;
    let signIndex = Math.floor(lon / 30) % 12;
    let degree = lon % 30;
    let wholeDegs = Math.floor(degree);
    let decimalMinutes = (degree - wholeDegs) * 60;
    let minutes = Math.floor(decimalMinutes);
    let seconds = (decimalMinutes - minutes) * 60;

    if (seconds >= 30) {
      minutes++;
      if (minutes >= 60) {
        minutes = 0;
        wholeDegs++;
        if (wholeDegs >= 30) {
          wholeDegs = 0;
          signIndex = (signIndex + 1) % 12;
        }
      }
    }

    return `${wholeDegs.toString().padStart(2, '0')}${signs[signIndex]}${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Convert LST (degrees) to time string HH:MM (approx)
   */
  lstToTimeString(lst) {
    const hours = Math.floor(lst / 15);
    const minutes = Math.floor((lst % 15) * 4);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Convert day of year to month/day (month is 0-based for Date.UTC usage)
   */
  dayOfYearToMonthDay(dayOfYear, isLeapYear = true) {
    const monthDays = isLeapYear
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let remainingDays = dayOfYear;
    let month = 0;
    let day = 1;

    for (let i = 0; i < 12; i++) {
      if (remainingDays <= monthDays[i]) {
        month = i;
        day = remainingDays;
        break;
      }
      remainingDays -= monthDays[i];
    }

    return { month, day };
  }
}
