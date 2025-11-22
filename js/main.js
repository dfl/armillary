// main.js - Main entry point

// Configurable logging system
const DEBUG = false; // Set to true to enable console logging
window.debugLog = {
  log: (...args) => { if (DEBUG) console.log(...args); },
  warn: (...args) => { if (DEBUG) console.warn(...args); },
  error: (...args) => { if (DEBUG) console.error(...args); }
};

import * as THREE from 'three';
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

// Setup camera state tracking and URL updates
// Debounce URL updates to avoid excessive history API calls
let cameraUpdateTimeout = null;
const saveCameraStateToURL = () => {
  if (cameraUpdateTimeout) clearTimeout(cameraUpdateTimeout);
  cameraUpdateTimeout = setTimeout(() => {
    uiManager.setCameraState(scene.camera, scene.controls);
    uiManager.saveStateToURL();
  }, 500); // Wait 500ms after camera movement stops
};

// Don't listen for camera changes yet - will be set up after initial camera position is set

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
  uiManager.setToggleState('starfield', starfieldToggle.checked);
  uiManager.saveStateToURL();
});

// Planets toggle
const planetsToggle = document.getElementById('planetsToggle');
planetsToggle.addEventListener('change', () => {
  scene.togglePlanets(planetsToggle.checked);
  uiManager.setToggleState('planets', planetsToggle.checked);
  uiManager.saveStateToURL();
});

// Earth references toggle
const earthReferencesToggle = document.getElementById('earthReferencesToggle');
earthReferencesToggle.addEventListener('change', () => {
  scene.toggleEarthReferences(earthReferencesToggle.checked);
  uiManager.setToggleState('earthReferences', earthReferencesToggle.checked);
  uiManager.saveStateToURL();
});

// Sun references toggle
const sunReferencesToggle = document.getElementById('sunReferencesToggle');
sunReferencesToggle.addEventListener('change', () => {
  scene.toggleSunReferences(sunReferencesToggle.checked);
  uiManager.setToggleState('sunReferences', sunReferencesToggle.checked);
  uiManager.saveStateToURL();
});

// Stereo view toggle
const stereoToggle = document.getElementById('stereoToggle');
stereoToggle.addEventListener('change', () => {
  scene.toggleStereo(stereoToggle.checked);
  uiManager.setToggleState('stereo', stereoToggle.checked);
  uiManager.saveStateToURL();
});

// Eye separation slider
const eyeSeparationSlider = document.getElementById('eyeSeparationSlider');
const eyeSeparationValue = document.getElementById('eyeSeparationValue');
eyeSeparationSlider.addEventListener('input', () => {
  const separation = parseFloat(eyeSeparationSlider.value);
  scene.setEyeSeparation(separation);
  eyeSeparationValue.textContent = separation.toFixed(2);
  uiManager.setEyeSeparation(separation);
  uiManager.saveStateToURL();
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Only process if not typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // 's' to toggle stereo view and Controls widget
  if (e.key === 's') {
    stereoToggle.checked = !stereoToggle.checked;
    scene.toggleStereo(stereoToggle.checked);

    // Toggle Controls widget (opposite of stereo state)
    const controlsWidget = document.getElementById('ui');
    controlsWidget.open = !stereoToggle.checked;
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

// Help modal
const helpButton = document.getElementById('helpButton');
const helpModal = document.getElementById('helpModal');
const closeHelp = document.getElementById('closeHelp');

helpButton.addEventListener('click', () => {
  helpModal.classList.add('visible');
});

closeHelp.addEventListener('click', () => {
  helpModal.classList.remove('visible');
});

// Close modal when clicking outside the content
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) {
    helpModal.classList.remove('visible');
  }
});

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpModal.classList.contains('visible')) {
    helpModal.classList.remove('visible');
  }
});

// Load state from URL first
const hasURLState = uiManager.loadStateFromURL(parser);

// Apply toggle states from URL
const toggleStates = uiManager.getToggleStates();
starfieldToggle.checked = toggleStates.starfield;
planetsToggle.checked = toggleStates.planets;
earthReferencesToggle.checked = toggleStates.earthReferences;
sunReferencesToggle.checked = toggleStates.sunReferences;
stereoToggle.checked = toggleStates.stereo;
if (uiManager.elements.siderealCheckbox) {
  uiManager.elements.siderealCheckbox.checked = toggleStates.sidereal;
}

// Apply eye separation from URL
const eyeSeparation = uiManager.getEyeSeparation();
eyeSeparationSlider.value = eyeSeparation;
eyeSeparationValue.textContent = eyeSeparation.toFixed(2);

// Apply toggle states to scene
scene.toggleStarfield(toggleStates.starfield);
scene.togglePlanets(toggleStates.planets);
scene.toggleEarthReferences(toggleStates.earthReferences);
scene.toggleSunReferences(toggleStates.sunReferences);
scene.toggleStereo(toggleStates.stereo);
scene.setEyeSeparation(eyeSeparation);

// Initialize UI values only if no URL state was loaded
// (this sets defaults but shouldn't trigger rendering yet)
if (!hasURLState) {
  uiManager.initialize();
  parser.setNow();
}

// Restore camera state from URL or set default camera position
setTimeout(() => {
  const cameraState = uiManager.getCameraState();
  if (cameraState) {
    // Smoothly animate to saved camera position from URL
    const startPos = scene.camera.position.clone();
    const startTarget = scene.controls.target.clone();
    const startUp = scene.camera.up.clone();

    const targetPos = new THREE.Vector3(cameraState.position.x, cameraState.position.y, cameraState.position.z);
    const targetTarget = new THREE.Vector3(cameraState.target.x, cameraState.target.y, cameraState.target.z);
    const targetUp = new THREE.Vector3(cameraState.up.x, cameraState.up.y, cameraState.up.z);

    const duration = 1000; // 1 second
    const startTime = performance.now();

    // Disable controls during animation
    scene.controls.enabled = false;

    const animateCamera = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out function
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate position, target, and up vector
      scene.camera.position.lerpVectors(startPos, targetPos, eased);
      scene.controls.target.lerpVectors(startTarget, targetTarget, eased);
      scene.camera.up.lerpVectors(startUp, targetUp, eased).normalize();

      // Ensure camera looks at target
      scene.camera.lookAt(scene.controls.target);

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        // Animation complete
        scene.controls.enabled = true;
        scene.controls.update();
        // Now that camera animation is done, start listening for camera changes
        scene.controls.addEventListener('change', saveCameraStateToURL);
      }
    };

    animateCamera();
    debugLog.log('Animating to saved camera state from URL');
  } else {
    // Set default camera zoom to horizon (slightly zoomed out)
    scene.zoomToTarget('horizon');

    // Wait for zoom animation to complete, then start listening for camera changes
    setTimeout(() => {
      scene.controls.addEventListener('change', saveCameraStateToURL);
    }, 1000); // Match zoom animation duration
  }
}, 1000);

// Start animation loop
scene.animate();

// Expose for URL saving
window.updateSphere = updateVisualization;
window.currentLatitude = uiManager.currentLatitude;
window.currentLongitude = uiManager.currentLongitude;
window.saveStateToURL = () => uiManager.saveStateToURL();
window.isLoadingFromURL = false;
