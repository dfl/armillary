// ui.js - UI input handling, autocomplete, geocoding, datetime parsing

import * as chrono from 'chrono-node';

export class DateTimeParser {
  constructor(inputElement, onDateTimeParsed) {
    this.input = inputElement;
    this.onDateTimeParsed = onDateTimeParsed;
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.input.addEventListener('blur', () => this.parse());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.parse();
      }
    });
  }

  setNow() {
    const now = new Date();
    this.input.value = 'now';
    this.onDateTimeParsed(now);
    this.showSuccess();
  }

  parse() {
    const text = this.input.value.trim();
    if (!text) return;

    const datetime = this.parseFlexibleDateTime(text);
    if (datetime) {
      this.onDateTimeParsed(datetime);
      this.showSuccess();
    } else {
      this.showError();
    }
  }

  parseFlexibleDateTime(text) {
    if (text.toLowerCase() === 'now') {
      return new Date();
    }

    const customParsed = this.parseCustomFormat(text);
    if (customParsed) return customParsed;

    // Use chrono-node for natural language parsing
    const results = chrono.parse(text);
    if (results.length > 0) {
      return results[0].start.date();
    }

    return null;
  }

  parseCustomFormat(text) {
    const cleanText = text.replace(/\s+/g, '').toLowerCase();

    const pattern1 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})$/;
    const match1 = cleanText.match(pattern1);
    if (match1) {
      const [, month, day, year, hours, minutes] = match1;
      return new Date(year, month - 1, day, hours, minutes, 0);
    }

    const pattern2 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$/;
    const match2 = cleanText.match(pattern2);
    if (match2) {
      const [, month, day, year, hours, minutes, seconds] = match2;
      return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    const pattern3 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(am|pm)$/;
    const match3 = cleanText.match(pattern3);
    if (match3) {
      let [, month, day, year, hours, minutes, ampm] = match3;
      hours = parseInt(hours);
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return new Date(year, month - 1, day, hours, minutes, 0);
    }

    const pattern4 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(am|pm)$/;
    const match4 = cleanText.match(pattern4);
    if (match4) {
      let [, month, day, year, hours, minutes, seconds, ampm] = match4;
      hours = parseInt(hours);
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return new Date(year, month - 1, day, hours, minutes, seconds);
    }

    return null;
  }

  showSuccess() {
    this.input.style.borderColor = 'green';
    setTimeout(() => this.input.style.borderColor = '', 1000);
  }

  showError() {
    this.input.style.borderColor = 'red';
    setTimeout(() => this.input.style.borderColor = '', 2000);
  }
}

export class UIManager {
  constructor(updateCallback) {
    this.updateCallback = updateCallback;
    this.currentLatitude = 0;
    this.currentLongitude = 0;
    this.currentTime = 720;
    this.currentDay = 1;
    this.currentYear = 2000;

    this.elements = {};
    this.initializeElements();
    this.setupEventListeners();
  }

  initializeElements() {
    this.elements = {
      latSlider: document.getElementById('latSlider'),
      latValue: document.getElementById('latValue'),
      latInput: document.getElementById('latInput'),
      lonSlider: document.getElementById('lonSlider'),
      lonValue: document.getElementById('lonValue'),
      lonInput: document.getElementById('lonInput'),
      timeSlider: document.getElementById('timeSlider'),
      timeValue: document.getElementById('timeValue'),
      daySlider: document.getElementById('daySlider'),
      dayValue: document.getElementById('dayValue'),
      datetimeInput: document.getElementById('datetimeInput'),
      nowButton: document.getElementById('nowButton'),
      locationInput: document.getElementById('locationInput'),
      starfieldToggle: document.getElementById('starfieldToggle')
    };
  }

  setupEventListeners() {
    // Latitude slider
    this.elements.latSlider.addEventListener('input', () => {
      this.currentLatitude = parseFloat(this.elements.latSlider.value);
      this.elements.latValue.textContent = this.currentLatitude.toFixed(1) + "°";
      this.elements.latInput.value = this.currentLatitude.toFixed(4);
      this.updateCallback();
    });

    // Longitude slider
    this.elements.lonSlider.addEventListener('input', () => {
      this.currentLongitude = parseFloat(this.elements.lonSlider.value);
      this.elements.lonValue.textContent = this.currentLongitude.toFixed(1) + "°";
      this.elements.lonInput.value = this.currentLongitude.toFixed(4);
      this.updateCallback();
    });

    // Time slider
    this.elements.timeSlider.addEventListener('input', () => {
      this.currentTime = parseFloat(this.elements.timeSlider.value);
      let h = Math.floor(this.currentTime / 60);
      let m = this.currentTime % 60;
      this.elements.timeValue.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const jd = this.currentDay + (this.currentTime / 1440);
      this.elements.dayValue.textContent = `Day ${jd.toFixed(4)}: ${this.dayToStr(this.currentDay, this.currentYear)}`;
      this.updateCallback();
    });

    // Day slider
    this.elements.daySlider.addEventListener('input', () => {
      this.currentDay = parseFloat(this.elements.daySlider.value);
      const jd = this.currentDay + (this.currentTime / 1440);
      this.elements.dayValue.textContent = `Day ${jd.toFixed(4)}: ${this.dayToStr(this.currentDay, this.currentYear)}`;
      this.updateCallback();
    });

    // Lat/Lon text inputs
    this.elements.latInput.addEventListener('blur', () => this.parseLatInput());
    this.elements.latInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.parseLatInput();
      }
    });

    this.elements.lonInput.addEventListener('blur', () => this.parseLonInput());
    this.elements.lonInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.parseLonInput();
      }
    });
  }

  parseLatInput() {
    const value = parseFloat(this.elements.latInput.value);
    if (!isNaN(value)) {
      const clamped = Math.max(-66, Math.min(66, value));
      this.currentLatitude = clamped;
      this.elements.latSlider.value = clamped;
      this.elements.latValue.textContent = clamped.toFixed(1) + "°";
      this.elements.latInput.value = clamped.toFixed(4);
      this.elements.latInput.style.borderColor = 'green';
      setTimeout(() => this.elements.latInput.style.borderColor = '', 1000);
      this.updateCallback();
    } else {
      this.elements.latInput.style.borderColor = 'red';
      setTimeout(() => this.elements.latInput.style.borderColor = '', 2000);
    }
  }

  parseLonInput() {
    const value = parseFloat(this.elements.lonInput.value);
    if (!isNaN(value)) {
      const clamped = Math.max(-180, Math.min(180, value));
      this.currentLongitude = clamped;
      this.elements.lonSlider.value = clamped;
      this.elements.lonValue.textContent = clamped.toFixed(1) + "°";
      this.elements.lonInput.value = clamped.toFixed(4);
      this.elements.lonInput.style.borderColor = 'green';
      setTimeout(() => this.elements.lonInput.style.borderColor = '', 1000);
      this.updateCallback();
    } else {
      this.elements.lonInput.style.borderColor = 'red';
      setTimeout(() => this.elements.lonInput.style.borderColor = '', 2000);
    }
  }

  dayToStr(day, year) {
    const md = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let d = day;
    for (let i = 0; i < 12; i++) {
      if (d <= md[i]) return `${mn[i]} ${d}, ${year}`;
      d -= md[i];
    }
    return `Dec 31, ${year}`;
  }

  updateSlidersFromDate(date) {
    const month = date.getMonth();
    const day = date.getDate();
    const year = date.getFullYear();

    console.log('updateSlidersFromDate called with year:', year);
    this.currentYear = year;
    console.log('this.currentYear set to:', this.currentYear);

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const monthDays = isLeapYear
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let dayOfYear = day;
    for (let i = 0; i < month; i++) {
      dayOfYear += monthDays[i];
    }

    this.elements.daySlider.value = dayOfYear;
    this.currentDay = dayOfYear;

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    this.elements.timeSlider.value = timeInMinutes;
    this.currentTime = timeInMinutes;
    this.elements.timeValue.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const jd = this.currentDay + (this.currentTime / 1440);
    this.elements.dayValue.textContent = `Day ${jd.toFixed(4)}: ${monthNames[month]} ${day}, ${year}`;

    this.updateCallback();
    this.saveStateToURL();
  }

  initialize() {
    this.currentLatitude = parseFloat(this.elements.latSlider.value);
    this.currentLongitude = parseFloat(this.elements.lonSlider.value);
    this.currentTime = parseFloat(this.elements.timeSlider.value);
    this.currentDay = parseFloat(this.elements.daySlider.value);
    this.currentYear = 2000;

    this.elements.latValue.textContent = this.currentLatitude.toFixed(1) + "°";
    this.elements.lonValue.textContent = this.currentLongitude.toFixed(1) + "°";
    this.elements.latInput.value = this.currentLatitude.toFixed(4);
    this.elements.lonInput.value = this.currentLongitude.toFixed(4);

    let h = Math.floor(this.currentTime / 60);
    let m = this.currentTime % 60;
    this.elements.timeValue.textContent = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

    const jd = this.currentDay + (this.currentTime / 1440);
    this.elements.dayValue.textContent = `Day ${jd.toFixed(4)}: ${this.dayToStr(this.currentDay, this.currentYear)}`;
  }

  saveStateToURL() {
    const params = new URLSearchParams();

    const datetimeValue = this.elements.datetimeInput.value.trim();
    if (datetimeValue) {
      params.set('dt', datetimeValue);
    }

    const locationValue = this.elements.locationInput.value.trim();
    if (locationValue) {
      params.set('loc', locationValue);
    }

    window.history.replaceState({}, '', `#${params.toString()}`);
  }

  loadStateFromURL(parser) {
    const hash = window.location.hash.substring(1);
    if (!hash) return false;

    window.isLoadingFromURL = true;
    const params = new URLSearchParams(hash);
    let hasState = false;

    if (params.has('dt')) {
      const datetimeValue = params.get('dt');
      this.elements.datetimeInput.value = datetimeValue;

      const datetime = parser.parseFlexibleDateTime(datetimeValue);
      if (datetime) {
        this.updateSlidersFromDate(datetime);
        hasState = true;
      }
    }

    if (params.has('loc')) {
      const locationValue = params.get('loc');
      this.elements.locationInput.value = locationValue;

      (async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationValue)}&limit=1&addressdetails=1`;
          const response = await fetch(url, {
            headers: { 'User-Agent': 'ArmillarySphere/1.0' }
          });
          const places = await response.json();

          if (places.length > 0) {
            const lat = parseFloat(places[0].lat);
            const lon = parseFloat(places[0].lon);

            const clampedLat = Math.max(-66, Math.min(66, lat));
            this.currentLatitude = clampedLat;
            this.elements.latSlider.value = clampedLat;
            this.elements.latInput.value = clampedLat.toFixed(4);
            this.elements.latValue.textContent = clampedLat.toFixed(1) + "°";

            const clampedLon = Math.max(-180, Math.min(180, lon));
            this.currentLongitude = clampedLon;
            this.elements.lonSlider.value = clampedLon;
            this.elements.lonInput.value = clampedLon.toFixed(4);
            this.elements.lonValue.textContent = clampedLon.toFixed(1) + "°";

            this.updateCallback();
            this.saveStateToURL();

            setTimeout(() => { window.isLoadingFromURL = false; }, 500);
          }
        } catch (error) {
          console.error('Failed to load location from URL:', error);
          setTimeout(() => { window.isLoadingFromURL = false; }, 500);
        }
      })();

      hasState = true;
    } else {
      window.isLoadingFromURL = false;
    }

    return hasState;
  }
}

export function initializeLocationAutocomplete(uiManager, updateCallback) {
  const maxResults = 20;
  const locationInput = document.querySelector("#locationInput");

  if (locationInput) {
    new autoComplete({
      debounce: 300,
      selector: "#locationInput",
      data: {
        src: async () => {
          const query = document.querySelector("#locationInput").value;
          if (query === "" || query.length < 3) {
            return;
          }

          try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=${maxResults}&addressdetails=1`;
            const response = await fetch(url, {
              headers: { 'User-Agent': 'ArmillarySphere/1.0' }
            });
            const places = await response.json();
            return places.map((place) => ({
              name: place.display_name,
              lat: parseFloat(place.lat),
              lon: parseFloat(place.lon),
            }));
          } catch (error) {
            console.error('Geocoding error:', error);
            return [];
          }
        },
        keys: ["name", "lat", "lon"],
      },
      resultsList: {
        maxResults: maxResults,
      },
      resultItem: {
        highlight: true,
      },
      shouldCacheSrc: false,
      events: {
        input: {
          selection(event) {
            if (window.isLoadingFromURL) {
              return;
            }

            const feedback = event.detail;
            const selection = feedback.selection.value[feedback.selection.key];

            document.querySelector("#locationInput").value = selection;

            const latField = document.querySelector("#latInput");
            const lat = feedback.selection.value.lat;
            latField.value = lat.toFixed(4);

            const latSlider = document.querySelector("#latSlider");
            const clampedLat = Math.max(-66, Math.min(66, lat));
            latSlider.value = clampedLat;
            uiManager.currentLatitude = clampedLat;
            document.getElementById('latValue').textContent = clampedLat.toFixed(1) + "°";

            const lonField = document.querySelector("#lonInput");
            const lon = feedback.selection.value.lon;
            lonField.value = lon.toFixed(4);

            const lonSlider = document.querySelector("#lonSlider");
            const clampedLon = Math.max(-180, Math.min(180, lon));
            lonSlider.value = clampedLon;
            uiManager.currentLongitude = clampedLon;
            document.getElementById('lonValue').textContent = clampedLon.toFixed(1) + "°";

            latSlider.dispatchEvent(new Event('input'));
            lonSlider.dispatchEvent(new Event('input'));

            updateCallback();
            uiManager.saveStateToURL();
          },
        }
      },
    });
  }
}
