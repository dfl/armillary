# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an interactive 3D armillary sphere visualization built with Three.js that displays celestial coordinates, astrological angles (Ascendant/Midheaven), and astronomical phenomena (sun/moon positions, sunrise/sunset times). The application runs entirely in the browser and uses Vite as the development server and build tool.

## Development Commands

### Running the Development Server
```bash
npm run dev
```
Starts Vite dev server on port 8080 with hot module replacement. The browser opens automatically.

### Building for Production
```bash
npm run build
```
Outputs to `dist/` directory.

### Preview Production Build
```bash
npm run preview
```

## Architecture Overview

### Core Module Structure

The codebase is organized into four main modules in the `js/` directory:

1. **main.js** - Application entry point
   - Orchestrates initialization of all components
   - Connects UI updates to 3D scene updates via `updateVisualization()` callback
   - Handles timezone-aware UTC conversions between local and universal time
   - Manages state synchronization between UI sliders and astronomical calculations

2. **scene.js (ArmillaryScene)** - Three.js 3D rendering
   - Manages the entire 3D scene, camera, renderer, and OrbitControls
   - Contains two coordinate system groups:
     - `celestial` group: Represents the celestial equator and rotates based on LST and observer latitude
     - `zodiacGroup`: Child of celestial, tilted by obliquity to represent the ecliptic plane
   - Rotation order is critical: 'ZXY' for celestial sphere (Z=LST spin, X=latitude tilt, Y=azimuth)
   - Renders fixed references (horizon, meridian, compass rose), celestial equator, ecliptic with zodiac wheel, starfield with constellations, sun/moon, and angle markers (MC/IC/ASC/DSC)
   - `updateSphere()` is called whenever astronomical state changes

3. **astronomy.js (AstronomyCalculator)** - Astronomical calculations
   - All calculations use radians internally, converting to/from degrees at boundaries
   - `calculateLST()`: Computes Local Sidereal Time from Julian Date using GMST formula
   - `calculateMC()`: Midheaven using `atan2(sin(LST), cos(LST)*cos(obliquity))`
   - `calculateAscendant()`: Ascendant using equatorial-to-ecliptic conversion
   - `calculateSunPosition()`: Uses ephemeris library for accurate sun position; falls back to mean-sun approximation
   - `calculateMoonPosition()`: Similar to sun, using ephemeris with fallback
   - `calculateRiseSet()`: Iterative algorithm searching through each minute of the day to find horizon crossings (altitude = -0.833°)
   - Coordinate transformations: `eclipticToEquatorial()` and `equatorialToHorizontal()`
   - Uses epsilon.js for precise obliquity calculations

4. **ui.js** - UI management and user input
   - **DateTimeParser**: Parses natural language dates using chrono-node library, supports custom formats (MMDDYYYYHHMM), handles timezone-aware parsing with Luxon
   - **UIManager**: Manages all UI controls (sliders, text inputs), maintains current state (lat/lon/time/day/year/timezone), converts between day-of-year and calendar dates
   - **initializeLocationAutocomplete**: Uses Nominatim for geocoding and Geoapify API for timezone lookup (requires VITE_GEOAPIFY_API_KEY in .env)
   - URL state management: Saves/loads state to URL hash parameters for sharing

### Coordinate Systems and Rotations

The visualization uses multiple nested coordinate systems that are critical to understand:

- **Horizon System**: Fixed to observer (horizon plane at y=0, zenith at +y)
- **Celestial Equator**: Rotates with LST and tilts with latitude (the `celestial` group)
  - Rotation order 'ZXY': first spin by LST (Z), then tilt by latitude (X), orient by azimuth (Y)
  - Phase shift: -π/2 on Z rotation to align 0° Aries from +X to +Y (meridian)
- **Ecliptic System**: Tilted from equator by obliquity (the `zodiacGroup` within `celestial`)
  - Rotation order 'XYZ': tilted by obliquity on X-axis
  - Zodiac glyphs placed at 30° intervals with proper orientation

The key insight: objects placed in `zodiacGroup` are positioned in ecliptic coordinates, then automatically transformed through obliquity tilt → LST rotation → latitude tilt to reach their final world positions.

### Time and Timezone Handling

- **Internal representation**: All times stored as UTC minutes since midnight (0-1439)
- **UI display**: Shows local time when timezone is set, otherwise shows UTC
- **Conversions**: main.js converts local time to UTC before passing to astronomy calculations
- **Timezone source**: Retrieved from Geoapify API when location is selected
- When timezone is set, sliders show LOCAL time/day but calculations use UTC
- `updateVisualization()` in main.js handles the local-to-UTC conversion using Luxon

### Data Flow

1. User input (sliders/text) → UIManager updates state → calls `updateCallback()`
2. `updateCallback` → `updateVisualization()` in main.js → converts local to UTC if timezone set
3. UTC values → `scene.updateSphere(astroCalc, lat, lon, utcTime, utcDay, utcYear, timezone)`
4. `updateSphere()` → calls `astroCalc` methods → calculates LST, angles, sun/moon positions
5. Results → update 3D object positions and rotations → update UI display elements

## Key Dependencies

- **three** (^0.181.1): 3D graphics library with OrbitControls
- **ephemeris** (^2.2.0): High-precision astronomical calculations for sun/moon/planet positions
- **chrono-node** (^2.9.0): Natural language date/time parsing
- **luxon** (^3.7.2): Timezone-aware date/time handling
- **@tarekraafat/autocomplete.js** (^10.2.9): Location search autocomplete (loaded via CDN)

## Environment Variables

Create a `.env` file in the project root:

```
VITE_GEOAPIFY_API_KEY=your_api_key_here
```

Required for timezone lookups when selecting locations. Without this key, the app will still work but won't have timezone information (will use longitude offset approximation).

## Important Implementation Details

### Astronomical Accuracy
- Year is user-configurable (stored in `currentYear`)
- Obliquity is calculated precisely for the Julian Date using epsilon.js
- Sunrise/sunset accounts for atmospheric refraction (0.567°) and sun's angular radius (0.267°)
- The ephemeris library provides high-precision positions; fallbacks exist if it fails

### Southern Hemisphere Handling
When latitude < 0, the Ascendant and Descendant are flipped by 180° to maintain correct orientation.

### Leap Year Handling
Properly handles leap years throughout the codebase using the standard formula: `(year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)`

### Starfield
- Stars loaded from stardata.js with RA/Dec coordinates, magnitude, and constellation info
- Multiple glow layers for realistic appearance using additive blending
- Constellation lines connect named stars
- Background point cloud of 1000 random stars
- Hover detection shows star name and constellation

### URL State Persistence
State is saved to URL hash with parameters:
- `dt`: datetime string (e.g., "now", "March 21 2000 noon")
- `loc`: location string (e.g., "New York")

This allows sharing specific configurations via URL.

## Common Development Patterns

### Adding New Celestial Objects
1. Create geometry/material in `scene.js` constructor
2. Add to appropriate group (`celestial` for equatorial, `zodiacGroup` for ecliptic)
3. Calculate position in `updateSphere()` using astronomical data
4. Update position using `placeOnZodiac(degrees)` helper for ecliptic objects

### Adding New Astronomical Calculations
1. Add calculation method to `AstronomyCalculator` class in astronomy.js
2. Follow existing patterns: radians internally, degrees at API boundaries
3. Call from `updateSphere()` in scene.js
4. Update UI display elements as needed

### Modifying Time/Date Handling
- Remember: `currentTime` and `currentDay` in UIManager represent LOCAL time when timezone is set
- Always convert to UTC in main.js before passing to astronomical calculations
- Use Luxon for timezone conversions, not native Date object methods
- Test with locations in different timezones and across date boundaries

## Code Style Notes

- Uses ES6 modules with import/export
- Class-based architecture for major components
- Extensive use of Three.js Groups for hierarchical transformations
- Canvas-based textures for text labels (zodiac glyphs, compass labels)
- Consistent use of radians for internal calculations, degrees for UI/API boundaries
