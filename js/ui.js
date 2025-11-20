// ui.js - UI input handling, autocomplete, geocoding, datetime parsing

import * as chrono from 'chrono-node';
import { DateTime } from 'luxon';

export class DateTimeParser {
  constructor(inputElement, onDateTimeParsed, getTimezone) {
    this.input = inputElement;
    this.onDateTimeParsed = onDateTimeParsed;
    this.getTimezone = getTimezone; // Function to get current timezone
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
      const date = results[0].start.date();

      // If we have timezone info, use Luxon to parse in that timezone
      const timezone = this.getTimezone ? this.getTimezone() : null;
      if (timezone) {
        // Create DateTime in the specific timezone using the parsed components
        const dt = DateTime.fromObject({
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes(),
          second: date.getSeconds()
        }, { zone: timezone });

        console.log('Parsed date:', text, 'in timezone:', timezone, '->', dt.toString(), 'UTC:', dt.toUTC().toString());

        // Convert to UTC and return as naive Date for our calculations
        const utc = dt.toUTC();
        return new Date(Date.UTC(
          utc.year,
          utc.month - 1,
          utc.day,
          utc.hour,
          utc.minute,
          utc.second
        ));
      }

      // Fallback: Convert to naive datetime by extracting local components and treating as UTC
      const naive = new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
      ));
      console.log('Parsed date (no timezone):', text, '->', date.toString(), '-> naive UTC:', naive.toUTCString());
      return naive;
    }

    return null;
  }

  parseCustomFormat(text) {
    const cleanText = text.replace(/\s+/g, '').toLowerCase();
    const timezone = this.getTimezone ? this.getTimezone() : null;

    const pattern1 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})$/;
    const match1 = cleanText.match(pattern1);
    if (match1) {
      const [, month, day, year, hours, minutes] = match1;
      return this.createDateWithTimezone(parseInt(year), parseInt(month), parseInt(day), parseInt(hours), parseInt(minutes), 0, timezone);
    }

    const pattern2 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$/;
    const match2 = cleanText.match(pattern2);
    if (match2) {
      const [, month, day, year, hours, minutes, seconds] = match2;
      return this.createDateWithTimezone(parseInt(year), parseInt(month), parseInt(day), parseInt(hours), parseInt(minutes), parseInt(seconds), timezone);
    }

    const pattern3 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(am|pm)$/;
    const match3 = cleanText.match(pattern3);
    if (match3) {
      let [, month, day, year, hours, minutes, ampm] = match3;
      hours = parseInt(hours);
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      const result = this.createDateWithTimezone(parseInt(year), parseInt(month), parseInt(day), hours, parseInt(minutes), 0, timezone);
      console.log('Parsed custom format:', text, timezone ? `in timezone: ${timezone}` : '-> naive UTC:', result.toUTCString());
      return result;
    }

    const pattern4 = /^(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(am|pm)$/;
    const match4 = cleanText.match(pattern4);
    if (match4) {
      let [, month, day, year, hours, minutes, seconds, ampm] = match4;
      hours = parseInt(hours);
      if (ampm === 'pm' && hours !== 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      return this.createDateWithTimezone(parseInt(year), parseInt(month), parseInt(day), hours, parseInt(minutes), parseInt(seconds), timezone);
    }

    return null;
  }

  createDateWithTimezone(year, month, day, hours, minutes, seconds, timezone) {
    if (timezone) {
      // Use Luxon to create date in specific timezone
      const dt = DateTime.fromObject({
        year,
        month,
        day,
        hour: hours,
        minute: minutes,
        second: seconds
      }, { zone: timezone });

      // Convert to UTC
      const utc = dt.toUTC();
      return new Date(Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute, utc.second));
    } else {
      // Fallback: treat as naive UTC
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    }
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
    this.currentTime = 720; // Universal Time (UT) in minutes for calculations
    this.currentDay = 1;
    this.currentYear = 2000;
    this.currentTimezone = null; // IANA timezone name (e.g., 'America/Anchorage')

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
      siderealCheckbox: this.createSiderealCheckbox(),
      daySlider: document.getElementById('daySlider'),
      dayValue: document.getElementById('dayValue'),
      datetimeInput: document.getElementById('datetimeInput'),
      nowButton: document.getElementById('nowButton'),
      locationInput: document.getElementById('locationInput'),
      starfieldToggle: document.getElementById('starfieldToggle')
    };
  }

  createSiderealCheckbox() {
    const container = document.createElement('div');
    container.style.marginTop = '10px';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'siderealMode';
    
    const label = document.createElement('label');
    label.htmlFor = 'siderealMode';
    label.textContent = ' Sidereal Mode (Fagan-Bradley)';
    label.style.color = 'white';
    label.style.marginLeft = '5px';
    
    container.appendChild(checkbox);
    container.appendChild(label);
    
    // Append to controls area - assuming latSlider's parent is the controls container
    const parent = document.getElementById('latSlider')?.parentNode;
    if (parent) {
      parent.appendChild(container);
    }
    
    return checkbox;
  }

  setupEventListeners() {
    // Sidereal checkbox
    if (this.elements.siderealCheckbox) {
      this.elements.siderealCheckbox.addEventListener('change', () => {
        this.updateCallback();
      });
    }

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

      // Update day display
      if (this.currentTimezone) {
        const { month, day } = this.dayOfYearToMonthDay(this.currentDay, this.currentYear);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.elements.dayValue.textContent = `${monthNames[month]} ${day}, ${this.currentYear} (local)`;
      } else {
        this.elements.dayValue.textContent = this.dayToStr(this.currentDay, this.currentYear);
      }

      this.updateCallback();
    });

    // Day slider
    this.elements.daySlider.addEventListener('input', () => {
      this.currentDay = parseFloat(this.elements.daySlider.value);

      // Update display
      if (this.currentTimezone) {
        const { month, day } = this.dayOfYearToMonthDay(this.currentDay, this.currentYear);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        this.elements.dayValue.textContent = `${monthNames[month]} ${day}, ${this.currentYear} (local)`;
      } else {
        const jd = this.currentDay + (this.currentTime / 1440);
        this.elements.dayValue.textContent = `Day ${jd.toFixed(4)}: ${this.dayToStr(this.currentDay, this.currentYear)}`;
      }

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

  dayOfYearToMonthDay(dayOfYear, year) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
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

    return { month, day }; // month is 0-based (0=Jan, 11=Dec)
  }

  updateSlidersFromDate(date) {
    // Use UTC methods to extract components
    const utcMonth = date.getUTCMonth();
    const utcDay = date.getUTCDate();
    const utcYear = date.getUTCFullYear();
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();

    // If we have a timezone, convert to local time and store LOCAL values in sliders
    if (this.currentTimezone) {
      const dt = DateTime.fromJSDate(date, { zone: 'UTC' }).setZone(this.currentTimezone);

      this.currentYear = dt.year;

      // Calculate LOCAL day-of-year
      const isLeapYear = (dt.year % 4 === 0 && dt.year % 100 !== 0) || (dt.year % 400 === 0);
      const monthDays = isLeapYear
        ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      let localDayOfYear = dt.day;
      for (let i = 0; i < dt.month - 1; i++) {
        localDayOfYear += monthDays[i];
      }

      this.currentDay = localDayOfYear;  // LOCAL day-of-year
      this.elements.daySlider.value = localDayOfYear;

      // Store LOCAL time
      const localTimeInMinutes = dt.hour * 60 + dt.minute;
      this.currentTime = localTimeInMinutes;  // LOCAL time
      this.elements.timeSlider.value = localTimeInMinutes;
      this.elements.timeValue.textContent = `${dt.hour.toString().padStart(2, '0')}:${dt.minute.toString().padStart(2, '0')}`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      this.elements.dayValue.textContent = `${monthNames[dt.month - 1]} ${dt.day}, ${dt.year} (local)`;

      console.log('Set to local time:', `${dt.hour}:${dt.minute}`, `day ${dt.day}`, 'in timezone:', this.currentTimezone);
    } else {
      // No timezone - work in UTC/naive time
      this.currentYear = utcYear;

      const isLeapYear = (utcYear % 4 === 0 && utcYear % 100 !== 0) || (utcYear % 400 === 0);
      const monthDays = isLeapYear
        ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      let dayOfYear = utcDay;
      for (let i = 0; i < utcMonth; i++) {
        dayOfYear += monthDays[i];
      }

      this.currentDay = dayOfYear;
      this.elements.daySlider.value = dayOfYear;

      const utcTimeInMinutes = utcHours * 60 + utcMinutes;
      this.currentTime = utcTimeInMinutes;
      this.elements.timeSlider.value = utcTimeInMinutes;
      this.elements.timeValue.textContent = `${utcHours.toString().padStart(2, '0')}:${utcMinutes.toString().padStart(2, '0')}`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      this.elements.dayValue.textContent = `${monthNames[utcMonth]} ${utcDay}, ${utcYear}`;
    }

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

  setTimeFromLocalString(datetimeString) {
    // Parse datetime string and set slider values directly
    // The values represent LOCAL time at the chart's location
    // Handles formats: "1979-05-08 10:57:00", "1979-05-08T10:57:00", "1979-05-08 10:57"
    const normalized = datetimeString.replace(' ', 'T');

    // Match datetime components
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
      console.error('Failed to parse datetime:', datetimeString);
      return;
    }

    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    const hour = parseInt(match[4]);
    const minute = parseInt(match[5]);

    console.log('Setting time from local string:', { year, month, day, hour, minute });

    // Calculate day of year
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    const monthDays = isLeapYear
      ? [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
      : [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    let dayOfYear = day;
    for (let i = 0; i < month - 1; i++) {
      dayOfYear += monthDays[i];
    }

    // Set year (stored internally)
    this.currentYear = year;

    // Set day slider
    this.currentDay = dayOfYear;
    this.elements.daySlider.value = dayOfYear;
    this.elements.dayValue.textContent = `Day ${dayOfYear}: ${this.dayToStr(dayOfYear, year)}`;

    // Set time slider (minutes since midnight)
    const timeInMinutes = hour * 60 + minute;
    this.currentTime = timeInMinutes;
    this.elements.timeSlider.value = timeInMinutes;
    this.elements.timeValue.textContent = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    console.log('Set sliders to:', { year, dayOfYear, timeInMinutes });
  }

  loadFromCalcParams(queryParams, parser) {
    window.isLoadingFromURL = true;
    console.log('Loading from Rails calc_params');

    const datetime = queryParams.get('calc[datetime]');
    const lat = queryParams.get('calc[lat]');
    const lon = queryParams.get('calc[lon]');
    const location = queryParams.get('calc[location]');
    const timezone = queryParams.get('calc[timezone]');

    console.log('Received calc_params:', { datetime, lat, lon, location, timezone });

    // Set location name if provided
    if (location) {
      this.elements.locationInput.value = location;
    }

    // Set timezone if provided
    if (timezone) {
      this.currentTimezone = timezone;
      console.log('Set timezone from calc_params:', timezone);
    }

    // Set datetime if provided
    if (datetime) {
      this.elements.datetimeInput.value = datetime;
      console.log('Loading datetime from calc_params:', datetime);
    }

    // Set lat/lon if provided
    if (lat && lon) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      console.log('Parsed lat/lon:', { latitude, longitude });

      const clampedLat = Math.max(-66, Math.min(66, latitude));
      this.currentLatitude = clampedLat;
      this.elements.latSlider.value = clampedLat;
      this.elements.latInput.value = clampedLat.toFixed(4);
      this.elements.latValue.textContent = clampedLat.toFixed(1) + "°";

      const clampedLon = Math.max(-180, Math.min(180, longitude));
      this.currentLongitude = clampedLon;
      this.elements.lonSlider.value = clampedLon;
      this.elements.lonInput.value = clampedLon.toFixed(4);
      this.elements.lonValue.textContent = clampedLon.toFixed(1) + "°";
    }

    // Parse the datetime and update the visualization
    if (datetime) {
      // Strip timezone offset from Rails datetime string (e.g., "1979-05-08 10:57:00 +0000")
      // The datetime represents LOCAL time at the chart's location
      const datetimeWithoutTz = datetime.replace(/\s*[+-]\d{4}\s*$/, '').trim();
      console.log('Datetime without timezone:', datetimeWithoutTz);

      // Parse the datetime components directly and set sliders
      // Rails sends datetime like "1979-05-08 10:57:00" in LOCAL time
      // We set the slider values directly without timezone conversion
      this.setTimeFromLocalString(datetimeWithoutTz);
    }

    // Always trigger a visualization update after loading calc_params
    // This ensures lat/lon and datetime are all applied
    console.log('Triggering visualization update');
    this.updateCallback();

    setTimeout(() => { window.isLoadingFromURL = false; }, 500);

    return true;
  }

  loadStateFromURL(parser) {
    // First check for Rails calc_params in query string
    const queryParams = new URLSearchParams(window.location.search);
    const hasCalcParams = queryParams.has('calc[datetime]') || queryParams.has('calc[lat]') || queryParams.has('calc[lon]');

    if (hasCalcParams) {
      return this.loadFromCalcParams(queryParams, parser);
    }

    // Fall back to hash-based URL state
    const hash = window.location.hash.substring(1);
    if (!hash) return false;

    window.isLoadingFromURL = true;
    const params = new URLSearchParams(hash);
    let hasState = false;
    let datetimeString = null;

    if (params.has('dt')) {
      datetimeString = params.get('dt');
      console.log('Loading datetime from URL:', datetimeString);
      this.elements.datetimeInput.value = datetimeString;
      hasState = true;
    }

    if (params.has('loc')) {
      const locationValue = params.get('loc');
      this.elements.locationInput.value = locationValue;

      (async () => {
        try {
          // First geocode to get lat/lon from Nominatim
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationValue)}&limit=1&addressdetails=1`;
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'ArmillarySphere/1.0' }
          });
          const places = await geocodeResponse.json();

          if (places.length > 0) {
            const lat = parseFloat(places[0].lat);
            const lon = parseFloat(places[0].lon);

            // Then reverse geocode with Geoapify to get timezone
            const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
            if (apiKey) {
              const reverseUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&format=json&apiKey=${apiKey}`;
              try {
                const reverseResponse = await fetch(reverseUrl);
                const reverseData = await reverseResponse.json();
                if (reverseData.results && reverseData.results[0] && reverseData.results[0].timezone) {
                  this.currentTimezone = reverseData.results[0].timezone.name;
                  console.log('Timezone from Geoapify:', this.currentTimezone);
                }
              } catch (tzError) {
                console.warn('Failed to fetch timezone from Geoapify:', tzError);
                this.currentTimezone = null;
              }
            } else {
              console.warn('VITE_GEOAPIFY_API_KEY not set in .env file');
              this.currentTimezone = null;
            }

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

            // Now that we have the location and timezone, update the datetime
            if (datetimeString) {
              // Don't reparse - we already have it from before, but now timezone is set
              // The parsing should happen after this point when user types
              const parsedDatetime = parser.parseFlexibleDateTime(datetimeString);
              this.updateSlidersFromDate(parsedDatetime);
            } else {
              // If no datetime string, we still need to update once for location change
              this.updateCallback();
            }

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
      // No location to geocode
      window.isLoadingFromURL = false;
      // Parse datetime without timezone info (fallback to naive)
      if (datetimeString) {
        const parsedDatetime = parser.parseFlexibleDateTime(datetimeString);
        this.updateSlidersFromDate(parsedDatetime);
      }
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
          async selection(event) {
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

            // Fetch timezone for this location
            const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY;
            if (apiKey) {
              try {
                const reverseUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&format=json&apiKey=${apiKey}`;
                const reverseResponse = await fetch(reverseUrl);
                const reverseData = await reverseResponse.json();
                if (reverseData.results && reverseData.results[0] && reverseData.results[0].timezone) {
                  uiManager.currentTimezone = reverseData.results[0].timezone.name;
                  console.log('Timezone from Geoapify (autocomplete):', uiManager.currentTimezone);
                }
              } catch (tzError) {
                console.warn('Failed to fetch timezone from Geoapify:', tzError);
                uiManager.currentTimezone = null;
              }
            } else {
              console.warn('VITE_GEOAPIFY_API_KEY not set in .env file');
              uiManager.currentTimezone = null;
            }

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
