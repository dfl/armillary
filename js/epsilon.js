// epsilon.js - Obliquity calculation from ephemeris algorithms
// Based on the ephemeris npm package implementation

const STR = 4.8481368110953599359e-6; // radians per arcsecond

/**
 * Calculate obliquity of the ecliptic for a given Julian Date
 * @param {number} julianDate - Julian Date
 * @returns {number} Obliquity in radians
 */
export function calculateObliquity(julianDate) {
  const T = (julianDate - 2451545) / 36525;
  const T_scaled = T / 10;

  const eps_arcsec = (((((((((2.45e-10 * T_scaled + 5.79e-9) * T_scaled + 2.787e-7) * T_scaled
    + 7.12e-7) * T_scaled - 3.905e-5) * T_scaled - 2.4967e-3) * T_scaled
    - 5.138e-3) * T_scaled + 1.9989) * T_scaled - 0.0175) * T_scaled - 468.33960) * T_scaled
    + 84381.406173;

  const eps = eps_arcsec * STR;
  return eps; // radians
}
