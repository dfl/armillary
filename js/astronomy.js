// astronomy.js - Astronomical calculations
import { calculateObliquity } from './epsilon.js';
import * as ephemeris from 'ephemeris';
import { DateTime } from 'luxon';

export class AstronomyCalculator {
  constructor() {
    this.J2000_EPOCH = 2451545.0;
    // nominal mean obliquity (radians) fallback — we still call calculateObliquity(JD) when needed
    this.OBLIQUITY = 23.44 * Math.PI / 180;
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
   * NOTE: hours and minutes are already UTC time (provided by UI)
   */
  calculateSunPosition(currentDay, currentYear, month, day, hours, minutes, longitude = 0) {
    try {
      // hours and minutes are already in UTC, use them directly
      const date = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0));

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

    // Fallback: simple mean-sun approximation based on day-of-year (not high accuracy)
    // currentDay is day-of-year (1..365)
    const approxLon = (280 + (currentDay - 1) * (360 / 365.2425)) % 360;
    debugLog.warn('Using approximate Sun position (deg):', approxLon);
    return this._degToRad(approxLon);
  }

  /**
   * Calculate Moon's ecliptic position (longitude and latitude in radians) using ephemeris npm package
   * Returns { longitude: radians (0..2π), latitude: radians }
   *
   * NOTE: hours and minutes are already UTC time (provided by UI)
   */
  calculateMoonPosition(currentDay, currentYear, month, day, hours, minutes, longitude = 0) {
    try {
      // hours and minutes are already in UTC, use them directly
      const date = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0));

      // ephemeris.getAllPlanets(date, lat, lon) -> results vary by package version.
      const result = ephemeris.getAllPlanets(date, 0, 0);

      // Try to read Moon's longitude and latitude
      const moonObj = result && result.observed && result.observed.moon ? result.observed.moon : (result && result.moon ? result.moon : null);

      if (moonObj) {
        const maybeLon = moonObj.apparentLongitudeDd ?? moonObj.longitude ?? moonObj.lon ?? moonObj.lambda;
        const maybeLat = moonObj.apparentLatitudeDd ?? moonObj.latitude ?? moonObj.lat ?? moonObj.beta;

        if (typeof maybeLon === 'number' && !Number.isNaN(maybeLon)) {
          let lonDeg = maybeLon;
          lonDeg = this._deg(lonDeg);

          let latRad = 0;
          if (typeof maybeLat === 'number' && !Number.isNaN(maybeLat)) {
            latRad = this._degToRad(maybeLat);
          }

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
   * Calculate lunar nodes (ascending ☊ and descending ☋)
   * The ascending node is where the Moon crosses the ecliptic going north
   * The descending node is 180° opposite
   * Returns { ascending: degrees (0..360), descending: degrees (0..360) }
   */
  calculateLunarNodes(currentDay, currentYear, month, day, hours, minutes) {
    try {
      // Try to get from ephemeris library first
      const date = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0));
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

    // Calculate using standard formula
    // Mean ascending node: Ω = 125.04452° - 1934.136261° * T + 0.0020708° * T² + T³/450000
    const julianDate = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0)).getTime() / 86400000 + 2440587.5;
    const T = (julianDate - this.J2000_EPOCH) / 36525.0; // Julian centuries since J2000

    let ascending = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
    ascending = this._deg(ascending);

    return {
      ascending: ascending,
      descending: this._deg(ascending + 180)
    };
  }

  /**
   * Get Earth's heliocentric position derived from Sun's geocentric position
   * Returns { longitude: radians, distance: AU }
   */
  getEarthHeliocentricPosition(currentDay, currentYear, month, day, hours, minutes) {
    // Calculate Sun's geocentric position
    const sunLonRad = this.calculateSunPosition(currentDay, currentYear, month, day, hours, minutes);
    
    // Earth is opposite to Sun
    const earthLonRad = (sunLonRad + Math.PI) % (2 * Math.PI);
    
    // Distance is effectively 1 AU (simplified, or could use ephemeris distance if available)
    return {
      longitude: earthLonRad,
      distance: 1.0
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
  calculatePlanetPosition(planetName, currentDay, currentYear, month, day, hours, minutes) {
    debugLog.log(`calculatePlanetPosition called for ${planetName}`);
    try {
      const date = new Date(Date.UTC(currentYear, month, day, hours, minutes, 0));
      debugLog.log(`  Date: ${date.toISOString()}`);
      const result = ephemeris.getAllPlanets(date, 0, 0);
      debugLog.log(`  Ephemeris result keys:`, result ? Object.keys(result) : 'null');

      // Get geocentric data (observed from Earth) for zodiac longitude
      const geocentricObj = result && result.observed && result.observed[planetName]
        ? result.observed[planetName]
        : (result && result[planetName] ? result[planetName] : null);

      // Get heliocentric data (relative to Sun) for 3D positioning
      const heliocentricObj = result && result.heliocentric && result.heliocentric[planetName]
        ? result.heliocentric[planetName]
        : null;

      debugLog.log(`  Geocentric object for ${planetName}:`, geocentricObj ? Object.keys(geocentricObj) : 'null');
      debugLog.log(`  Heliocentric object for ${planetName}:`, heliocentricObj ? Object.keys(heliocentricObj) : 'null');

      if (geocentricObj) {
        const geocentricLon = geocentricObj.apparentLongitudeDd ?? geocentricObj.longitude ?? geocentricObj.lon ?? geocentricObj.lambda;

        // Try to get heliocentric position
        const heliocentricLon = heliocentricObj ? (heliocentricObj.longitude ?? heliocentricObj.lon ?? heliocentricObj.lambda) : null;
        const heliocentricLat = heliocentricObj ? (heliocentricObj.latitude ?? heliocentricObj.lat ?? heliocentricObj.beta) : null;
        const heliocentricDist = heliocentricObj ? (heliocentricObj.distance ?? heliocentricObj.dist ?? heliocentricObj.r) : null;

        debugLog.log(`  Geocentric longitude value:`, geocentricLon);
        debugLog.log(`  Heliocentric longitude value:`, heliocentricLon);
        debugLog.log(`  Heliocentric latitude value:`, heliocentricLat);
        debugLog.log(`  Heliocentric distance value:`, heliocentricDist);

        if (typeof geocentricLon === 'number' && !Number.isNaN(geocentricLon)) {
          let geocentricLonDeg = this._deg(geocentricLon);
          debugLog.log(`  Normalized geocentric longitude (deg):`, geocentricLonDeg);

          return {
            geocentricLongitude: this._degToRad(geocentricLonDeg),
            heliocentricLongitude: (typeof heliocentricLon === 'number' && !Number.isNaN(heliocentricLon))
              ? this._degToRad(this._deg(heliocentricLon))
              : null,
            heliocentricLatitude: (typeof heliocentricLat === 'number' && !Number.isNaN(heliocentricLat))
              ? this._degToRad(heliocentricLat)
              : 0,
            heliocentricDistance: (typeof heliocentricDist === 'number' && !Number.isNaN(heliocentricDist))
              ? heliocentricDist
              : null
          };
        }
      }
    } catch (e) {
      debugLog.warn(`${planetName} ephemeris call failed:`, e);
    }

    // Fallback
    debugLog.warn(`Using fallback position for ${planetName}`);
    return { geocentricLongitude: 0, heliocentricLongitude: null, heliocentricLatitude: 0, heliocentricDistance: null };
  }

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
        // Calculate sun's ecliptic longitude
        const sunLon = this.calculateSunPosition(dayOfYear, year, month, day, hours, minutes, longitude);

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
