// astronomy.js - Astronomical calculations
import { calculateObliquity } from './epsilon.js';
import * as ephemeris from 'ephemeris';

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
   * currentTime: minutes since 00:00 UTC
   * currentLongitude: degrees (east positive; negative for west)
   * currentYear: full year number (e.g. 2025 or 1979)
   *
   * Returns { LST: degrees (0..360), julianDate }
   */
  calculateLST(currentDay, currentTime, currentLongitude, currentYear) {
    // Build a UTC Date from day-of-year + minutes:
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const { month, day } = this.dayOfYearToMonthDay(currentDay, isLeap);

    const hours = Math.floor(currentTime / 60);
    const minutes = Math.floor(currentTime % 60);
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

    console.log('JD:', julianDate, 'GMST at 0h (deg):', GMST_norm, 'Hours UT:', currentTime / 60, 'GMST now (deg):', GMST_norm);
    console.log('Longitude:', currentLongitude, 'Final LST:', LST);

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
      console.warn('calculateObliquity failed, using nominal OBLIQUITY', e);
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
   * Calculate Sun's ecliptic longitude (radians) using ephemeris npm package
   * The function returns longitude in RADIANS (0..2π)
   */
  calculateSunPosition(currentDay, currentYear, month, day, hours, minutes) {
    try {
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
      console.warn('Ephemeris call failed:', e);
    }

    // Fallback: simple mean-sun approximation based on day-of-year (not high accuracy)
    // currentDay is day-of-year (1..365)
    const approxLon = (280 + (currentDay - 1) * (360 / 365.2425)) % 360;
    console.warn('Using approximate Sun position (deg):', approxLon);
    return this._degToRad(approxLon);
  }

  /**
   * Calculate sunrise and sunset times (local)
   * Inputs:
   *   sunEclipticLon: in RADIANS
   *   latitude, longitude: in DEGREES (longitude east-positive)
   *   dayOfYear: integer
   *
   * Returns { sunrise: "HH:MM", sunset: "HH:MM", transit: "HH:MM" } in local time
   */
  calculateRiseSet(sunEclipticLon, latitude, longitude, dayOfYear) {
    // Use nominal obliquity (radians) for these conversions
    const OBLIQUITY_RAD = this.OBLIQUITY;
    const SUN_ANGULAR_RADIUS = 0.267 * Math.PI / 180;
    const ATMOSPHERIC_REFRACTION = 0.567 * Math.PI / 180;
    const ALTITUDE_AT_RISE_SET = -(SUN_ANGULAR_RADIUS + ATMOSPHERIC_REFRACTION);

    // Convert ecliptic longitude (radians) -> equatorial declination and RA
    const sinDec = Math.sin(OBLIQUITY_RAD) * Math.sin(sunEclipticLon);
    const declination = Math.asin(sinDec);

    const rightAscension = Math.atan2(
      Math.sin(sunEclipticLon) * Math.cos(OBLIQUITY_RAD),
      Math.cos(sunEclipticLon)
    );
    let RA_deg = this._radToDeg(rightAscension);
    if (RA_deg < 0) RA_deg += 360;

    // Observer latitude in radians
    const latRad = this._degToRad(latitude);

    // hour angle for sunrise/sunset
    const cosH = (Math.sin(ALTITUDE_AT_RISE_SET) - Math.sin(latRad) * Math.sin(declination)) /
                 (Math.cos(latRad) * Math.cos(declination));

    if (cosH > 1) {
      return { sunrise: "No sunrise", sunset: "No sunset", transit: "--:--" };
    }
    if (cosH < -1) {
      return { sunrise: "24h sun", sunset: "24h sun", transit: "--:--" };
    }

    const H_deg = this._radToDeg(Math.acos(cosH));

    // Build JD at 0h UT for the given day (approx)
    // We construct a UTC Date at year/dayOfYear -> midnight and compute JD
    // For simplicity in this function we assume current year is J2000 reference year. This returns approximate rise/set times.
    const isLeap = true; // not used; dayOfYear passed in by caller
    // Create a provisional julianDate0h relative to J2000 using dayOfYear offset:
    const julianDate0h = this.J2000_EPOCH + (dayOfYear - 1); // approximate; caller should supply dayOfYear for that year

    const T = (julianDate0h - this.J2000_EPOCH) / 36525;
    const GST0 = 280.46061837 +
                 360.98564736629 * (julianDate0h - this.J2000_EPOCH) +
                 0.000387933 * T * T -
                 (T * T * T) / 38710000.0;

    // Transit time (UT) in hours: approximate using RA and GST0
    // transitUT = ((RA_norm - longitude - GST0) / 360.98564736629) * 24
    let transitUT = ((RA_deg - longitude - GST0) / 360.98564736629) * 24;
    // normalise into [0,24)
    transitUT = ((transitUT % 24) + 24) % 24;

    const H_hours = H_deg / 15.0;
    let sunriseUT = transitUT - H_hours;
    let sunsetUT = transitUT + H_hours;

    const lonTimeOffset = longitude / 15.0; // hours
    let sunriseLocal = sunriseUT + lonTimeOffset;
    let sunsetLocal = sunsetUT + lonTimeOffset;
    let transitLocal = transitUT + lonTimeOffset;

    const norm24 = (h) => {
      let hh = h % 24;
      if (hh < 0) hh += 24;
      return hh;
    };

    sunriseLocal = norm24(sunriseLocal);
    sunsetLocal  = norm24(sunsetLocal);
    transitLocal = norm24(transitLocal);

    const formatTime = (hours) => {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    return {
      sunrise: formatTime(sunriseLocal),
      sunset: formatTime(sunsetLocal),
      transit: formatTime(transitLocal)
    };
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
