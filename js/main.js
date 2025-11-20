// main.js - Main entry point

// Configurable logging system
const DEBUG = false; // Set to true to enable console logging
window.debugLog = {
  log: (...args) => { if (DEBUG) console.log(...args); },
  warn: (...args) => { if (DEBUG) console.warn(...args); },
  error: (...args) => { if (DEBUG) console.error(...args); }
};

import { AstronomyCalculator } from './astronomy.js';
import { DateTimeParser, UIManager, initializeLocationAutocomplete } from './ui.js';
import { ArmillaryScene } from './scene.js';
import { DateTime } from 'luxon';

// Initialize components
const astroCalc = new AstronomyCalculator();
const scene = new ArmillaryScene();

// Update function
const updateVisualization = () => {

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

// Stereo view toggle
const stereoToggle = document.getElementById('stereoToggle');
stereoToggle.addEventListener('change', () => {
  scene.toggleStereo(stereoToggle.checked);
});

// Eye separation slider
const eyeSeparationSlider = document.getElementById('eyeSeparationSlider');
const eyeSeparationValue = document.getElementById('eyeSeparationValue');
eyeSeparationSlider.addEventListener('input', () => {
  const separation = parseFloat(eyeSeparationSlider.value);
  scene.setEyeSeparation(separation);
  eyeSeparationValue.textContent = separation.toFixed(2);
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Only process if not typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // 's' to toggle stereo view
  if (e.key === 's') {
    stereoToggle.checked = !stereoToggle.checked;
    scene.toggleStereo(stereoToggle.checked);
  }

  // '[' to move time back 1 hour
  if (e.key === '[') {
    const timeSlider = document.getElementById('timeSlider');
    const daySlider = document.getElementById('daySlider');
    let newTime = parseInt(timeSlider.value) - 48;
    let currentDay = parseInt(daySlider.value);

    if (newTime < 0) {
      newTime += 1440; // Move to previous day
      currentDay -= 1;
      if (currentDay < 1) currentDay = 365; // Wrap to end of year
      daySlider.value = currentDay;
      daySlider.dispatchEvent(new Event('input'));
    }

    timeSlider.value = newTime;
    timeSlider.dispatchEvent(new Event('input'));
  }

  // ']' to move time forward 1 hour
  if (e.key === ']') {
    const timeSlider = document.getElementById('timeSlider');
    const daySlider = document.getElementById('daySlider');
    let newTime = parseInt(timeSlider.value) + 48;
    let currentDay = parseInt(daySlider.value);

    if (newTime >= 1440) {
      newTime -= 1440; // Move to next day
      currentDay += 1;
      if (currentDay > 365) currentDay = 1; // Wrap to start of year
      daySlider.value = currentDay;
      daySlider.dispatchEvent(new Event('input'));
    }

    timeSlider.value = newTime;
    timeSlider.dispatchEvent(new Event('input'));
  }
});

// Initialize UI values
uiManager.initialize();

// Load state from URL
const hasURLState = uiManager.loadStateFromURL(parser);

// Initial update (only if no URL state was loaded)
if (!hasURLState) {
  parser.setNow();
} else {
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
