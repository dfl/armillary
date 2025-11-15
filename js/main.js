// main.js - Main entry point

console.log('main.js loading...');

import { AstronomyCalculator } from './astronomy.js';
import { DateTimeParser, UIManager, initializeLocationAutocomplete } from './ui.js';
import { ArmillaryScene } from './scene.js';

console.log('All imports loaded');

// Initialize components
console.log('Creating AstronomyCalculator...');
const astroCalc = new AstronomyCalculator();
console.log('Creating ArmillaryScene...');
const scene = new ArmillaryScene();
console.log('Scene created');

// Update function
const updateVisualization = () => {
  console.log('updateVisualization called with currentYear:', uiManager.currentYear);
  scene.updateSphere(
    astroCalc,
    uiManager.currentLatitude,
    uiManager.currentLongitude,
    uiManager.currentTime,
    uiManager.currentDay,
    uiManager.currentYear
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
