// astronomy.js - Astronomical calculations

export class AstronomyCalculator {
  constructor() {
    this.J2000_EPOCH = 2451545.0;
    this.OBLIQUITY = 23.44 * Math.PI / 180;
  }

  /**
   * Calculate Local Sidereal Time
   */
  calculateLST(currentDay, currentTime, currentLongitude, currentYear) {
    const yearOffset = (currentYear - 2000) * 365.25;
    const daysFromJ2000 = yearOffset + (currentDay - 1) + (currentTime / 1440);
    const julianDate = 2451544.5 + daysFromJ2000;

    const T = (julianDate - this.J2000_EPOCH) / 36525;
    const GST0 = 280.46061837 + 360.98564736629 * (julianDate - this.J2000_EPOCH) + 0.000387933 * T * T;

    const longitudeTimeOffset = (currentLongitude / 15) * 60;
    const localTime = currentTime + longitudeTimeOffset;

    let LST = (GST0 + currentLongitude + (localTime / 1440) * 360) % 360;
    if (LST < 0) LST += 360;

    return LST;
  }

  /**
   * Calculate Midheaven (MC)
   */
  calculateMC(lstRad) {
    let MC = (Math.atan2(Math.sin(lstRad), Math.cos(lstRad) * Math.cos(this.OBLIQUITY)) * 180 / Math.PI);
    if (MC < 0) MC += 360;
    return MC;
  }

  /**
   * Calculate Ascendant (AC) and Descendant (DSC)
   */
  calculateAscendant(lstRad, latRad) {
    const tanLat = Math.tan(latRad);
    let DSC = (Math.atan2(-Math.cos(lstRad), Math.sin(lstRad) * Math.cos(this.OBLIQUITY) + tanLat * Math.sin(this.OBLIQUITY)) * 180 / Math.PI);
    if (DSC < 0) DSC += 360;
    const AC = (DSC + 180) % 360;
    return { AC, DSC };
  }

  /**
   * Calculate Sun's ecliptic longitude
   */
  calculateSunPosition(currentDay, currentYear, month, day, hours, minutes) {
    if (typeof $moshier !== 'undefined') {
      try {
        const date = {
          year: currentYear,
          month: month + 1,
          day: day,
          hours: hours,
          minutes: minutes,
          seconds: 0
        };

        $processor.init();
        const body = $moshier.body.sun;
        $processor.calc(date, body);

        if (body.position && body.position.apparentLongitude !== undefined) {
          return body.position.apparentLongitude * Math.PI / 180;
        } else if (body.position && body.position.polar) {
          return body.position.polar[0] * Math.PI / 180;
        }
      } catch (e) {
        console.warn('Ephemeris calculation failed, using approximation:', e);
      }
    }

    // Fallback approximation
    const sunLon = (280 + (currentDay - 1) * (360 / 365)) % 360;
    return sunLon * Math.PI / 180;
  }

  /**
   * Calculate sunrise and sunset times
   */
  calculateRiseSet(sunEclipticLon, latitude, longitude, dayOfYear) {
    const OBLIQUITY_RAD = this.OBLIQUITY;
    const SUN_ANGULAR_RADIUS = 0.267 * Math.PI / 180;
    const ATMOSPHERIC_REFRACTION = 0.567 * Math.PI / 180;
    const ALTITUDE_AT_RISE_SET = -(SUN_ANGULAR_RADIUS + ATMOSPHERIC_REFRACTION);

    // Convert ecliptic longitude to equatorial coordinates
    const sinDec = Math.sin(OBLIQUITY_RAD) * Math.sin(sunEclipticLon);
    const declination = Math.asin(sinDec);

    const rightAscension = Math.atan2(
      Math.sin(sunEclipticLon) * Math.cos(OBLIQUITY_RAD),
      Math.cos(sunEclipticLon)
    );
    const RA_deg = rightAscension * 180 / Math.PI;
    const RA_norm = RA_deg < 0 ? RA_deg + 360 : RA_deg;

    // Calculate hour angle when sun is at horizon
    const latRad = latitude * Math.PI / 180;
    const cosHourAngle = (Math.sin(ALTITUDE_AT_RISE_SET) - Math.sin(latRad) * Math.sin(declination)) /
                         (Math.cos(latRad) * Math.cos(declination));

    // Check for no sunrise/sunset (polar regions)
    if (cosHourAngle > 1) {
      return { sunrise: "No sunrise", sunset: "No sunset", transit: "--:--" };
    }
    if (cosHourAngle < -1) {
      return { sunrise: "24h sun", sunset: "24h sun", transit: "--:--" };
    }

    const H_deg = Math.acos(cosHourAngle) * 180 / Math.PI;

    // Calculate Greenwich Sidereal Time at 0h UT
    const julianDate0h = 2451544.5 + (dayOfYear - 1);
    const T = (julianDate0h - this.J2000_EPOCH) / 36525;
    const GST0 = 280.46061837 + 360.98564736629 * (julianDate0h - this.J2000_EPOCH) +
                 0.000387933 * T * T - 0.0000000258 * T * T * T;

    // Calculate transit time
    let transitUT = ((RA_norm - longitude - GST0) / 360.98564736629) * 24;
    while (transitUT < 0) transitUT += 24;
    while (transitUT >= 24) transitUT -= 24;

    // Sunrise and sunset times
    const H_hours = H_deg / 15;
    let sunriseUT = transitUT - H_hours;
    let sunsetUT = transitUT + H_hours;

    while (sunriseUT < 0) sunriseUT += 24;
    while (sunriseUT >= 24) sunriseUT -= 24;
    while (sunsetUT < 0) sunsetUT += 24;
    while (sunsetUT >= 24) sunsetUT -= 24;

    // Convert to local solar time
    const lonTimeOffset = longitude / 15;
    let sunriseLocal = sunriseUT + lonTimeOffset;
    let sunsetLocal = sunsetUT + lonTimeOffset;
    let transitLocal = transitUT + lonTimeOffset;

    while (sunriseLocal < 0) sunriseLocal += 24;
    while (sunriseLocal >= 24) sunriseLocal -= 24;
    while (sunsetLocal < 0) sunsetLocal += 24;
    while (sunsetLocal >= 24) sunsetLocal -= 24;
    while (transitLocal < 0) transitLocal += 24;
    while (transitLocal >= 24) transitLocal -= 24;

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
   * Convert to zodiac notation
   */
  toZodiacString(longitude) {
    const signs = ['♈\uFE0E', '♉\uFE0E', '♊\uFE0E', '♋\uFE0E', '♌\uFE0E', '♍\uFE0E', '♎\uFE0E', '♏\uFE0E', '♐\uFE0E', '♑\uFE0E', '♒\uFE0E', '♓\uFE0E'];
    let signIndex = Math.floor(longitude / 30);
    let degree = longitude % 30;
    let wholeDegs = Math.floor(degree);
    let decimalMinutes = (degree % 1) * 60;
    let minutes = Math.floor(decimalMinutes);
    let seconds = (decimalMinutes % 1) * 60;

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
   * Convert LST to time string
   */
  lstToTimeString(lst) {
    const hours = Math.floor(lst / 15);
    const minutes = Math.floor((lst % 15) * 4);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Convert day of year to month/day
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
