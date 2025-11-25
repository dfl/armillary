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

// Animation state
let isAnimating = false;
let animationSpeed = 60; // Speed in minutes per second (60 = 1 hour per second)
let lastAnimationTime = 0;
let animationStartTime = 0;
let animationStartValue = 0;

// Key repeat acceleration for manual time control
let keyRepeatCount = 0;
let lastKeyPressed = null;
let keyRepeatMultiplier = 1;

// Animation loop for time progression
const animateTime = (timestamp) => {
  if (!isAnimating) return;

  // Calculate time delta (limit to reasonable values)
  const deltaTime = lastAnimationTime ? Math.min(timestamp - lastAnimationTime, 100) : 16;
  lastAnimationTime = timestamp;

  // Increment time based on speed
  // animationSpeed is in minutes per second (real time)
  // deltaTime is in milliseconds
  const timeIncrement = (deltaTime / 1000) * animationSpeed;

  // Debugging: Log actual speed every 3 seconds
  if (timestamp - animationStartTime > 3000 && animationStartTime > 0) {
    const timeSlider = document.getElementById('timeSlider');
    const daySlider = document.getElementById('daySlider');
    const currentValue = parseFloat(daySlider.value) * 1440 + parseFloat(timeSlider.value);
    const elapsedRealSeconds = (timestamp - animationStartTime) / 1000;
    const elapsedSimMinutes = currentValue - animationStartValue;
    const actualSpeed = elapsedSimMinutes / elapsedRealSeconds;
    console.log(`Actual speed: ${actualSpeed.toFixed(1)} min/sec (target: ${animationSpeed} min/sec)`);
    animationStartTime = timestamp;
    animationStartValue = currentValue;
  }

  const timeSlider = document.getElementById('timeSlider');
  const daySlider = document.getElementById('daySlider');
  let newTime = parseFloat(timeSlider.value) + timeIncrement;
  let currentDay = parseFloat(daySlider.value);

  // Handle day wraparound
  while (newTime >= 1440) {
    newTime -= 1440;
    currentDay += 1;
    // Check if we need to wrap to next year
    const isLeapYear = (uiManager.currentYear % 4 === 0 && uiManager.currentYear % 100 !== 0) || (uiManager.currentYear % 400 === 0);
    const maxDay = isLeapYear ? 366 : 365;
    if (currentDay > maxDay) {
      currentDay = 1;
      uiManager.currentYear += 1;
    }
  }
  while (newTime < 0) {
    newTime += 1440;
    currentDay -= 1;
    if (currentDay < 1) {
      uiManager.currentYear -= 1;
      const isLeapYear = (uiManager.currentYear % 4 === 0 && uiManager.currentYear % 100 !== 0) || (uiManager.currentYear % 400 === 0);
      currentDay = isLeapYear ? 366 : 365;
    }
  }

  // Update sliders
  timeSlider.value = newTime;
  daySlider.value = currentDay;

  // Trigger update events
  timeSlider.dispatchEvent(new Event('input'));
  daySlider.dispatchEvent(new Event('input'));

  // Continue animation loop
  requestAnimationFrame(animateTime);
};

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

// Lunar orbit toggle
const lunarOrbitToggle = document.getElementById('lunarOrbitToggle');
lunarOrbitToggle.addEventListener('change', () => {
  scene.toggleLunarOrbit(lunarOrbitToggle.checked);
  uiManager.setToggleState('lunarOrbit', lunarOrbitToggle.checked);
  uiManager.saveStateToURL();
});

// Planet orbits toggle
const planetOrbitsToggle = document.getElementById('planetOrbitsToggle');
planetOrbitsToggle.addEventListener('change', () => {
  scene.togglePlanetOrbits(planetOrbitsToggle.checked);
  uiManager.setToggleState('planetOrbits', planetOrbitsToggle.checked);
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

// Planet zoom slider
const planetZoomSlider = document.getElementById('planetZoomSlider');
const planetZoomValue = document.getElementById('planetZoomValue');
planetZoomSlider.addEventListener('input', () => {
  const zoom = parseFloat(planetZoomSlider.value);
  scene.setPlanetZoom(zoom);
  const label = zoom === 0 ? '0 (Accurate)' : zoom === 1 ? '1.0 (Exaggerated)' : zoom.toFixed(2);
  planetZoomValue.textContent = label;
  uiManager.setPlanetZoom(zoom);
  uiManager.saveStateToURL();
  updateVisualization();
});

// Speed indicator display
let speedIndicatorTimeout = null;
const speedIndicator = document.createElement('div');
speedIndicator.style.position = 'fixed';
speedIndicator.style.top = '20px';
speedIndicator.style.right = '20px';
speedIndicator.style.fontSize = '48px';
speedIndicator.style.fontWeight = 'bold';
speedIndicator.style.color = '#888';
speedIndicator.style.fontFamily = 'monospace';
speedIndicator.style.opacity = '0';
speedIndicator.style.transition = 'opacity 0.3s';
speedIndicator.style.pointerEvents = 'none';
speedIndicator.style.zIndex = '10000';
speedIndicator.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
document.body.appendChild(speedIndicator);

// Helper function to format speed label
const getSpeedLabel = (speed) => {
  if (speed >= 525600) {
    const years = speed / 525600;
    return `${years.toFixed(1)} years/sec`;
  } else if (speed >= 1440) {
    const days = speed / 1440;
    if (days >= 7) {
      const weeks = days / 7;
      return `${weeks.toFixed(1)} weeks/sec`;
    }
    return `${days.toFixed(1)} days/sec`;
  } else if (speed >= 60) {
    return `${(speed / 60).toFixed(1)} hours/sec`;
  } else {
    return `${speed.toFixed(1)} min/sec`;
  }
};

// Show speed indicator in upper right corner
const showSpeedIndicator = (label) => {
  speedIndicator.textContent = label;
  speedIndicator.style.opacity = '1';

  // Clear existing timeout
  if (speedIndicatorTimeout) {
    clearTimeout(speedIndicatorTimeout);
  }

  // Hide after 2 seconds
  speedIndicatorTimeout = setTimeout(() => {
    speedIndicator.style.opacity = '0';
  }, 2000);
};

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  // Only process if not typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  // Space bar to toggle animation
  if (e.key === ' ') {
    e.preventDefault(); // Prevent page scroll
    isAnimating = !isAnimating;
    if (isAnimating) {
      lastAnimationTime = 0; // Reset for smooth start
      animationStartTime = 0; // Reset speed tracking
      const timeSlider = document.getElementById('timeSlider');
      const daySlider = document.getElementById('daySlider');
      animationStartValue = parseFloat(daySlider.value) * 1440 + parseFloat(timeSlider.value);
      requestAnimationFrame(animateTime);
      const speedLabel = getSpeedLabel(animationSpeed);
      console.log('Animation started at speed:', speedLabel);
      showSpeedIndicator(speedLabel);
    } else {
      console.log('Animation paused');
    }
  }

  // 's' to toggle stereo view and Controls widget
  if (e.key === 's') {
    stereoToggle.checked = !stereoToggle.checked;
    scene.toggleStereo(stereoToggle.checked);

    // Toggle Controls widget (opposite of stereo state)
    const controlsWidget = document.getElementById('ui');
    controlsWidget.open = !stereoToggle.checked;
  }

  // '[' to decrease speed (when animating) or move time back (when not)
  if (e.key === '[') {
    if (isAnimating) {
      // Decrease animation speed (halve it, with minimum of 30 min/sec)
      animationSpeed = Math.max(30, animationSpeed / 2);
      const speedLabel = getSpeedLabel(animationSpeed);
      console.log('Animation speed:', speedLabel);
      showSpeedIndicator(speedLabel);
      // Reset speed tracking for accurate measurement
      animationStartTime = 0;
    } else {
      // Move time back with acceleration on key repeat
      if (lastKeyPressed === '[' && !e.repeat) {
        // First press after release
        keyRepeatCount = 0;
        keyRepeatMultiplier = 1;
      } else if (lastKeyPressed === '[') {
        // Key is being held/repeated
        keyRepeatCount++;
        // Exponential acceleration: 1x, 2x, 4x, 8x, 16x, max 32x
        keyRepeatMultiplier = Math.min(32, Math.pow(2, Math.floor(keyRepeatCount / 3)));
      }
      lastKeyPressed = '[';

      const timeSlider = document.getElementById('timeSlider');
      const daySlider = document.getElementById('daySlider');
      const jumpAmount = 48 * keyRepeatMultiplier; // Base 48 minutes, accelerated
      let newTime = parseInt(timeSlider.value) - jumpAmount;
      let currentDay = parseInt(daySlider.value);

      while (newTime < 0) {
        newTime += 1440; // Move to previous day
        currentDay -= 1;
        if (currentDay < 1) {
          uiManager.currentYear -= 1;
          const isLeapYear = (uiManager.currentYear % 4 === 0 && uiManager.currentYear % 100 !== 0) || (uiManager.currentYear % 400 === 0);
          currentDay = isLeapYear ? 366 : 365; // Wrap to end of previous year
        }
      }

      daySlider.value = currentDay;
      timeSlider.value = newTime;
      daySlider.dispatchEvent(new Event('input'));
      timeSlider.dispatchEvent(new Event('input'));
    }
  }

  // ']' to increase speed (when animating) or move time forward (when not)
  if (e.key === ']') {
    if (isAnimating) {
      // Increase animation speed (double it, with maximum of 525600 min/sec = 1 year/sec)
      animationSpeed = Math.min(525600, animationSpeed * 2);
      const speedLabel = getSpeedLabel(animationSpeed);
      console.log('Animation speed:', speedLabel);
      showSpeedIndicator(speedLabel);
      // Reset speed tracking for accurate measurement
      animationStartTime = 0;
    } else {
      // Move time forward with acceleration on key repeat
      if (lastKeyPressed === ']' && !e.repeat) {
        // First press after release
        keyRepeatCount = 0;
        keyRepeatMultiplier = 1;
      } else if (lastKeyPressed === ']') {
        // Key is being held/repeated
        keyRepeatCount++;
        // Exponential acceleration: 1x, 2x, 4x, 8x, 16x, max 32x
        keyRepeatMultiplier = Math.min(32, Math.pow(2, Math.floor(keyRepeatCount / 3)));
      }
      lastKeyPressed = ']';

      const timeSlider = document.getElementById('timeSlider');
      const daySlider = document.getElementById('daySlider');
      const jumpAmount = 48 * keyRepeatMultiplier; // Base 48 minutes, accelerated
      let newTime = parseInt(timeSlider.value) + jumpAmount;
      let currentDay = parseInt(daySlider.value);

      while (newTime >= 1440) {
        newTime -= 1440; // Move to next day
        currentDay += 1;
        const isLeapYear = (uiManager.currentYear % 4 === 0 && uiManager.currentYear % 100 !== 0) || (uiManager.currentYear % 400 === 0);
        const maxDay = isLeapYear ? 366 : 365;
        if (currentDay > maxDay) {
          currentDay = 1;
          uiManager.currentYear += 1; // Wrap to start of next year
        }
      }

      daySlider.value = currentDay;
      timeSlider.value = newTime;
      daySlider.dispatchEvent(new Event('input'));
      timeSlider.dispatchEvent(new Event('input'));
    }
  }
});

// Reset key repeat acceleration on key release
window.addEventListener('keyup', (e) => {
  if (e.key === '[' || e.key === ']') {
    keyRepeatCount = 0;
    keyRepeatMultiplier = 1;
    lastKeyPressed = null;
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

// Animation control modal for mobile
const animationControlButton = document.getElementById('animationControlButton');
const animationControlModal = document.getElementById('animationControlModal');

animationControlButton.addEventListener('click', (e) => {
  e.stopPropagation();
  animationControlModal.classList.toggle('visible');
});

// Handle animation control button clicks
const animationControlBtns = document.querySelectorAll('.animation-control-btn');
animationControlBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const action = btn.dataset.action;

    if (action === 'play-pause') {
      // Simulate spacebar key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    } else if (action === 'slower') {
      // Simulate '[' key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '[' }));
    } else if (action === 'faster') {
      // Simulate ']' key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
    } else if (action === 'stereo') {
      // Simulate 's' key press
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    } else if (action === 'zoom-to') {
      // Open context menu at button location
      const contextMenu = document.getElementById('contextMenu');
      const btnRect = btn.getBoundingClientRect();

      // Create a synthetic event for positioning
      const syntheticEvent = {
        clientX: btnRect.left + btnRect.width / 2,
        clientY: btnRect.top + btnRect.height / 2,
        preventDefault: () => {},
        stopPropagation: () => {}
      };

      // Show the context menu
      contextMenu.classList.add('visible');
      const rect = contextMenu.getBoundingClientRect();

      let left = syntheticEvent.clientX;
      let top = syntheticEvent.clientY;

      // Check right boundary
      if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - 5;
      }

      // Check bottom boundary
      if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - 5;
      }

      // Ensure menu doesn't go off left edge
      if (left < 5) {
        left = 5;
      }

      // Ensure menu doesn't go off top edge
      if (top < 5) {
        top = 5;
      }

      contextMenu.style.left = left + 'px';
      contextMenu.style.top = top + 'px';

      // Close the animation control modal
      animationControlModal.classList.remove('visible');
    } else if (action === 'reset') {
      // Reset URL parameters except datetime and location
      const params = new URLSearchParams(window.location.hash.slice(1));
      const dt = params.get('dt');
      const loc = params.get('loc');

      // Clear all params and only keep dt and loc
      const newParams = new URLSearchParams();
      if (dt) newParams.set('dt', dt);
      if (loc) newParams.set('loc', loc);

      window.history.replaceState({}, '', `#${newParams.toString()}`);

      // Reload the page to reset everything
      window.location.reload();
    }
  });
});

// Close animation control modal when clicking outside
document.addEventListener('click', (e) => {
  if (animationControlModal.classList.contains('visible') &&
      !animationControlModal.contains(e.target) &&
      e.target !== animationControlButton) {
    animationControlModal.classList.remove('visible');
  }
});

// Close animation control modal with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && animationControlModal.classList.contains('visible')) {
    animationControlModal.classList.remove('visible');
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
lunarOrbitToggle.checked = toggleStates.lunarOrbit;
planetOrbitsToggle.checked = toggleStates.planetOrbits;
stereoToggle.checked = toggleStates.stereo;
if (uiManager.elements.siderealCheckbox) {
  uiManager.elements.siderealCheckbox.checked = toggleStates.sidereal;
}

// Apply eye separation from URL
const eyeSeparation = uiManager.getEyeSeparation();
eyeSeparationSlider.value = eyeSeparation;
eyeSeparationValue.textContent = eyeSeparation.toFixed(2);

// Apply planet zoom from URL
const planetZoom = uiManager.getPlanetZoom();
planetZoomSlider.value = planetZoom;
const zoomLabel = planetZoom === 0 ? '0 (Accurate)' : planetZoom === 1 ? '1.0 (Exaggerated)' : planetZoom.toFixed(2);
planetZoomValue.textContent = zoomLabel;
scene.setPlanetZoom(planetZoom);

// Apply toggle states to scene
scene.toggleStarfield(toggleStates.starfield);
scene.togglePlanets(toggleStates.planets);
scene.toggleEarthReferences(toggleStates.earthReferences);
scene.toggleSunReferences(toggleStates.sunReferences);
scene.toggleLunarOrbit(toggleStates.lunarOrbit);
scene.togglePlanetOrbits(toggleStates.planetOrbits);
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
