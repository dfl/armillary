// scene.js - 3D scene rendering with Three.js (refactored with modules)

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { starData, constellationLines } from './stardata.js';

// Import scene modules
import ReferenceGeometry from './scene/references.js';
import ZodiacWheel from './scene/zodiac.js';
import CelestialObjects from './scene/celestialObjects.js';
import AngleMarkers from './scene/angles.js';
import LunarNodes from './scene/lunarNodes.js';
import InteractionManager from './scene/interactions.js';
import CameraController from './scene/camera.js';
import PlanetaryReferences from './scene/planetaryReferences.js';

export class ArmillaryScene {
  constructor() {
    // ===================================================================
    // Constants and Configuration
    // ===================================================================
    this.obliquity = 23.44 * Math.PI / 180;
    this.planetZoomFactor = 1.0; // 0 = accurate, 1.0 = max zoom (default)
    this.targetCameraDistance = null; // When set, updateSphere will enforce this distance

    // Proportional scaling constants
    // Real radii: Earth 6371km, Moon 1737km, Sun 696000km
    // Real distances: Moon ~384400km from Earth, Earth 1 AU from Sun
    this.EARTH_RADIUS_KM = 6371;
    this.MOON_RADIUS_KM = 1737;
    this.SUN_RADIUS_KM = 696000;
    this.MOON_DISTANCE_KM = 384400;

    this.PLANET_RADIUS_SCALE = 0.05; // Scale factor to make all bodies visible but not overwhelming
    this.EARTH_RADIUS = 100.0 * this.PLANET_RADIUS_SCALE; // Earth's radius scaled consistently with other planets
    this.CE_RADIUS = this.EARTH_RADIUS * 0.02; // Celestial sphere radius (local horizon visualization scale, 2% of Earth radius)
    this.PLANET_DISTANCE_SCALE = 2000; // Scale factor for planet orbital distances (1 AU = 2000 units)
    this.STAR_FIELD_RADIUS = this.PLANET_DISTANCE_SCALE * 200; // Star field radius (encompassing solar system)

    // View mode threshold: distance at which we switch from Horizon View to Earth View
    // Threshold: 50 units (Earth radius is 5.0, Horizon view camera is ~15 units away)
    this.VIEW_MODE_THRESHOLD = 50.0;

    // Calculate proportional radii (scaled down for visibility)
    this.SUN_RADIUS = this.EARTH_RADIUS * (this.SUN_RADIUS_KM / this.EARTH_RADIUS_KM) * 0.05; // ~109x Earth, scaled
    this.MOON_RADIUS = this.EARTH_RADIUS * (this.MOON_RADIUS_KM / this.EARTH_RADIUS_KM); // ~27.3% Earth
    this.MOON_DISTANCE = 300; // Moon distance from Earth (scaled for visibility, not to scale with radii)

    // Texture paths
    this.EARTH_TEXTURE_PATH = '/armillary/images/earth_texture.jpg';
    this.EARTH_NIGHT_TEXTURE_PATH = '/armillary/images/earth_texture_night.jpg';
    this.SUN_TEXTURE_PATH = '/armillary/images/sun_texture.jpg';
    this.REALISTIC_SUN_TEXTURE_PATH = '/armillary/images/sun_texture_orange.jpg';
    this.MOON_TEXTURE_PATH = '/armillary/images/moon_texture.jpg';
    this.MOON_BUMP_TEXTURE_PATH = '/armillary/images/moon_texture_bump.jpg';
    this.MERCURY_TEXTURE_PATH = '/armillary/images/mercury_texture.jpg';
    this.VENUS_TEXTURE_PATH = '/armillary/images/venus_texture.jpg';
    this.MARS_TEXTURE_PATH = '/armillary/images/mars_texture.jpg';
    this.JUPITER_TEXTURE_PATH = '/armillary/images/jupiter_texture.jpg';
    this.SATURN_TEXTURE_PATH = '/armillary/images/saturn_texture.jpg';
    this.SATURN_RINGS_TEXTURE_PATH = '/armillary/images/saturn_ring_color.jpg';
    this.SATURN_RINGS_ALPHA_PATH = '/armillary/images/saturn_ring_alpha.gif';
    this.URANUS_TEXTURE_PATH = '/armillary/images/uranus_texture.jpg';
    this.NEPTUNE_TEXTURE_PATH = '/armillary/images/neptune_texture.jpg';
    this.PLUTO_TEXTURE_PATH = '/armillary/images/pluto_texture.jpg';

    // ===================================================================
    // Core Three.js Objects
    // ===================================================================
    this.scene = null;
    this.camera = null;
    this.leftCamera = null;
    this.rightCamera = null;
    this.renderer = null;
    this.controls = null;

    // ===================================================================
    // Scene Groups
    // ===================================================================
    this.armillaryRoot = null; // Root group for the observer-centric armillary sphere
    this.earthGroup = null; // Earth mesh group
    this.earthMesh = null; // Earth sphere mesh
    this.tiltGroup = null;
    this.celestial = null;
    this.zodiacGroup = null;

    // ===================================================================
    // Module Instances
    // ===================================================================
    this.references = null;
    this.zodiacWheel = null;
    this.celestialObjects = null;
    this.angleMarkers = null;
    this.interactions = null;
    this.cameraController = null;
    this.planetaryReferences = null;

    // ===================================================================
    // Properties for backward compatibility (mapped from modules)
    // ===================================================================
    this.starGroup = null;
    this.constellationLineGroup = null;
    this.bgStarField = null;
    this.starMeshes = {}; // Store star meshes for hover detection
    this.horizonPlane = null;
    this.horizonOutline = null;
    this.meridianOutline = null;
    this.primeVerticalOutline = null;
    this.celestialEquatorOutline = null;
    this.outerEclipticLine = null;
    this.spheres = {};
    this.angleLabels = {};
    this.poleLabels = {}; // Store pole label sprites
    this.eclipticSunGroup = null;
    this.realisticSunGroup = null;
    this.sunTexture = null; // Store texture reference for toggling
    this.eclipticSunMesh = null;
    this.eclipticSunGlowMeshes = [];
    this.eclipticMoonGroup = null;
    this.eclipticMoonMesh = null;
    this.realisticMoonGroup = null;
    this.realisticMoonMesh = null;
    this.moonGlowMeshes = [];
    this.realisticMoonGlowMeshes = [];
    this.realisticSunMesh = null;
    this.realisticSunGlowMeshes = [];
    this.planetGroups = {}; // Store planet groups
    this.planetZodiacPositions = {}; // Store planet zodiac positions for tooltips
    this.eclipticDots = []; // Store ecliptic rim dots for hover detection

    // ===================================================================
    // State Management
    // ===================================================================
    // Track previous armillary state for camera synchronization
    this.prevArmillaryPos = null;
    this.prevArmillaryQuat = null;

    // Store lunar phase info for tooltip
    this.lunarPhase = { phase: "", illumination: 0 };

    // Store sun/moon positions for tooltips
    this.sunZodiacPosition = "";
    this.moonZodiacPosition = "";

    // Store lunar apsis positions for tooltips
    this.lunarApsisPositions = {};

    // Store angle positions for tooltips
    this.anglePositions = {
      MC: "",
      IC: "",
      ASC: "",
      DSC: "",
      VTX: "",
      AVX: ""
    };

    // ===================================================================
    // Initialization
    // ===================================================================
    this.initScene();
    this.initGroups();
    this.initModules();
  }

  // ===================================================================
  // Core Initialization Methods
  // ===================================================================

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Add ambient light for realistic materials (Moon)
    this.scene.add(new THREE.AmbientLight(0x111111));

    // Create main camera for normal (non-stereo) view and controls
    // Horizon view positions camera to face south (East/ASC on left, West/DSC on right)
    // Position camera at a comfortable viewing distance relative to the horizon (CE_RADIUS)
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500000);
    this.camera.position.set(0, this.CE_RADIUS * 1.6, this.CE_RADIUS * 3.0);
    this.camera.lookAt(0, 0, 0);

    // Create stereo cameras (left and right eye)
    const aspect = (window.innerWidth / 2) / window.innerHeight; // Half width for each eye
    this.leftCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500000);
    this.rightCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setScissorTest(true); // Enable scissor test for split viewport
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
  }

  initGroups() {
    // Armillary Root holds the observer-centric visualization (Horizon, Celestial Sphere, etc.)
    this.armillaryRoot = new THREE.Group();
    this.scene.add(this.armillaryRoot);

    this.tiltGroup = new THREE.Group();
    this.armillaryRoot.add(this.tiltGroup);

    this.celestial = new THREE.Group();
    this.tiltGroup.add(this.celestial);

    this.zodiacGroup = new THREE.Group();
    this.zodiacGroup.rotation.x = this.obliquity;
    this.celestial.add(this.zodiacGroup);

    // Inertial star sphere - stationary reference frame for fixed stars
    // Positioned at Sun (origin) in heliocentric view, doesn't move with Earth's orbit
    this.inertialStarSphere = new THREE.Group();
    this.scene.add(this.inertialStarSphere);
    // Orient to J2000 equatorial coordinate system (aligned with ecliptic at obliquity angle)
    // Stars are in RA/Dec, which is tilted relative to ecliptic by obliquity
    this.inertialStarSphere.rotation.order = 'XYZ';
    this.inertialStarSphere.rotation.x = this.obliquity;

    // Hide celestial objects until first updateSphere() call
    this.celestial.visible = false;
    this.armillaryRoot.visible = false;
  }

  initModules() {
    // Initialize all scene modules and map their properties

    // 1. Reference Geometry (horizon, meridian, celestial equator, compass)
    this.references = new ReferenceGeometry(
      this.scene,
      this.armillaryRoot,
      this.celestial,
      this.CE_RADIUS
    );
    // Map properties for backward compatibility
    this.horizonPlane = this.references.horizonPlane;
    this.horizonOutline = this.references.horizonOutline;
    this.meridianOutline = this.references.meridianOutline;
    this.primeVerticalOutline = this.references.primeVerticalOutline;
    this.celestialEquatorOutline = this.references.celestialEquatorOutline;
    this.poleLabels = this.references.poleLabels;

    // 2. Zodiac Wheel (ecliptic plane and zodiac signs)
    this.zodiacWheel = new ZodiacWheel(
      this.zodiacGroup,
      this.CE_RADIUS,
      this.obliquity
    );
    // Map properties for backward compatibility
    this.outerEclipticLine = this.zodiacWheel.outerEclipticLine;

    // 3. Celestial Objects (stars, sun, moon, planets, Earth)
    const constants = {
      CE_RADIUS: this.CE_RADIUS,
      EARTH_RADIUS: this.EARTH_RADIUS,
      SUN_RADIUS: this.SUN_RADIUS,
      MOON_RADIUS: this.MOON_RADIUS,
      MOON_DISTANCE: this.MOON_DISTANCE,
      STAR_FIELD_RADIUS: this.STAR_FIELD_RADIUS,
      PLANET_RADIUS_SCALE: this.PLANET_RADIUS_SCALE,
      PLANET_DISTANCE_SCALE: this.PLANET_DISTANCE_SCALE
    };
    const texturePaths = {
      EARTH_TEXTURE_PATH: this.EARTH_TEXTURE_PATH,
      EARTH_NIGHT_TEXTURE_PATH: this.EARTH_NIGHT_TEXTURE_PATH,
      SUN_TEXTURE_PATH: this.SUN_TEXTURE_PATH,
      REALISTIC_SUN_TEXTURE_PATH: this.REALISTIC_SUN_TEXTURE_PATH,
      MOON_TEXTURE_PATH: this.MOON_TEXTURE_PATH,
      MOON_BUMP_TEXTURE_PATH: this.MOON_BUMP_TEXTURE_PATH,
      MERCURY_TEXTURE_PATH: this.MERCURY_TEXTURE_PATH,
      VENUS_TEXTURE_PATH: this.VENUS_TEXTURE_PATH,
      MARS_TEXTURE_PATH: this.MARS_TEXTURE_PATH,
      JUPITER_TEXTURE_PATH: this.JUPITER_TEXTURE_PATH,
      SATURN_TEXTURE_PATH: this.SATURN_TEXTURE_PATH,
      SATURN_RINGS_TEXTURE_PATH: this.SATURN_RINGS_TEXTURE_PATH,
      SATURN_RINGS_ALPHA_PATH: this.SATURN_RINGS_ALPHA_PATH,
      URANUS_TEXTURE_PATH: this.URANUS_TEXTURE_PATH,
      NEPTUNE_TEXTURE_PATH: this.NEPTUNE_TEXTURE_PATH,
      PLUTO_TEXTURE_PATH: this.PLUTO_TEXTURE_PATH
    };
    this.celestialObjects = new CelestialObjects(
      this.scene,
      this.celestial,
      this.zodiacGroup,
      this.inertialStarSphere,
      constants,
      texturePaths
    );

    // Load constellation figures asynchronously
    this.celestialObjects.loadConstellationFigures().then(() => {
      this.constellationFigureGroup = this.celestialObjects.constellationFigureGroup;
      console.log('Constellation figures loaded');
      // Apply toggle state if it was set before loading completed
      if (this.constellationArtAlwaysOn) {
        this.toggleConstellationArt(true);
      }
    });

    // Map properties for backward compatibility
    this.starGroup = this.celestialObjects.starGroup;
    this.starMeshes = this.celestialObjects.starMeshes;
    this.constellationLineGroup = this.celestialObjects.constellationLineGroup;
    this.bgStarField = this.celestialObjects.bgStarField;
    this.eclipticSunGroup = this.celestialObjects.eclipticSunGroup;
    this.realisticSunGroup = this.celestialObjects.realisticSunGroup;
    this.sunTexture = this.celestialObjects.sunTexture;
    this.eclipticSunMesh = this.celestialObjects.eclipticSunMesh;
    this.eclipticSunGlowMeshes = this.celestialObjects.eclipticSunGlowMeshes;
    this.realisticSunMesh = this.celestialObjects.realisticSunMesh;
    this.realisticSunGlowMeshes = this.celestialObjects.realisticSunGlowMeshes;
    this.eclipticMoonGroup = this.celestialObjects.eclipticMoonGroup;
    this.eclipticMoonMesh = this.celestialObjects.eclipticMoonMesh;
    this.realisticMoonGroup = this.celestialObjects.realisticMoonGroup;
    this.realisticMoonMesh = this.celestialObjects.realisticMoonMesh;
    this.moonGlowMeshes = this.celestialObjects.moonGlowMeshes;
    this.realisticMoonGlowMeshes = this.celestialObjects.realisticMoonGlowMeshes;
    this.heliocentricNodeGroups = this.celestialObjects.heliocentricNodeGroups;
    this.planetGroups = this.celestialObjects.planetGroups;
    this.eclipticPlanetGroups = this.celestialObjects.eclipticPlanetGroups;
    this.earthGroup = this.celestialObjects.earthGroup;
    this.earthMesh = this.celestialObjects.earthMesh;
    this.earthMaterial = this.celestialObjects.earthMaterial;
    this.earthDepthMaterial = this.celestialObjects.earthDepthMaterial;
    debugLog.log('After celestialObjects init, planetGroups:', Object.keys(this.planetGroups));

    // 4. Angle Markers (MC, IC, ASC, DSC, VTX, AVX)
    this.angleMarkers = new AngleMarkers(
      this.zodiacGroup,
      this.CE_RADIUS
    );
    // Map properties for backward compatibility
    this.spheres = this.angleMarkers.spheres;
    this.angleLabels = this.angleMarkers.angleLabels;

    // 4.5. Lunar Nodes (☊ ascending and ☋ descending)
    this.lunarNodes = new LunarNodes(
      this.zodiacGroup,
      this.CE_RADIUS
    );
    this.nodeSpheres = this.lunarNodes.spheres;
    this.nodeLabels = this.lunarNodes.nodeLabels;

    // 5. Planetary References (Earth equator/poles, Sun ecliptic plane)
    this.planetaryReferences = new PlanetaryReferences(
      this.scene,
      this.earthGroup,
      this.earthMesh,
      this.realisticSunGroup,
      this.EARTH_RADIUS,
      this.PLANET_DISTANCE_SCALE,
      this.STAR_FIELD_RADIUS,
      this.MOON_DISTANCE
    );
    // Map ecliptic dots for hover detection
    this.eclipticDots = this.planetaryReferences.eclipticDots;
    this.lunarApsisSprites = this.planetaryReferences.lunarApsisSprites;

    // 6. Camera Controller (zoom, stereo, starfield toggle)
    this.cameraController = new CameraController(
      this.camera,
      this.leftCamera,
      this.rightCamera,
      this.renderer,
      this.controls,
      this // Pass reference to main scene for accessing properties
    );

    // 7. Interaction Manager (hover, double-click, context menu)
    this.interactions = new InteractionManager(
      this.camera,
      this.leftCamera,
      this.rightCamera,
      this.renderer,
      this // Pass reference to main scene for accessing properties
    );

    // 7. Setup window resize listener (after cameraController is initialized)
    window.addEventListener('resize', () => {
      this.cameraController.onWindowResize();
    });
  }

  // ===================================================================
  // Main Update Method
  // ===================================================================

  updateSphere(astroCalc, currentLatitude, currentLongitude, currentTime, currentDay, currentYear, timezone = null) {
    debugLog.log('=== updateSphere called ===');
    debugLog.log('Planet groups available:', Object.keys(this.planetGroups));

    // Recalculate planet orbits if year changed or first time
    // Note: createPlanetOrbits now uses Keplerian elements, doesn't need ephemeris
    if (!this._lastOrbitYear || this._lastOrbitYear !== currentYear) {
      this.planetaryReferences.createPlanetOrbits(astroCalc, currentYear);
      this._lastOrbitYear = currentYear;
    }

    // Check if Sun ecliptic plane is visible (used throughout this function)
    const sunEclipticVisible = document.getElementById('sunReferencesToggle') &&
      document.getElementById('sunReferencesToggle').checked;

    // Make celestial objects visible on first update
    if (!this.celestial.visible) {
      this.celestial.visible = true;
      this.armillaryRoot.visible = true;
      this.earthGroup.visible = true;

      // Check planets toggle state
      const planetsToggle = document.getElementById('planetsToggle');
      const planetsVisible = planetsToggle ? planetsToggle.checked : true;

      this.realisticSunGroup.visible = planetsVisible;
      this.realisticMoonGroup.visible = planetsVisible;

      // Make all planets visible based on toggle state
      Object.values(this.planetGroups).forEach(planetData => {
        planetData.group.visible = planetsVisible;
      });
    }

    // -----------------------------------------------------------
    // 1. Convert inputs
    // -----------------------------------------------------------
    const latRad = THREE.MathUtils.degToRad(currentLatitude);
    const { LST: LSTdeg, julianDate } = astroCalc.calculateLST(currentDay, currentTime, currentLongitude, currentYear);
    const lstRad = THREE.MathUtils.degToRad(LSTdeg);

    // precise obliquity
    this.obliquity = astroCalc.getObliquity(julianDate);

    // Handle Sidereal Mode
    let ayanamsha = 0;
    const siderealCheckbox = document.getElementById('siderealMode');
    if (siderealCheckbox && siderealCheckbox.checked) {
        ayanamsha = astroCalc.calculateAyanamsha(currentYear);
    }
    const ayanamshaDeg = THREE.MathUtils.radToDeg(ayanamsha);
    this.zodiacGroup.rotation.z = ayanamsha;

    // -----------------------------------------------------------
    // 2. Orient the Celestial Sphere (The Equator)
    // -----------------------------------------------------------
    // Hierarchy: World -> TiltGroup -> CelestialGroup -> ZodiacGroup

    // TILT (X):
    // Rotate the entire celestial sphere assembly to match Latitude.
    // Axis: World X (East-West).
    this.tiltGroup.rotation.x = -latRad;

    // SPIN (Z):
    // Rotate the sky opposite to Earth's spin (-LST).
    // Axis: Celestial Pole (Local Z of TiltGroup).
    // Phase shift: At LST 0, 0° Aries is on the Meridian.
    // In our geometry (0° = +X axis), we need to rotate it to the Zenith (+Y axis).
    // So we need +90 degrees offset.
    this.celestial.rotation.z = Math.PI / 2 - lstRad;


    // -----------------------------------------------------------
    // 3. Orient the Zodiac Wheel (The Ecliptic)
    // -----------------------------------------------------------
    // The Zodiac is a child of Celestial. It represents the Solar System plane.
    // It is purely a static tilt relative to the Equator.

    this.zodiacGroup.rotation.x = this.obliquity;


    // -----------------------------------------------------------
    // 4. Calculate Angles (ASC/MC/VTX)
    // -----------------------------------------------------------
    const MCdeg = astroCalc.calculateMC(lstRad, this.obliquity);
    const ICdeg = (MCdeg + 180) % 360;
    let { AC: ACdeg, DSC: DCdeg } = astroCalc.calculateAscendant(lstRad, latRad, this.obliquity);
    let { VTX: VTXdeg, AVX: AVXdeg } = astroCalc.calculateVertex(lstRad, latRad, this.obliquity);

    // Southern Hemisphere correction
    if (currentLatitude < 0) {
      ACdeg = (ACdeg + 180) % 360;
      DCdeg = (DCdeg + 180) % 360;
    }

    // -----------------------------------------------------------
    // 5. Place Objects on the Zodiac Wheel
    // -----------------------------------------------------------
    // Helper to place points based on zodiac longitude
    const sphereRadius = this.CE_RADIUS * 1.6;
    const placeOnZodiac = (deg) => {
        const rad = THREE.MathUtils.degToRad(deg) - ayanamsha;
        // We map 0 degrees to +X, moving counter-clockwise towards +Y
        return new THREE.Vector3(
            sphereRadius * Math.cos(rad),
            sphereRadius * Math.sin(rad),
            0.0
        );
    };

    this.spheres.MC.position.copy(placeOnZodiac(MCdeg));
    this.spheres.IC.position.copy(placeOnZodiac(ICdeg));
    this.spheres.ASC.position.copy(placeOnZodiac(ACdeg));
    this.spheres.DSC.position.copy(placeOnZodiac(DCdeg));
    this.spheres.VTX.position.copy(placeOnZodiac(VTXdeg));
    this.spheres.AVX.position.copy(placeOnZodiac(AVXdeg));

    // Store angle positions for tooltips
    this.anglePositions.MC = astroCalc.toZodiacString(MCdeg - ayanamshaDeg);
    this.anglePositions.IC = astroCalc.toZodiacString(ICdeg - ayanamshaDeg);
    this.anglePositions.ASC = astroCalc.toZodiacString(ACdeg - ayanamshaDeg);
    this.anglePositions.DSC = astroCalc.toZodiacString(DCdeg - ayanamshaDeg);
    this.anglePositions.VTX = astroCalc.toZodiacString(VTXdeg - ayanamshaDeg);
    this.anglePositions.AVX = astroCalc.toZodiacString(AVXdeg - ayanamshaDeg);

    // Update Labels (offset for visibility)
    const labelRadius = sphereRadius * 1.15;
    const placeLabel = (deg) => {
        const rad = THREE.MathUtils.degToRad(deg) - ayanamsha;
        return new THREE.Vector3(
            labelRadius * Math.cos(rad),
            labelRadius * Math.sin(rad),
            0.0
        );
    };

    this.angleLabels.MC.position.copy(placeLabel(MCdeg));
    this.angleLabels.IC.position.copy(placeLabel(ICdeg));
    this.angleLabels.ASC.position.copy(placeLabel(ACdeg));
    this.angleLabels.DSC.position.copy(placeLabel(DCdeg));
    this.angleLabels.VTX.position.copy(placeLabel(VTXdeg));
    this.angleLabels.AVX.position.copy(placeLabel(AVXdeg));

    // -----------------------------------------------------------
    // 5.5. Lunar Nodes (☊ and ☋)
    // -----------------------------------------------------------
    // Use julianDate for all astronomical calculations (continuous across year boundaries)
    const lunarNodes = astroCalc.calculateLunarNodes(julianDate);
    const northNodeDeg = lunarNodes.ascending;
    const southNodeDeg = lunarNodes.descending;

    // Position node spheres
    this.nodeSpheres.NORTH_NODE.position.copy(placeOnZodiac(northNodeDeg));
    this.nodeSpheres.SOUTH_NODE.position.copy(placeOnZodiac(southNodeDeg));

    // Position node labels
    this.nodeLabels.NORTH_NODE.position.copy(placeLabel(northNodeDeg));
    this.nodeLabels.SOUTH_NODE.position.copy(placeLabel(southNodeDeg));

    // Store node positions for tooltips (if not already initialized)
    if (!this.nodePositions) {
      this.nodePositions = {};
    }
    this.nodePositions.NORTH_NODE = astroCalc.toZodiacString(northNodeDeg - ayanamshaDeg);
    this.nodePositions.SOUTH_NODE = astroCalc.toZodiacString(southNodeDeg - ayanamshaDeg);

    // -----------------------------------------------------------
    // 6. Sun Position
    // -----------------------------------------------------------
    const sunLonRad = astroCalc.calculateSunPosition(julianDate);
    const sunDeg = THREE.MathUtils.radToDeg(sunLonRad);

    // Store sun zodiac position for tooltip
    this.sunZodiacPosition = astroCalc.toZodiacString(sunDeg - ayanamshaDeg);

    this.eclipticSunGroup.position.copy(placeOnZodiac(sunDeg));

    // --- HELIOCENTRIC POSITIONING ---

    // Calculate zoom scale for uniform solar system scaling
    // planetZoomFactor ranges from 0 (accurate) to 1.0 (max zoom)
    // At zoom=1.0, we want the effect of old 0.75, which was: 1.0 - 0.75 * 0.9333 = 0.30
    // So: zoomScale = 1.0 - planetZoomFactor * 0.75 * 0.9333 = 1.0 - planetZoomFactor * 0.7
    const zoomScale = 1.0 - this.planetZoomFactor * 0.7; // At zoom=1.0, scale to 30% of original
    const sizeMultiplier = 1.0 / zoomScale; // Inverse: if distances shrink, sizes grow to compensate

    // Update planet orbits to match the same transformations as planet positions
    if (this.planetaryReferences) {
      this.planetaryReferences.updatePlanetOrbits(this.planetZoomFactor, sizeMultiplier);
    }

    // Realistic sun at ORIGIN (0,0,0) for heliocentric system
    this.realisticSunGroup.position.set(0, 0, 0);
    this.realisticSunGroup.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);

    // 1. Position Earth
    const earthData = astroCalc.getEarthHeliocentricPosition(julianDate);
    const earthRad = earthData.longitude;
    // Apply distance compression (Earth is at 1 AU)
    const distanceExponent = 1.0 - this.planetZoomFactor * 0.65; // 1.0 at no zoom, 0.35 at max zoom
    const compressedEarthDistAU = Math.pow(earthData.distance, distanceExponent);
    const earthDist = compressedEarthDistAU * this.PLANET_DISTANCE_SCALE * zoomScale;

    const earthX = Math.cos(earthRad) * earthDist;
    const earthY = Math.sin(earthRad) * earthDist;

    const newEarthPos = new THREE.Vector3(earthX, earthY, 0);
    this.earthGroup.position.copy(newEarthPos);

    // Scale Earth size with zoom
    this.earthGroup.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);

    // Update Earth Rotation (Spin + Tilt)
    // Calculate GST (Greenwich Sidereal Time) for Earth spin
    const { LST: GSTdeg } = astroCalc.calculateLST(currentDay, currentTime, 0, currentYear);
    const gstRad = THREE.MathUtils.degToRad(GSTdeg);

    // Rotate Earth: Spin (Y) then Tilt (X)
    // Tilt is (90 - obliquity) around X to bring Y-axis (poles) to point to NCP
    const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 - this.obliquity);
    // gstRad aligns Greenwich (Lon 0) with the Vernal Equinox (X axis)
    const spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), gstRad);

    if (this.earthMesh) {
      this.earthMesh.quaternion.copy(tiltQ).multiply(spinQ);
    }

    // Position Armillary Root on Earth Surface
    // Calculate observer position in Earth Object Space
    // Three.js Sphere: phi is angle from +Y (North), theta is angle from +Z (CCW around Y)
    // We assume texture is mapped such that Lon 0 is at theta = PI (to match spinQ offset)
    const localObserverPos = new THREE.Vector3().setFromSphericalCoords(
      this.EARTH_RADIUS,
      Math.PI / 2 - latRad, // phi (0 at North Pole)
      THREE.MathUtils.degToRad(currentLongitude) + Math.PI / 2 // theta
    );

    // Transform to World Space
    const worldObserverPos = localObserverPos.clone().applyQuaternion(this.earthMesh.quaternion);

    // Position armillaryRoot relative to Earth Center
    // Add small offset to avoid z-fighting with earth surface
    this.armillaryRoot.position.copy(this.earthGroup.position).add(worldObserverPos.clone().multiplyScalar(1.001));

    // Orient armillaryRoot (Horizon Frame)
    // Y axis = Up (Surface Normal)
    // Z axis = North (Tangent pointing to North Pole)
    // X axis = West (Up x North)

    const up = worldObserverPos.clone().normalize();

    // Calculate North in Object Space, then transform
    // Project Earth Axis (0,1,0) onto tangent plane
    const earthAxisObj = new THREE.Vector3(0, 1, 0);
    const obsPosObj = localObserverPos.clone().normalize();
    const northObj = new THREE.Vector3().subVectors(earthAxisObj, obsPosObj.multiplyScalar(earthAxisObj.dot(obsPosObj))).normalize();

    const north = northObj.applyQuaternion(this.earthMesh.quaternion).normalize();
    const west = new THREE.Vector3().crossVectors(up, north).normalize();

    const basis = new THREE.Matrix4().makeBasis(west, up, north);
    this.armillaryRoot.quaternion.setFromRotationMatrix(basis);

    // Force matrix update after position/rotation changes
    this.armillaryRoot.updateMatrixWorld(true);

    // Move camera and controls to follow the observer's geographic location
    // Store previous armillary root position and rotation
    if (!this.prevArmillaryPos) {
      this.prevArmillaryPos = this.armillaryRoot.position.clone();
    }
    if (!this.prevArmillaryQuat) {
      this.prevArmillaryQuat = this.armillaryRoot.quaternion.clone();
    }

    const armillaryDelta = new THREE.Vector3().subVectors(this.armillaryRoot.position, this.prevArmillaryPos);
    this.prevArmillaryPos.copy(this.armillaryRoot.position);

    // Calculate rotation delta
    const deltaQuat = new THREE.Quaternion().copy(this.armillaryRoot.quaternion).multiply(this.prevArmillaryQuat.clone().invert());
    this.prevArmillaryQuat.copy(this.armillaryRoot.quaternion);

    // Check distance from camera to Earth center to determine view mode
    const distToObserver = this.camera.position.distanceTo(this.armillaryRoot.position);
    const isEarthView = (distToObserver >= this.VIEW_MODE_THRESHOLD);

    // Update inertial star sphere - keep in pure inertial frame
    // Stars stay stationary with only obliquity tilt (J2000 equatorial → ecliptic alignment)
    // Camera staying fixed in horizon view makes stars and celestial sphere move naturally
    this.inertialStarSphere.rotation.order = 'XYZ';
    this.inertialStarSphere.rotation.x = this.obliquity;
    this.inertialStarSphere.rotation.y = 0;
    this.inertialStarSphere.rotation.z = 0;

    // Only show Earth references (equator/poles) in Earth view
    // In horizon view, they're not visible/relevant anyway
    if (this.planetaryReferences && this.planetaryReferences.earthReferencesGroup) {
      const shouldShowEarthRefs = isEarthView &&
        document.getElementById('earthReferencesToggle') &&
        document.getElementById('earthReferencesToggle').checked;
      this.planetaryReferences.earthReferencesGroup.visible = shouldShowEarthRefs;

      // Check if lunar orbit is visible
      const lunarOrbitVisible = this.planetaryReferences.moonOrbitOutline &&
        this.planetaryReferences.moonOrbitOutline.visible;

      // Enable Earth depthWrite when Earth references OR Sun ecliptic plane OR lunar orbit are visible
      // This allows them to properly clip against Earth
      const shouldEnableEarthDepth = shouldShowEarthRefs || sunEclipticVisible || lunarOrbitVisible;
      if (this.earthMaterial && this.earthMaterial.depthWrite !== shouldEnableEarthDepth) {
        this.earthMaterial.depthWrite = shouldEnableEarthDepth;
        this.earthMaterial.needsUpdate = true;
      }
    }

    // Adjust controls target and camera motion based on view distance
    if (distToObserver < this.VIEW_MODE_THRESHOLD) {
      // Horizon View: camera follows geographic location on Earth's surface
      // Lock controls target to center of horizon (armillaryRoot origin in world space)
      // This ensures orbital rotation happens around the horizon center, not a point on the edge
      this.controls.target.copy(this.armillaryRoot.position);

      // Move camera to follow Earth's position
      this.camera.position.add(armillaryDelta);

      // Rotate camera to follow the horizon orientation (keep compass fixed)
      // Calculate camera's offset from target, rotate it, then reposition camera
      const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      offset.applyQuaternion(deltaQuat);
      this.camera.position.copy(this.controls.target).add(offset);
      this.camera.up.applyQuaternion(deltaQuat);

      // Enforce target camera distance if set (for URL restoration)
      if (this.targetCameraDistance !== null) {
        const currentOffset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        currentOffset.normalize().multiplyScalar(this.targetCameraDistance);
        this.camera.position.copy(this.controls.target).add(currentOffset);
        this.targetCameraDistance = null; // Clear after applying once
      }
    } else {
      // Earth View: orbit around a celestial object
      // Update controls target based on current zoom target
      const currentTarget = this.cameraController?.currentZoomTarget;

      if (currentTarget === 'ecliptic-north' || currentTarget === 'sun') {
        // Follow the Sun (center of solar system)
        const sunWorldPos = new THREE.Vector3();
        this.realisticSunGroup.getWorldPosition(sunWorldPos);
        this.controls.target.copy(sunWorldPos);
        // Don't update camera.up - it was set during initial zoom
      } else if (currentTarget === 'moon') {
        // Follow the Moon
        const moonWorldPos = new THREE.Vector3();
        this.realisticMoonGroup.getWorldPosition(moonWorldPos);
        this.controls.target.copy(moonWorldPos);
        // Don't update camera.up - it was set during initial zoom
      } else if (currentTarget && this.planetGroups[currentTarget]) {
        // Follow a specific planet
        const planetWorldPos = new THREE.Vector3();
        this.planetGroups[currentTarget].group.getWorldPosition(planetWorldPos);
        this.controls.target.copy(planetWorldPos);
        // Don't update camera.up - it was set during initial zoom
      } else {
        // Default: Follow Earth's center (original behavior for 'earth' target or no target)
        const earthWorldPos = new THREE.Vector3();
        this.earthGroup.getWorldPosition(earthWorldPos);
        this.controls.target.copy(earthWorldPos);

        // Align camera up vector with Earth's polar axis
        // Earth's polar axis is the Y-axis in earthMesh's local space
        if (this.earthMesh) {
          const earthPolarAxis = new THREE.Vector3(0, 1, 0);
          const earthWorldQuat = new THREE.Quaternion();
          this.earthMesh.getWorldQuaternion(earthWorldQuat);
          earthPolarAxis.applyQuaternion(earthWorldQuat).normalize();

          // Update camera to use Earth's polar axis as "up"
          this.camera.up.copy(earthPolarAxis);
        }
      }
    }

    // 2. Position Moon (Relative to Earth)
    const moonPos = astroCalc.calculateMoonPosition(julianDate, currentLongitude);
    const moonLonRad = moonPos.longitude;
    const moonLatRad = moonPos.latitude;
    const moonDeg = THREE.MathUtils.radToDeg(moonLonRad);
    this.eclipticMoonGroup.position.copy(placeOnZodiac(moonDeg));

    // Realistic moon orbits Earth with proper latitude off the ecliptic
    // Use spherical coordinates: x = r*cos(lat)*cos(lon), y = r*cos(lat)*sin(lon), z = r*sin(lat)
    // Apply zoom scale to moon distance
    const mRad = moonLonRad;
    const mLat = moonLatRad;
    const scaledMoonDistance = this.MOON_DISTANCE * zoomScale;
    const moonX = earthX + scaledMoonDistance * Math.cos(mLat) * Math.cos(mRad);
    const moonY = earthY + scaledMoonDistance * Math.cos(mLat) * Math.sin(mRad);
    const moonZ = scaledMoonDistance * Math.sin(mLat);
    this.realisticMoonGroup.position.set(moonX, moonY, moonZ);

    // Scale Moon size with zoom
    this.realisticMoonGroup.scale.set(sizeMultiplier, sizeMultiplier, sizeMultiplier);

    // Tidal locking: Rotate moon to face Earth
    // With rotation.x = PI/2, rotation.y becomes the spin around the Z-axis (poles)
    if (this.realisticMoonMesh) {
      this.realisticMoonMesh.rotation.y = mRad + Math.PI;
    }

    // Adjust moon transparency when crossing nodes (latitude near 0)
    // Opacity fades as moon approaches the ecliptic plane
    const NODE_ORBED_ZONE = 0.1; // degrees - very brief transition zone near nodes
    const latDeg = Math.abs(THREE.MathUtils.radToDeg(mLat));

    let moonOpacity = 1.0;
    if (sunEclipticVisible && latDeg < NODE_ORBED_ZONE) {
      // Calculate opacity: 0.3 at nodes (lat=0°), 1.0 at orb edge
      // Brief transition only within NODE_ORBED_ZONE
      const latNormalized = latDeg / NODE_ORBED_ZONE; // 0 at nodes, 1 at orb edge
      const minOpacity = 0.3;
      const maxOpacity = 1.0;
      moonOpacity = minOpacity + (maxOpacity - minOpacity) * latNormalized;
    }

    // Apply opacity to realistic moon mesh
    if (this.realisticMoonMesh && this.realisticMoonMesh.material) {
      this.realisticMoonMesh.material.opacity = moonOpacity;
      this.realisticMoonMesh.material.transparent = true;
    }

    // Apply opacity to glow meshes
    if (this.realisticMoonGlowMeshes) {
      this.realisticMoonGlowMeshes.forEach((glowMesh, index) => {
        if (glowMesh.material) {
          // Glow fades even more dramatically near nodes
          const baseGlowOpacity = index === 0 ? 0.3 : (index === 1 ? 0.15 : 0.08);
          glowMesh.material.opacity = baseGlowOpacity * moonOpacity;
        }
      });
    }

    // Store moon zodiac position for tooltip
    this.moonZodiacPosition = astroCalc.toZodiacString(moonDeg - ayanamshaDeg);

    // Calculate lunar phase
    this.lunarPhase = astroCalc.calculateLunarPhase(sunLonRad, moonLonRad);

    // 2.5. Heliocentric Lunar Nodes are positioned after the orbit quaternion is set (section 2.6b)
    const northNodeRad = THREE.MathUtils.degToRad(northNodeDeg);
    const southNodeRad = THREE.MathUtils.degToRad(southNodeDeg);

    // 2.5a. Position Planetary Nodes (heliocentric, on ecliptic plane)
    // These nodes show where each planet's orbital plane intersects the ecliptic
    const planetaryNodes = astroCalc.calculatePlanetaryNodes(julianDate);

    // Check if planet orbits are visible to determine node/apsis visibility
    const planetOrbitsVisible = this.planetaryReferences.planetOrbits &&
      Object.values(this.planetaryReferences.planetOrbits).some(orbit => orbit.visible);

    if (this.planetaryReferences.planetaryNodeGroups) {
      Object.entries(planetaryNodes).forEach(([planetName, nodes]) => {
        const nodeGroups = this.planetaryReferences.planetaryNodeGroups[planetName];
        if (!nodeGroups) return;

        // Get the planet's semi-major axis for proper scaling
        const orbitalElements = this.planetaryReferences.orbitalElements[planetName];
        if (!orbitalElements) return;

        const semiMajorAxis = orbitalElements.a; // in AU

        // Apply same distance compression as planets
        const compressedDistance = Math.pow(semiMajorAxis, distanceExponent);
        const scaledDistance = compressedDistance * this.PLANET_DISTANCE_SCALE;

        // Position ascending node
        const ascendingRad = THREE.MathUtils.degToRad(nodes.ascending);
        const ascendingX = scaledDistance * Math.cos(ascendingRad);
        const ascendingY = scaledDistance * Math.sin(ascendingRad);
        nodeGroups.ascending.position.set(ascendingX, ascendingY, 0);

        // Position descending node
        const descendingRad = THREE.MathUtils.degToRad(nodes.descending);
        const descendingX = scaledDistance * Math.cos(descendingRad);
        const descendingY = scaledDistance * Math.sin(descendingRad);
        nodeGroups.descending.position.set(descendingX, descendingY, 0);

        // Scale nodes with zoom
        nodeGroups.ascending.scale.set(zoomScale, zoomScale, zoomScale);
        nodeGroups.descending.scale.set(zoomScale, zoomScale, zoomScale);

        // Nodes visibility is controlled by planet orbits toggle, not set here
        // (visibility is managed by togglePlanetOrbits method)
      });
    }

    //  apo:  peri: 
    // 2.5b. Position Planetary Apsides (perihelion ⊕ and aphelion ⊖)
    // These show the closest and farthest points from the Sun in each orbit
    const planetaryApsides = astroCalc.calculatePlanetaryApsides(julianDate);

    if (this.planetaryReferences.planetaryApsisGroups) {
      Object.entries(planetaryApsides).forEach(([planetName, apsides]) => {
        const apsisGroups = this.planetaryReferences.planetaryApsisGroups[planetName];
        if (!apsisGroups) return;

        // Perihelion: closest point to Sun (at distance a*(1-e))
        const perihelionDist = apsides.perihelionDistance;
        const perihelionRad = THREE.MathUtils.degToRad(apsides.perihelion);

        // Apply same distance compression as planets
        const compressedPerihelionDist = Math.pow(perihelionDist, distanceExponent);
        const scaledPerihelionDist = compressedPerihelionDist * this.PLANET_DISTANCE_SCALE * zoomScale;

        const perihelionX = scaledPerihelionDist * Math.cos(perihelionRad);
        const perihelionY = scaledPerihelionDist * Math.sin(perihelionRad);
        apsisGroups.perihelion.position.set(perihelionX, perihelionY, 0);

        // Aphelion: farthest point from Sun (at distance a*(1+e))
        const aphelionDist = apsides.aphelionDistance;
        const aphelionRad = THREE.MathUtils.degToRad(apsides.aphelion);

        const compressedAphelionDist = Math.pow(aphelionDist, distanceExponent);
        const scaledAphelionDist = compressedAphelionDist * this.PLANET_DISTANCE_SCALE * zoomScale;

        const aphelionX = scaledAphelionDist * Math.cos(aphelionRad);
        const aphelionY = scaledAphelionDist * Math.sin(aphelionRad);
        apsisGroups.aphelion.position.set(aphelionX, aphelionY, 0);

        // Scale apsides with zoom
        apsisGroups.perihelion.scale.set(zoomScale, zoomScale, zoomScale);
        apsisGroups.aphelion.scale.set(zoomScale, zoomScale, zoomScale);

        // Apsides visibility is controlled by planet orbits toggle, not set here
        // (visibility is managed by togglePlanetOrbits method)
      });
    }

    // 2.6. Position and orient moon orbit outline around Earth
    // The moon's orbital plane is inclined 5.145° to the ecliptic
    if (this.planetaryReferences.moonOrbitOutline) {
      // Update lunar orbit eccentricity based on planet zoom factor
      // At planetZoomFactor = 1.0 (max zoom), use 10x exaggerated eccentricity for clear visibility
      // At planetZoomFactor = 0.0 (no zoom), use realistic eccentricity (1x)
      // The exaggeration makes the ellipse visible, moon's angular position will still match
      const baseEccentricity = 0.0549; // Moon's mean eccentricity
      const eccentricityMultiplier = 1.0 + this.planetZoomFactor * 4.0;
      this.planetaryReferences.updateLunarOrbitEccentricity(baseEccentricity * eccentricityMultiplier);

      this.planetaryReferences.moonOrbitOutline.position.set(earthX, earthY, 0);
      // Scale moon orbit outline with zoom (scales with distance, not inverse)
      this.planetaryReferences.moonOrbitOutline.scale.set(zoomScale, zoomScale, zoomScale);

      // Rotate the orbit to match the moon's orbital inclination and perigee direction
      // The orbit is tilted 5.145° from the ecliptic, with the line of nodes
      // aligned to the ascending node position
      const MOON_INCLINATION = 5.145; // degrees
      const inclinationRad = THREE.MathUtils.degToRad(MOON_INCLINATION);

      // Calculate what argument of perigee would place the moon at its current position
      // Moon's ecliptic longitude and distance from ephemeris
      const moonLonDeg = THREE.MathUtils.radToDeg(moonLonRad);
      const moonDistFromEarth = scaledMoonDistance / zoomScale; // Unscaled distance

      // Calculate the true anomaly that would give this distance on the exaggerated orbit
      const lunarParams = this.planetaryReferences.moonOrbitalParams;
      const a = lunarParams.semiMajorAxis;
      const e = lunarParams.eccentricity;

      // From r = a(1-e²)/(1+e·cos(ν)), solve for ν:
      // cos(ν) = (a(1-e²)/r - 1) / e
      const cosNu = (a * (1 - e * e) / moonDistFromEarth - 1) / e;
      const trueAnomaly = Math.acos(Math.max(-1, Math.min(1, cosNu))); // Clamp for safety

      // Argument of perigee = moon's longitude - ascending node - true anomaly
      const argumentOfPerigee = moonLonDeg - northNodeDeg - THREE.MathUtils.radToDeg(trueAnomaly);
      const argumentOfPerigeeRad = THREE.MathUtils.degToRad(argumentOfPerigee);

      // Rotation order for Keplerian orbital elements:
      // The ellipse is drawn with perigee at +X
      // 1. Rotate by ω around Z-axis (puts ascending node at +X)
      // 2. Tilt by i around X-axis (along line of nodes)
      // 3. Rotate by Ω around Z-axis (orients nodes to correct ecliptic longitude)

      const perigeeRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        argumentOfPerigeeRad
      );
      const inclinationRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        inclinationRad
      );
      const nodeRotation = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        northNodeRad
      );

      // Apply rotations: ω first, then i, then Ω
      this.planetaryReferences.moonOrbitOutline.quaternion.copy(nodeRotation).multiply(inclinationRotation).multiply(perigeeRotation);

      // Position perigee, apogee, and Lilith markers on the lunar orbit
      if (this.planetaryReferences.lunarApsisGroups) {
        const params = this.planetaryReferences.moonOrbitalParams;
        const a = params.semiMajorAxis;
        const c = params.focalDistance;

        // Perigee is at angle 0° (closest point): x = a - c
        const perigeeLocal = new THREE.Vector3(a - c, 0, 0);

        // Apogee is at angle 180° (farthest point): x = -a - c
        const apogeeLocal = new THREE.Vector3(-a - c, 0, 0);

        // Black Moon Lilith is the empty focus: x = -2c
        const lilithLocal = new THREE.Vector3(-2 * c, 0, 0);

        // Apply same rotation and position as moon orbit
        const orbitQuat = this.planetaryReferences.moonOrbitOutline.quaternion;
        const perigeeWorld = perigeeLocal.clone().applyQuaternion(orbitQuat);
        const apogeeWorld = apogeeLocal.clone().applyQuaternion(orbitQuat);
        const lilithWorld = lilithLocal.clone().applyQuaternion(orbitQuat);

        this.planetaryReferences.lunarApsisGroups.perigee.position.set(
          earthX + perigeeWorld.x * zoomScale,
          earthY + perigeeWorld.y * zoomScale,
          perigeeWorld.z * zoomScale
        );
        this.planetaryReferences.lunarApsisGroups.apogee.position.set(
          earthX + apogeeWorld.x * zoomScale,
          earthY + apogeeWorld.y * zoomScale,
          apogeeWorld.z * zoomScale
        );
        this.planetaryReferences.lunarApsisGroups.lilith.position.set(
          earthX + lilithWorld.x * zoomScale,
          earthY + lilithWorld.y * zoomScale,
          lilithWorld.z * zoomScale
        );

        // Calculate zodiac positions for tooltips using astronomical data
        // We use the true astronomical values rather than deriving from the visual position
        // because the visual orbit might be exaggerated for visibility
        const apsides = astroCalc.calculateLunarApsides(julianDate);

        this.lunarApsisPositions['Perigee'] = astroCalc.toZodiacString(apsides.perigee - ayanamshaDeg);
        this.lunarApsisPositions['Apogee'] = astroCalc.toZodiacString(apsides.apogee - ayanamshaDeg);
        this.lunarApsisPositions['Black Moon Lilith'] = astroCalc.toZodiacString(apsides.lilith - ayanamshaDeg);

        // Also update the user data on the sprites themselves
        if (this.planetaryReferences) {
          this.planetaryReferences.updateLunarApsidesLongitudes(astroCalc, julianDate);
        }

        // Scale markers with zoom
        this.planetaryReferences.lunarApsisGroups.perigee.scale.set(zoomScale, zoomScale, zoomScale);
        this.planetaryReferences.lunarApsisGroups.apogee.scale.set(zoomScale, zoomScale, zoomScale);
        this.planetaryReferences.lunarApsisGroups.lilith.scale.set(zoomScale, zoomScale, zoomScale);

        // Show/hide with lunar orbit
        const lunarOrbitVisible = this.planetaryReferences.moonOrbitOutline.visible;
        this.planetaryReferences.lunarApsisGroups.perigee.visible = lunarOrbitVisible;
        this.planetaryReferences.lunarApsisGroups.apogee.visible = lunarOrbitVisible;
        this.planetaryReferences.lunarApsisGroups.lilith.visible = lunarOrbitVisible;
      }

      // 2.6b. Position Heliocentric Lunar Nodes on the exaggerated elliptical orbit
      // Now that the orbit quaternion is set, we can use it to find node positions
      if (this.heliocentricNodeGroups) {
        const params = this.planetaryReferences.moonOrbitalParams;
        const a = params.semiMajorAxis;
        const b = params.semiMinorAxis;
        const c = params.focalDistance;

        // Find where a ray at the target angle intersects the transformed ellipse
        const findIntersection = (targetAngle) => {
          let minAngleDiff = Infinity;
          let bestPoint = new THREE.Vector3();

          // Normalize target angle to [0, 2π)
          let normalizedTarget = targetAngle;
          while (normalizedTarget < 0) normalizedTarget += 2 * Math.PI;
          while (normalizedTarget >= 2 * Math.PI) normalizedTarget -= 2 * Math.PI;

          // Sample the ellipse at many points in local space
          const samples = 720;
          for (let i = 0; i <= samples; i++) {
            const theta = (i / samples) * 2 * Math.PI;

            // Point on ellipse in orbital plane (local coordinates)
            // Earth is at the focus, not the center
            const localPoint = new THREE.Vector3(
              a * Math.cos(theta) - c,
              b * Math.sin(theta),
              0
            );

            // Apply the orbit's quaternion transformation (same as the actual orbit)
            const worldPoint = localPoint.clone().applyQuaternion(this.planetaryReferences.moonOrbitOutline.quaternion);

            // Check angle from Earth (in the XY plane, which is the ecliptic)
            let angle = Math.atan2(worldPoint.y, worldPoint.x);
            // Normalize to [0, 2π)
            while (angle < 0) angle += 2 * Math.PI;
            while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;

            // Compute wrapped angle difference
            let angleDiff = Math.abs(angle - normalizedTarget);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            if (angleDiff < minAngleDiff) {
              minAngleDiff = angleDiff;
              bestPoint.copy(worldPoint);
            }
          }

          return bestPoint;
        };

        const northNodePos = findIntersection(northNodeRad);
        const southNodePos = findIntersection(southNodeRad);

        this.heliocentricNodeGroups.NORTH_NODE.position.set(
          earthX + northNodePos.x * zoomScale,
          earthY + northNodePos.y * zoomScale,
          northNodePos.z * zoomScale
        );
        this.heliocentricNodeGroups.SOUTH_NODE.position.set(
          earthX + southNodePos.x * zoomScale,
          earthY + southNodePos.y * zoomScale,
          southNodePos.z * zoomScale
        );

        // Scale nodes with zoom - keep them small and subtle
        const nodeBaseScale = 5; // Smaller base scale
        const nodeScale = nodeBaseScale * zoomScale;
        this.heliocentricNodeGroups.NORTH_NODE.scale.set(nodeScale, nodeScale, nodeScale);
        this.heliocentricNodeGroups.SOUTH_NODE.scale.set(nodeScale, nodeScale, nodeScale);

        // Show/hide with lunar orbit
        const lunarOrbitVisible2 = this.planetaryReferences.moonOrbitOutline.visible;
        this.heliocentricNodeGroups.NORTH_NODE.visible = lunarOrbitVisible2;
        this.heliocentricNodeGroups.SOUTH_NODE.visible = lunarOrbitVisible2;
      }
    }

    // 2.7. Scale sun references group (ecliptic plane with 360 dots) with distance compression
    // The ecliptic extends to STAR_FIELD_RADIUS, so scale it down with distance compression
    // Use Pluto's compressed distance as reference (it's the outermost planet)
    if (this.planetaryReferences.sunReferencesGroup) {
      const compressedPlutoDistAU = Math.pow(39.48, distanceExponent);
      const compressionScale = compressedPlutoDistAU / 39.48; // Ratio of compressed to original
      const eclipticScale = compressionScale * zoomScale;
      this.planetaryReferences.sunReferencesGroup.scale.set(eclipticScale, eclipticScale, eclipticScale);
    }

    // 2.8. Planet orbital paths are now updated dynamically in updatePlanetOrbits()
    // No additional scaling needed here since orbits are regenerated with correct transformations

    // 3. Position Planets (Heliocentric)
    const planetNames = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

    // Scale planets down in horizon view to make them look less overwhelming
    const planetScale = distToObserver < this.VIEW_MODE_THRESHOLD ? 0.005 : 1.0;

    planetNames.forEach(planetName => {
      if (this.planetGroups[planetName]) {
        const planetData = astroCalc.calculatePlanetPosition(planetName, julianDate);

        // Use geocentric longitude for tooltip display
        const geocentricDeg = THREE.MathUtils.radToDeg(planetData.geocentricLongitude);

        // Use heliocentric latitude for 3D positioning (must match orbital elements)
        const planetLatRad = planetData.heliocentricLatitude || 0;

        // Use heliocentric coordinates for 3D positioning relative to Sun
        let planetLonRad, distance;

        if (planetData.heliocentricLongitude !== null && planetData.heliocentricDistance !== null) {
          // Use actual heliocentric position
          planetLonRad = planetData.heliocentricLongitude;
          distance = planetData.heliocentricDistance * this.PLANET_DISTANCE_SCALE;
        } else {
          // Fallback to average orbital distance
          planetLonRad = planetData.geocentricLongitude;
          distance = this.planetGroups[planetName].distance;
        }

        // Apply zoom scale and distance compression
        // Use power function to compress orbital distance ratios (same approach as size)
        // At max zoom, use exponent 0.35 to bring planets much closer together
        const distanceInAU = planetData.heliocentricDistance || (distance / this.PLANET_DISTANCE_SCALE);
        const distanceExponent = 1.0 - this.planetZoomFactor * 0.65; // 1.0 at no zoom, 0.35 at max zoom
        const compressedDistanceAU = Math.pow(distanceInAU, distanceExponent);
        const compressedDistance = compressedDistanceAU * this.PLANET_DISTANCE_SCALE;
        const adjustedDistance = compressedDistance * zoomScale;

        const pRad = planetLonRad;
        const pLat = planetLatRad;

        // Position planet relative to Sun at origin (heliocentric)
        // x = r * cos(lat) * cos(lon)
        // y = r * cos(lat) * sin(lon)
        // z = r * sin(lat)
        const x = adjustedDistance * Math.cos(pLat) * Math.cos(pRad);
        const y = adjustedDistance * Math.cos(pLat) * Math.sin(pRad);
        // Exaggerate ecliptic latitude (Z coordinate) by the same factor as planet sizes for visibility
        const z = adjustedDistance * Math.sin(pLat) * sizeMultiplier;

        this.planetGroups[planetName].group.position.set(x, y, z);

        // Apply both horizon view scale and planet zoom size multiplier
        // Add proportional size equalization at higher zoom levels
        // Use different strategies for small vs large planets:
        // - Small planets (< Earth): aggressive compression to bring close to Earth size
        // - Large planets (> Earth): minimal compression to keep them big
        const radiusRatio = this.planetGroups[planetName].radiusRatio || 1.0;
        let equalizedRatio;

        if (radiusRatio < 1.0) {
          // Small planets: use very aggressive compression (exponent 0.15 at max zoom)
          // Mercury (0.38) -> 0.38^0.15 = 0.89x, Mars (0.53) -> 0.53^0.15 = 0.91x
          const exponent = 1.0 - this.planetZoomFactor * 0.85; // 1.0 at no zoom, 0.15 at max zoom
          equalizedRatio = Math.pow(radiusRatio, exponent);
        } else {
          // Large planets: minimal compression to keep them large
          // Jupiter (11) -> 11^0.85 = 8.9x, Saturn (9.1) -> 9.1^0.85 = 7.5x
          const exponent = 1.0 - this.planetZoomFactor * 0.15; // 1.0 at no zoom, 0.85 at max zoom
          equalizedRatio = Math.pow(radiusRatio, exponent);
        }

        const equalizationFactor = equalizedRatio / radiusRatio; // How much to adjust from original ratio
        const finalScale = planetScale * sizeMultiplier * equalizationFactor;
        this.planetGroups[planetName].group.scale.set(finalScale, finalScale, finalScale);

        // Store planet zodiac position for tooltip (using geocentric longitude)
        this.planetZodiacPositions[planetName] = astroCalc.toZodiacString(geocentricDeg - ayanamshaDeg);

        // Position ecliptic planet on zodiac wheel (using geocentric longitude)
        if (this.eclipticPlanetGroups[planetName]) {
          this.eclipticPlanetGroups[planetName].group.position.copy(placeOnZodiac(geocentricDeg));
        }
      }
    });

    // 4. Handle collision transparency for overlapping ecliptic objects
    // Collect all ecliptic objects (sun, moon, planets) with their positions
    const eclipticObjects = [];

    // Add sun
    const sunPos = this.eclipticSunGroup.position.clone();
    eclipticObjects.push({
      name: 'sun',
      position: sunPos,
      mesh: this.eclipticSunMesh,
      glowMeshes: this.eclipticSunGlowMeshes,
      baseOpacity: 1.0
    });

    // Add moon
    const eclipticMoonPos = this.eclipticMoonGroup.position.clone();
    eclipticObjects.push({
      name: 'moon',
      position: eclipticMoonPos,
      mesh: this.eclipticMoonMesh,
      glowMeshes: this.moonGlowMeshes,
      baseOpacity: 1.0
    });

    // Add planets
    planetNames.forEach(planetName => {
      if (this.eclipticPlanetGroups[planetName]) {
        const planetPos = this.eclipticPlanetGroups[planetName].group.position.clone();
        eclipticObjects.push({
          name: planetName,
          position: planetPos,
          mesh: this.eclipticPlanetGroups[planetName].mesh,
          ringMesh: this.eclipticPlanetGroups[planetName].ringMesh, // For Saturn
          glowMeshes: [],
          baseOpacity: 1.0
        });
      }
    });

    // Calculate distances and adjust opacity based on proximity
    const collisionThreshold = this.CE_RADIUS * 0.3; // Distance threshold for transparency

    eclipticObjects.forEach(obj => {
      let minDistance = Infinity;

      // Find minimum distance to other objects
      eclipticObjects.forEach(other => {
        if (obj !== other) {
          const distance = obj.position.distanceTo(other.position);
          minDistance = Math.min(minDistance, distance);
        }
      });

      // Calculate opacity based on minimum distance
      // Full opacity when far apart, reduced opacity when close
      let opacity = 1.0;
      if (minDistance < collisionThreshold) {
        // Linear fade from 1.0 to 0.3 as distance decreases
        opacity = 0.3 + (0.7 * (minDistance / collisionThreshold));
      }

      // Apply opacity to main mesh
      obj.mesh.material.opacity = opacity;
      // Disable depth write when transparent to avoid rendering artifacts
      obj.mesh.material.depthWrite = opacity >= 1.0;

      // Apply opacity to ring mesh (Saturn only)
      if (obj.ringMesh) {
        obj.ringMesh.material.opacity = opacity;
        obj.ringMesh.material.depthWrite = opacity >= 1.0;
      }

      // Apply opacity to glow meshes (sun and moon only)
      if (obj.glowMeshes && obj.glowMeshes.length > 0) {
        obj.glowMeshes.forEach((glowMesh, index) => {
          // Glow meshes have their own base opacity, scale it proportionally
          const baseGlowOpacity = index === 0 ? 0.1 : 0.1;
          glowMesh.material.opacity = baseGlowOpacity * opacity;
        });
      }
    });

    debugLog.log('=== Done updating planets ===');

    // -----------------------------------------------------------
    // 7. UI Updates
    // -----------------------------------------------------------
    document.getElementById("lstValue").textContent = astroCalc.lstToTimeString(LSTdeg);
    document.getElementById("mcValue").textContent = astroCalc.toZodiacString(MCdeg - ayanamshaDeg);
    document.getElementById("acValue").textContent = astroCalc.toZodiacString(ACdeg - ayanamshaDeg);

    // Update sun color based on whether it's above or below the horizon
    // We check the sun's position in the armillaryRoot's local space (where Y is Up)
    this.scene.updateMatrixWorld(true);
    const sunWorldPos = new THREE.Vector3();
    this.eclipticSunGroup.getWorldPosition(sunWorldPos);
    const sunLocalPos = this.armillaryRoot.worldToLocal(sunWorldPos.clone());

    // Use a small negative threshold to account for the sun's radius and visual overlap
    if (sunLocalPos.y > -0.05) {
      this.eclipticSunMesh.material.color.setHex(0xffaa44);
    } else {
      this.eclipticSunMesh.material.color.setHex(0xA04C28);
    }
    this.eclipticSunMesh.material.needsUpdate = true;
  }

  // ===================================================================
  // Animation Loop
  // ===================================================================

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.cameraController.updateEarthVisibility();
    this.updateOrbitVisibility();

    if (this.cameraController.stereoEnabled) {
      // Update stereo camera positions based on main camera
      this.cameraController.updateStereoCameras();

      const width = window.innerWidth;
      const height = window.innerHeight;
      const halfWidth = width / 2;

      // Render right eye to left half (swapped for cross-eyed viewing)
      this.renderer.setViewport(0, 0, halfWidth, height);
      this.renderer.setScissor(0, 0, halfWidth, height);
      this.renderer.render(this.scene, this.rightCamera);

      // Render left eye to right half (swapped for cross-eyed viewing)
      this.renderer.setViewport(halfWidth, 0, halfWidth, height);
      this.renderer.setScissor(halfWidth, 0, halfWidth, height);
      this.renderer.render(this.scene, this.leftCamera);
    } else {
      // Normal single viewport rendering
      this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
      this.renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateOrbitVisibility() {
    const distToObserver = this.camera.position.distanceTo(this.armillaryRoot.position);
    const isEarthView = (distToObserver >= this.VIEW_MODE_THRESHOLD);

    // Lunar Orbit & Nodes
    const lunarOrbitToggle = document.getElementById('lunarOrbitToggle');
    if (lunarOrbitToggle) {
      const shouldShow = lunarOrbitToggle.checked && isEarthView;
      // Check current state to avoid redundant updates
      const currentVisible = this.planetaryReferences.moonOrbitOutline?.visible ?? false;
      if (currentVisible !== shouldShow) {
        this.toggleLunarOrbit(shouldShow);
      }
    }

    // Planet Orbits
    const planetOrbitsToggle = document.getElementById('planetOrbitsToggle');
    if (planetOrbitsToggle) {
      const shouldShow = planetOrbitsToggle.checked && isEarthView;
      // Check current state of one planet orbit as proxy
      const firstPlanetOrbit = this.planetaryReferences.planetOrbits ? Object.values(this.planetaryReferences.planetOrbits)[0] : null;
      const currentVisible = firstPlanetOrbit?.visible ?? false;

      if (this.planetaryReferences.planetOrbits && Object.keys(this.planetaryReferences.planetOrbits).length > 0) {
        if (currentVisible !== shouldShow) {
          this.togglePlanetOrbits(shouldShow);
        }
      }
    }
  }

  // ===================================================================
  // Delegated Methods (forwarded to modules)
  // ===================================================================

  zoomToTarget(targetName) {
    this.cameraController.zoomToTarget(targetName);
  }

  toggleStereo(enabled) {
    this.cameraController.toggleStereo(enabled);
  }

  setEyeSeparation(separation) {
    this.cameraController.setEyeSeparation(separation);
  }

  setPlanetZoom(zoom) {
    // Store zoom factor (0 = accurate, 1.0 = max zoom)
    // This will be used in updateSphere to adjust planet positions and sizes
    this.planetZoomFactor = zoom;
    // Update camera position if zoomed to a target (after updateSphere recalculates positions)
    if (this.cameraController) {
      // Defer camera update to after next render so new scales are applied
      requestAnimationFrame(() => {
        this.cameraController.updateForPlanetZoom();
      });
    }
  }

  toggleStarfield(visible) {
    this.cameraController.toggleStarfield(visible);
  }

  toggleConstellationArt(visible) {
    this.constellationArtAlwaysOn = visible;
    if (this.constellationFigureGroup) {
      if (visible) {
        // Show all constellation figures
        this.constellationFigureGroup.children.forEach(mesh => {
          mesh.visible = true;
          mesh.material.opacity = 0.7;
        });
      } else {
        // Hide all constellation figures
        this.constellationFigureGroup.children.forEach(mesh => {
          mesh.visible = false;
          mesh.material.opacity = 0;
        });
      }
    }
  }

  togglePlanets(visible) {
    // Toggle planets (Mercury through Pluto) and the realistic sun
    // Keep Earth, Moon, and ecliptic sun/moon visible
    Object.keys(this.celestialObjects.planetGroups).forEach(planetName => {
      this.celestialObjects.planetGroups[planetName].group.visible = visible;
    });
    // Toggle ecliptic planets (on zodiac wheel) except sun and moon
    Object.keys(this.celestialObjects.eclipticPlanetGroups).forEach(planetName => {
      this.celestialObjects.eclipticPlanetGroups[planetName].group.visible = visible;
    });
    // Hide the realistic sun and moon
    this.celestialObjects.realisticSunGroup.visible = visible;
    this.celestialObjects.realisticMoonGroup.visible = visible;
  }

  toggleEarthReferences(visible) {
    this.planetaryReferences.toggleEarthReferences(visible);

    // Update Earth depthWrite to match reference visibility
    // Only enable in Earth view (not horizon view)
    const distToObserver = this.camera.position.distanceTo(this.armillaryRoot.position);
    const isEarthView = (distToObserver >= this.VIEW_MODE_THRESHOLD);
    const shouldShowEarthRefs = visible && isEarthView;

    // Check if Sun ecliptic plane is visible
    const sunEclipticVisible = document.getElementById('sunReferencesToggle') &&
      document.getElementById('sunReferencesToggle').checked;

    // Check if lunar orbit is visible
    const lunarOrbitVisible = this.planetaryReferences.moonOrbitOutline &&
      this.planetaryReferences.moonOrbitOutline.visible;

    // Enable Earth depthWrite when Earth references OR Sun ecliptic plane OR lunar orbit are visible
    const shouldEnableDepth = shouldShowEarthRefs || sunEclipticVisible || lunarOrbitVisible;

    if (this.earthMaterial && this.earthMaterial.depthWrite !== shouldEnableDepth) {
      this.earthMaterial.depthWrite = shouldEnableDepth;
      this.earthMaterial.needsUpdate = true;
    }
  }

  toggleSunReferences(visible) {
    this.planetaryReferences.toggleSunReferences(visible);

    // NOTE: Heliocentric lunar nodes are now toggled with the lunar orbit (in updateSphere)
    // not with the ecliptic plane

    // Update Earth depthWrite when ecliptic plane is toggled
    // Check if Earth references are also visible
    const distToObserver = this.camera.position.distanceTo(this.armillaryRoot.position);
    const isEarthView = (distToObserver >= this.VIEW_MODE_THRESHOLD);
    const shouldShowEarthRefs = isEarthView &&
      document.getElementById('earthReferencesToggle') &&
      document.getElementById('earthReferencesToggle').checked;

    // Check if lunar orbit is visible
    const lunarOrbitVisible = this.planetaryReferences.moonOrbitOutline &&
      this.planetaryReferences.moonOrbitOutline.visible;

    // Enable Earth depthWrite when Earth references OR Sun ecliptic plane OR lunar orbit are visible
    const shouldEnableDepth = shouldShowEarthRefs || visible || lunarOrbitVisible;

    if (this.earthMaterial && this.earthMaterial.depthWrite !== shouldEnableDepth) {
      this.earthMaterial.depthWrite = shouldEnableDepth;
      this.earthMaterial.needsUpdate = true;
    }
  }

  toggleLunarOrbit(visible) {
    // Toggle moon orbit outline
    this.planetaryReferences.toggleLunarOrbit(visible);

    // Toggle lunar nodes in horizon view (spheres and labels)
    if (this.nodeSpheres) {
      Object.values(this.nodeSpheres).forEach(sphere => {
        sphere.visible = visible;
      });
    }
    if (this.nodeLabels) {
      Object.values(this.nodeLabels).forEach(label => {
        label.visible = visible;
      });
    }

    // Toggle heliocentric lunar nodes
    if (this.heliocentricNodeGroups) {
      Object.values(this.heliocentricNodeGroups).forEach(nodeGroup => {
        nodeGroup.visible = visible;
      });
    }

    // Toggle lunar apsis markers (perigee/apogee)
    if (this.planetaryReferences.lunarApsisGroups) {
      Object.values(this.planetaryReferences.lunarApsisGroups).forEach(apsisGroup => {
        apsisGroup.visible = visible;
      });
    }

    // Update Earth depthWrite when lunar orbit is toggled
    const distToObserver = this.camera.position.distanceTo(this.armillaryRoot.position);
    const isEarthView = (distToObserver >= this.VIEW_MODE_THRESHOLD);
    const shouldShowEarthRefs = isEarthView &&
      document.getElementById('earthReferencesToggle') &&
      document.getElementById('earthReferencesToggle').checked;

    // Check if Sun ecliptic plane is visible
    const sunEclipticVisible = document.getElementById('sunReferencesToggle') &&
      document.getElementById('sunReferencesToggle').checked;

    // Enable Earth depthWrite when Earth references OR Sun ecliptic plane OR lunar orbit are visible
    const shouldEnableDepth = shouldShowEarthRefs || sunEclipticVisible || visible;

    if (this.earthMaterial && this.earthMaterial.depthWrite !== shouldEnableDepth) {
      this.earthMaterial.depthWrite = shouldEnableDepth;
      this.earthMaterial.needsUpdate = true;
    }
  }

  togglePlanetOrbits(visible) {
    this.planetaryReferences.togglePlanetOrbits(visible);
    this.planetaryReferences.togglePlanetaryNodes(visible);
    this.planetaryReferences.togglePlanetaryApsides(visible);
  }

  // ===================================================================
  // Debug Helper
  // ===================================================================

  addDiagnosticMarkers() {
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const geom = new THREE.SphereGeometry(0.06, 16, 16);

    const angles = {
        "0° Aries": 0,
        "90° Cancer": 90,
        "180° Libra": 180,
        "270° Capricorn": 270
    };

    for (const [label, deg] of Object.entries(angles)) {
        const rad = THREE.MathUtils.degToRad(deg);

        const sphere = new THREE.Mesh(geom, material);
        sphere.position.set(
            this.CE_RADIUS * Math.cos(rad),
            this.CE_RADIUS * Math.sin(rad),
            0
        );

        this.zodiacGroup.add(sphere);
        debugLog.log("Placed diagnostic marker:", label, deg);
    }
  }
}
