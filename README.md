# Armillary Sphere - ASC/MC Visualization

An interactive 3D visualization of the celestial sphere showing astrological angles (Ascendant, Midheaven) and astronomical phenomena using Three.js.

## Overview

This project provides a real-time 3D visualization of the armillary sphere - an ancient astronomical instrument used to model the celestial sphere. It calculates and displays key astrological angles (MC/Midheaven and AC/Ascendant) along with sunrise and sunset times for any location, date, and time.

## Features

- **3D Interactive Celestial Sphere**
  - Celestial equator and ecliptic plane
  - Zodiac signs with glyphs
  - Horizon, meridian, and prime vertical planes
  - Celestial poles (North/South)
  - Compass directions (N, S, E, W)

- **Astrological Calculations**
  - Midheaven (MC) and Imum Coeli (IC)
  - Ascendant (AC) and Descendant (DSC)
  - Local Sidereal Time (LST)
  - Zodiac notation (degrees, signs, minutes)

- **Astronomical Features**
  - Real sun position based on date
  - Sunrise and sunset times
  - Accurate ephemeris calculations
  - Local solar time adjustments

- **Flexible Date/Time Input**
  - Natural language parsing ("now", "March 21 2000 noon", "tomorrow at sunrise")
  - Custom format support (MMDDYYYYHHMM)
  - Interactive sliders for fine-tuning

- **Location Controls**
  - Latitude and longitude sliders
  - Direct numeric input
  - Visual representation of observer's position

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Open `index.html` in a modern web browser

## Usage

### Date and Time

- **Natural Language Input**: Type expressions like:
  - `now` - Current date and time
  - `March 21 2000 noon` - Specific date and time
  - `2000-03-21 12:00` - ISO format

- **Now Button**: Click to set current date/time instantly

- **Time Slider**: Adjust time of day (00:00 - 23:59)

- **Day Slider**: Change day of year (1-365)

### Location

- **Latitude Slider**: Set observer latitude (-66° to +66°)
  - Positive values: Northern hemisphere
  - Negative values: Southern hemisphere

- **Longitude Slider**: Set observer longitude (-180° to +180°)
  - Positive values: East
  - Negative values: West

- **Direct Input**: Type latitude/longitude values directly and press Enter

### 3D View Controls

- **Rotate**: Left-click and drag
- **Zoom**: Scroll wheel or pinch
- **Pan**: Right-click and drag (or two-finger drag on trackpad)

## Display Information

### Top-Right Panel
- **LST**: Local Sidereal Time (HH:MM format)
- **MC**: Midheaven in zodiac notation (e.g., "15♈30")
- **AC**: Ascendant in zodiac notation

### Bottom-Left Panel
- **Sunrise**: Local sunrise time
- **Sunset**: Local sunset time

## Technical Details

### Technologies Used

- **Three.js** (v0.158.0) - 3D graphics library
- **OrbitControls** - Camera control system
- **chrono-node** - Natural language date/time parsing
- **Moshier Ephemeris** - High-precision astronomical calculations

### Calculations

The visualization uses traditional astrological formulas:

- **MC Formula**: tan(MC) = tan(LST) / cos(ε)
  - Where ε is the obliquity of the ecliptic (23.44°)

- **AC Formula**: tan(AC) = -cos(LST) / (sin(LST)×cos(ε) + tan(lat)×sin(ε))

- **LST Calculation**: Based on J2000 epoch with longitude adjustments

- **Sunrise/Sunset**: Calculated using sun's equatorial coordinates with atmospheric refraction and angular diameter corrections

### Coordinate Systems

The visualization uses multiple coordinate systems:

1. **Ecliptic Coordinates**: Zodiac-based, with sun moving along the ecliptic
2. **Equatorial Coordinates**: Based on celestial equator and poles
3. **Horizon Coordinates**: Observer-centric (altitude/azimuth)

## File Structure

```
armillary/
├── index.html              # Main application file
├── package.json           # Node.js dependencies
├── ephemeris-1.2.1.bundle.js  # Moshier ephemeris library
└── node_modules/          # Installed dependencies
    └── chrono-node/       # Date parsing library
```

## Browser Compatibility

Requires a modern browser with support for:
- ES6 modules
- Import maps
- WebGL
- Canvas API

Tested on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Limitations

- Latitude range limited to ±66° to avoid polar singularities
- Year fixed to 2000 for simplified calculations (leap year)
- Does not account for precession of equinoxes
- Local time assumes simplified solar time (not timezone-aware)

## Future Enhancements

Potential improvements:
- Support for any year with full calendar
- Additional celestial bodies (Moon, planets)
- House system calculations
- Export/save chart functionality
- Mobile-responsive design
- Timezone support

## License

This project is provided as-is for educational and astronomical purposes.

## Acknowledgments

- Three.js community
- Moshier Ephemeris library
- chrono-node for natural language date parsing
