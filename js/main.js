// main.js - Main entry point

// console.log('main.js loading...');

import { AstronomyCalculator } from './astronomy.js';
import { DateTimeParser, UIManager, initializeLocationAutocomplete } from './ui.js';
import { ArmillaryScene } from './scene.js';
import { DateTime } from 'luxon';

// console.log('All imports loaded');

// Initialize components
// console.log('Creating AstronomyCalculator...');
const astroCalc = new AstronomyCalculator();
// console.log('Creating ArmillaryScene...');
const scene = new ArmillaryScene();
// console.log('Scene created');

// Update function
const updateVisualization = () => {
  // console.log('updateVisualization called with currentYear:', uiManager.currentYear);

  // Convert local time to UTC if timezone is set
  let utcTime, utcDay, utcYear;
  if (uiManager.currentTimezone) {
    const { month, day } = uiManager.dayOfYearToMonthDay(uiManager.currentDay, uiManager.currentYear);
    const h = Math.floor(uiManager.currentTime / 60);
    const m = uiManager.currentTime % 60;

    const localDt = DateTime.fromObject({
      year: uiManager.currentYear,
      month: month + 1,
      day: day,
      hour: h,
      minute: m
    }, { zone: uiManager.currentTimezone });

    const utcDt = localDt.toUTC();
    utcTime = utcDt.hour * 60 + utcDt.minute;

    // Calculate UTC day-of-year
    const isLeapYear = (utcDt.year % 4 === 0 && utcDt.year % 100 !== 0) || (utcDt.year % 400 === 0);
    const monthDays = isLeapYear
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    utcDay = utcDt.day;
    for (let i = 0; i < utcDt.month - 1; i++) {
      utcDay += monthDays[i];
    }
    utcYear = utcDt.year;

    // console.log('Converting local', `${h}:${m}`, 'day', day, '-> UTC', `${utcDt.hour}:${utcDt.minute}`, 'day', utcDt.day);
  } else {
    // No timezone - values are already UTC/naive
    utcTime = uiManager.currentTime;
    utcDay = uiManager.currentDay;
    utcYear = uiManager.currentYear;
  }

  scene.updateSphere(
    astroCalc,
    uiManager.currentLatitude,
    uiManager.currentLongitude,
    utcTime,
    utcDay,
    utcYear,
    uiManager.currentTimezone
  );
};

// Initialize UI
const uiManager = new UIManager(updateVisualization);

// Initialize datetime parser with timezone callback
const datetimeInput = document.getElementById('datetimeInput');
const parser = new DateTimeParser(
  datetimeInput,
  (date) => {
    uiManager.updateSlidersFromDate(date);
  },
  () => uiManager.currentTimezone // Provide timezone getter
);

// Wire up "Now" button
const nowButton = document.getElementById('nowButton');
nowButton.addEventListener('click', (e) => {
  e.preventDefault();
  parser.setNow();
});

// Initialize location autocomplete
initializeLocationAutocomplete(uiManager, updateVisualization);

// Starfield toggle
const starfieldToggle = document.getElementById('starfieldToggle');
starfieldToggle.addEventListener('change', () => {
  scene.toggleStarfield(starfieldToggle.checked);
});

// Initialize UI values
uiManager.initialize();

// Load state from URL
const hasURLState = uiManager.loadStateFromURL(parser);

// Initial update (only if no URL state was loaded)
if (!hasURLState) {
  updateVisualization();
}

// Start animation loop
scene.animate();

// Expose for URL saving
window.updateSphere = updateVisualization;
window.currentLatitude = uiManager.currentLatitude;
window.currentLongitude = uiManager.currentLongitude;
window.saveStateToURL = () => uiManager.saveStateToURL();
window.isLoadingFromURL = false;
