// scene.js - 3D scene rendering with Three.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { starData, constellationLines } from './stardata.js';

export class ArmillaryScene {
  constructor() {
    this.obliquity = 23.44 * Math.PI / 180;
    this.CE_RADIUS = 3; // Celestial sphere radius (local horizon visualization scale)
    this.EARTH_RADIUS = 1.0; // Earth's radius in scene units

    // Fudged distances for visibility (keeping relative proportions)
    this.PLANET_RADIUS_SCALE = 3; // Scale factor to make all bodies visible
    this.PLANET_DISTANCE_SCALE = 30; // Scale factor for planet orbital distances

    this.SUN_DISTANCE = 300; // Sun distance (much closer than reality for visibility)
    this.SUN_RADIUS = 109 * this.EARTH_RADIUS * this.PLANET_RADIUS_SCALE; // Sun is ~109× Earth
    this.MOON_DISTANCE = 15; // Moon distance from Earth
    this.MOON_RADIUS = 0.273 * this.EARTH_RADIUS * this.PLANET_RADIUS_SCALE; // Moon is ~27.3% Earth
    this.SUN_TEXTURE_PATH = '/armillary/images/sun_texture.jpg';
    this.REALISTIC_SUN_TEXTURE_PATH = '/armillary/images/sun_texture_orange.jpg';
    this.MOON_TEXTURE_PATH = '/armillary/images/moon_texture.jpg';
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

    this.scene = null;
    this.camera = null;
    this.leftCamera = null;
    this.rightCamera = null;
    this.renderer = null;
    this.controls = null;
    this.stereoEnabled = false;
    this.eyeSeparation = 0.3; // Distance between eyes for stereo effect

    this.tiltGroup = null;
    this.celestial = null;
    this.zodiacGroup = null;
    this.starGroup = null;
    this.constellationLineGroup = null;
    this.bgStarField = null;
    this.starMeshes = {}; // Store star meshes for hover detection

    // Store reference circles for hover detection
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
    this.eclipticMoonGroup = null;
    this.eclipticMoonMesh = null;
    this.realisticMoonGroup = null;
    this.realisticMoonMesh = null;
    this.moonGlowMeshes = [];
    this.realisticMoonGlowMeshes = [];
    this.planetGroups = {}; // Store planet groups
    this.planetZodiacPositions = {}; // Store planet zodiac positions for tooltips

    // Cache for sunrise/sunset calculation
    this.cachedRiseSet = null;
    this.riseSetCacheKey = null;

    // Store lunar phase info for tooltip
    this.lunarPhase = { phase: "", illumination: 0 };

    // Store sun/moon positions for tooltips
    this.sunZodiacPosition = "";
    this.moonZodiacPosition = "";
    this.sunRiseSet = { sunrise: "--", sunset: "--" };

    // Store angle positions for tooltips
    this.anglePositions = {
      MC: "",
      IC: "",
      ASC: "",
      DSC: "",
      VTX: "",
      AVX: ""
    };

    this.initScene();
    this.initGroups();
    this.createFixedReferences();
    this.createCelestialEquator();
    this.createEclipticZodiacWheel();
    this.createStarField();
    this.createSun();
    this.createMoon();
    this.createPlanets();
    debugLog.log('After createPlanets, planetGroups:', Object.keys(this.planetGroups));
    this.createAngleSpheres();
    this.createAngleLabels();
    this.setupStarHover();
    this.setupPlanetDoubleClick();
    this.setupContextMenu();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    // Create main camera for normal (non-stereo) view and controls
    // Position camera to view from north (East/ASC on left, West/DSC on right)
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 3.2, 6);
    this.camera.lookAt(0, 0, 0);

    // Create stereo cameras (left and right eye)
    const aspect = (window.innerWidth / 2) / window.innerHeight; // Half width for each eye
    this.leftCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.rightCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setScissorTest(true); // Enable scissor test for split viewport
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    window.addEventListener('resize', () => {
      this.onWindowResize();
    });
  }

  initGroups() {
    this.tiltGroup = new THREE.Group();
    this.scene.add(this.tiltGroup);

    this.celestial = new THREE.Group();
    this.tiltGroup.add(this.celestial);

    this.zodiacGroup = new THREE.Group();
    this.zodiacGroup.rotation.x = this.obliquity;
    this.celestial.add(this.zodiacGroup);
  }

  createFixedReferences() {
    const planeOpts = { side: THREE.DoubleSide, transparent: true, opacity: 0.1 };

    // Horizon plane
    const horizonPlane = new THREE.Mesh(
      new THREE.CircleGeometry(this.CE_RADIUS, 64),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, ...planeOpts })
    );
    horizonPlane.rotation.x = -Math.PI / 2;
    this.scene.add(horizonPlane);

    // Horizon outline
    const horizonOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      horizonOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    this.horizonOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(horizonOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.horizonOutline.rotation.x = -Math.PI / 2;
    this.horizonOutline.userData.circleName = "Horizon";
    this.scene.add(this.horizonOutline);

    // Compass rose
    this.createCompassRose();

    // Meridian outline
    const meridianOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      meridianOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    this.meridianOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(meridianOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.meridianOutline.rotation.y = Math.PI / 2;
    this.meridianOutline.userData.circleName = "Meridian";
    this.scene.add(this.meridianOutline);

    // Prime vertical outline
    const pvOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pvOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    this.primeVerticalOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pvOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.primeVerticalOutline.userData.circleName = "Prime Vertical";
    this.scene.add(this.primeVerticalOutline);

    // Compass labels
    this.addCompassLabels();
  }

  createCompassRose() {
    const compassRosetteGroup = new THREE.Group();

    const solidMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });

    const outlineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      opacity: 0.25,
      transparent: true,
      linewidth: 0.5
    });

    const createSplitCompassPoint = (angle, length, width, leftFilled) => {
      const group = new THREE.Group();
      const center = new THREE.Vector3(0, 0, 0);
      const tip = new THREE.Vector3(length * Math.sin(angle), 0, length * Math.cos(angle));
      const left = new THREE.Vector3(width * Math.sin(angle - Math.PI / 2), 0, width * Math.cos(angle - Math.PI / 2));
      const right = new THREE.Vector3(width * Math.sin(angle + Math.PI / 2), 0, width * Math.cos(angle + Math.PI / 2));

      if (leftFilled) {
        const leftShape = new THREE.Shape();
        leftShape.moveTo(0, 0);
        leftShape.lineTo(left.x, left.z);
        leftShape.lineTo(tip.x, tip.z);
        leftShape.lineTo(0, 0);

        const leftGeometry = new THREE.ShapeGeometry(leftShape);
        const leftMesh = new THREE.Mesh(leftGeometry, solidMaterial);
        leftMesh.rotation.x = -Math.PI / 2;
        group.add(leftMesh);

        const leftOutlinePoints = [center.clone(), left.clone(), tip.clone(), center.clone()];
        const leftOutlineGeometry = new THREE.BufferGeometry().setFromPoints(leftOutlinePoints);
        const leftOutline = new THREE.Line(leftOutlineGeometry, outlineMaterial);
        group.add(leftOutline);

        const rightPoints = [center.clone(), right.clone(), tip.clone(), center.clone()];
        const rightGeometry = new THREE.BufferGeometry().setFromPoints(rightPoints);
        const rightLine = new THREE.Line(rightGeometry, outlineMaterial);
        group.add(rightLine);
      } else {
        const rightShape = new THREE.Shape();
        rightShape.moveTo(0, 0);
        rightShape.lineTo(right.x, right.z);
        rightShape.lineTo(tip.x, tip.z);
        rightShape.lineTo(0, 0);

        const rightGeometry = new THREE.ShapeGeometry(rightShape);
        const rightMesh = new THREE.Mesh(rightGeometry, solidMaterial);
        rightMesh.rotation.x = -Math.PI / 2;
        group.add(rightMesh);

        const rightOutlinePoints = [center.clone(), right.clone(), tip.clone(), center.clone()];
        const rightOutlineGeometry = new THREE.BufferGeometry().setFromPoints(rightOutlinePoints);
        const rightOutline = new THREE.Line(rightOutlineGeometry, outlineMaterial);
        group.add(rightOutline);

        const leftPoints = [center.clone(), left.clone(), tip.clone(), center.clone()];
        const leftGeometry = new THREE.BufferGeometry().setFromPoints(leftPoints);
        const leftLine = new THREE.Line(leftGeometry, outlineMaterial);
        group.add(leftLine);
      }

      return group;
    };

    const allPoints = [
      { angle: 0, length: 1.0, width: 0.12, leftFilled: true },
      { angle: Math.PI / 4, length: 0.7, width: 0.10, leftFilled: false },
      { angle: Math.PI / 2, length: 1.0, width: 0.12, leftFilled: true },
      { angle: 3 * Math.PI / 4, length: 0.7, width: 0.10, leftFilled: false },
      { angle: Math.PI, length: 1.0, width: 0.12, leftFilled: true },
      { angle: 5 * Math.PI / 4, length: 0.7, width: 0.10, leftFilled: false },
      { angle: 3 * Math.PI / 2, length: 1.0, width: 0.12, leftFilled: true },
      { angle: 7 * Math.PI / 4, length: 0.7, width: 0.10, leftFilled: false }
    ];

    allPoints.forEach(point => {
      const pointGroup = createSplitCompassPoint(point.angle, point.length, point.width, point.leftFilled);
      compassRosetteGroup.add(pointGroup);
    });

    compassRosetteGroup.position.y = 0.01;
    this.scene.add(compassRosetteGroup);
  }

  addCompassLabels() {
    const compassRadius = 2.5;
    const addCompassLabel = (text, x, z, rotZ = 0) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 64px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);
      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.position.set(x, 0.01, z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotZ;
      this.scene.add(mesh);
    };

    addCompassLabel('N', 0, compassRadius, 0);
    addCompassLabel('S', 0, -compassRadius, Math.PI);
    addCompassLabel('E', -compassRadius, 0, Math.PI / 2);  // Swapped: E is now at -X (left when facing N)
    addCompassLabel('W', compassRadius, 0, -Math.PI / 2);   // Swapped: W is now at +X (right when facing N)
  }

  createCelestialEquator() {
    const ceqPoints = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ceqPoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(a), this.CE_RADIUS * Math.sin(a), 0));
    }
    this.celestialEquatorOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ceqPoints),
      new THREE.LineDashedMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true, dashSize: 0.5, gapSize: 0.3 })
    );
    this.celestialEquatorOutline.computeLineDistances();
    this.celestialEquatorOutline.userData.circleName = "Celestial Equator";
    this.celestial.add(this.celestialEquatorOutline);

    // Celestial poles
    const polarLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true });
    const polarLineLength = 0.67;

    const npLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, this.CE_RADIUS),
        new THREE.Vector3(0, 0, this.CE_RADIUS + polarLineLength)
      ]),
      polarLineMaterial
    );
    this.celestial.add(npLine);

    const spLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -this.CE_RADIUS),
        new THREE.Vector3(0, 0, -this.CE_RADIUS - polarLineLength)
      ]),
      polarLineMaterial
    );
    this.celestial.add(spLine);

    // Pole labels
    const addPoleLabel = (name, z) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 64, 32);
      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1, 0.5, 1);
      sprite.position.set(0, 0, z);
      sprite.userData.poleName = name; // Store pole name for tooltip
      this.celestial.add(sprite);
      return sprite;
    };

    this.poleLabels.NP = addPoleLabel('NP', this.CE_RADIUS + polarLineLength);
    this.poleLabels.SP = addPoleLabel('SP', -this.CE_RADIUS - polarLineLength);
  }

  createEclipticZodiacWheel() {
    const ecliptic = new THREE.Mesh(
      new THREE.CircleGeometry(this.CE_RADIUS, 128),
      new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.1 })
    );
    this.zodiacGroup.add(ecliptic);

    const eclipticOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      eclipticOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    const eclipticOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eclipticOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.5, transparent: true })
    );
    this.zodiacGroup.add(eclipticOutline);

    // Radial lines
    const radialLineMaterial = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.3, transparent: true });
    for (let i = 0; i < 12; i++) {
      const angle = THREE.MathUtils.degToRad(i * 30);
      const radialLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0)
        ]),
        radialLineMaterial
      );
      this.zodiacGroup.add(radialLine);
    }

    // Zodiac glyphs
    const zodiacRadius = 2.3;
    const zodiacGlyphs = Array.from({ length: 12 }, (_, i) => String.fromCodePoint(0x2648 + i) + '\uFE0E');

    zodiacGlyphs.forEach((glyph, i) => {
      const angle = THREE.MathUtils.degToRad(i * 30 + 15);
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      // RENDER TEXT NORMALLY
      // Removed ctx.scale(-1, 1) which was causing the "backwards" mirror effect.
      ctx.fillStyle = 'white';
      ctx.font = 'bold 84px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthTest: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat);
      mesh.position.set(zodiacRadius * Math.cos(angle), zodiacRadius * Math.sin(angle), 0);
      
      // ROTATION FIX:
      // angle is direction from center.
      // angle - Math.PI/2 ensures the local "Up" (top of glyph) aligns with the outward vector.
      mesh.rotation.z = angle - Math.PI / 2;
      this.zodiacGroup.add(mesh);
    });
  }

  createStarField() {
    this.starGroup = new THREE.Group();
    this.constellationLineGroup = new THREE.Group();

    // Convert RA/Dec to cartesian coordinates on celestial sphere
    const raDecToVector3 = (ra_hours, dec_deg, radius) => {
      const ra = (ra_hours / 24) * Math.PI * 2;
      const dec = THREE.MathUtils.degToRad(dec_deg);

      const x = radius * Math.cos(dec) * Math.cos(ra);
      const y = radius * Math.cos(dec) * Math.sin(ra);
      const z = radius * Math.sin(dec);

      return new THREE.Vector3(x, y, z);
    };

    // Star size multiplier - adjust this constant to make stars larger/smaller
    const k = 0.4; // Increase to make stars bigger, decrease to make them smaller

    // Create stars
    starData.forEach(([name, ra, dec, mag, constellation]) => {
      const size = k * Math.max(0.3, 1.0 - mag * 0.2);
      const brightness = Math.max(0.3, 1.0 - mag * 0.15);

      const starGeometry = new THREE.SphereGeometry(size, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(brightness, brightness, brightness * 0.95)
      });

      const star = new THREE.Mesh(starGeometry, starMaterial);
      const position = raDecToVector3(ra, dec, this.CE_RADIUS * 75);
      star.position.copy(position);
      star.userData = { name, constellation };

      this.starGroup.add(star);
      this.starMeshes[name] = star; // Store in instance variable

      // Add glow layers
      const baseGlowOpacity = Math.max(0.15, 0.5 - mag * 0.06);
      const starGlowLayers = [
        { size: size * 1.5, opacity: baseGlowOpacity * 0.9, color: new THREE.Color(brightness, brightness, brightness * 0.98) },
        { size: size * 2.5, opacity: baseGlowOpacity * 0.6, color: new THREE.Color(brightness * 0.95, brightness * 0.95, brightness * 0.9) },
        { size: size * 4.0, opacity: baseGlowOpacity * 0.4, color: new THREE.Color(brightness * 0.9, brightness * 0.9, brightness * 0.85) },
        { size: size * 6.0, opacity: baseGlowOpacity * 0.2, color: new THREE.Color(brightness * 0.85, brightness * 0.85, brightness * 0.8) }
      ];

      starGlowLayers.forEach((layer) => {
        const glowGeometry = new THREE.SphereGeometry(layer.size, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending
        });

        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(position);
        glow.userData = { name, constellation };

        this.starGroup.add(glow);
      });
    });

    // Add constellation lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x5555cc,
      transparent: true,
      opacity: 0.3,
      linewidth: 1
    });

    constellationLines.forEach(([star1, star2]) => {
      if (this.starMeshes[star1] && this.starMeshes[star2]) {
        const points = [
          this.starMeshes[star1].position.clone(),
          this.starMeshes[star2].position.clone()
        ];
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(lineGeometry, lineMaterial);
        this.constellationLineGroup.add(line);
      }
    });

    this.celestial.add(this.starGroup);
    this.celestial.add(this.constellationLineGroup);

    // Outer ecliptic line (gray dashed circle in the star field)
    const outerEclipticRadius = this.CE_RADIUS * 75;
    const outerEclipticPoints = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      outerEclipticPoints.push(new THREE.Vector3(
        outerEclipticRadius * Math.cos(a),
        outerEclipticRadius * Math.sin(a),
        0
      ));
    }
    this.outerEclipticLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(outerEclipticPoints),
      new THREE.LineDashedMaterial({
        color: 0x888888,
        opacity: 0.3,
        transparent: true,
        dashSize: 2.0,
        gapSize: 2.0
      })
    );
    this.outerEclipticLine.computeLineDistances();
    this.outerEclipticLine.userData.circleName = "Ecliptic";
    this.zodiacGroup.add(this.outerEclipticLine);

    // Background stars
    const bgStarCount = 1000;
    const bgStarGeometry = new THREE.BufferGeometry();
    const bgStarPositions = [];
    const bgStarColors = [];

    for (let i = 0; i < bgStarCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = this.CE_RADIUS * 150;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      bgStarPositions.push(x, y, z);

      const brightness = 0.1 + Math.random() * 0.3;
      bgStarColors.push(brightness, brightness, brightness * 0.98);
    }

    bgStarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bgStarPositions, 3));
    bgStarGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bgStarColors, 3));

    const bgStarMaterial = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.4
    });

    this.bgStarField = new THREE.Points(bgStarGeometry, bgStarMaterial);
    this.celestial.add(this.bgStarField);
  }

  createSun() {
    const textureLoader = new THREE.TextureLoader();
    this.sunTexture = textureLoader.load(this.SUN_TEXTURE_PATH); // Store for referencing later
    const realisticSunTexture = textureLoader.load(this.REALISTIC_SUN_TEXTURE_PATH);

    const eclipticSunRadius = 0.18;

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticSunRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: this.sunTexture,
        color: 0xffaa44,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      })
    );

    const eclipticSunGlowLayers = [
      { size: eclipticSunRadius * 1.15, opacity: 0.1, color: 0xffff99 },
      { size: eclipticSunRadius * 1.4, opacity: 0.1, color: 0xffcc66 }
    ];

    this.eclipticSunGroup = new THREE.Group();
    this.eclipticSunGroup.add(sun);

    // Store reference to the main sun mesh for color updates
    this.eclipticSunMesh = sun;
    this.eclipticSunGlowMeshes = [];

    eclipticSunGlowLayers.forEach(layer => {
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(layer.size, 32, 32),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.eclipticSunGroup.add(glowMesh);
      this.eclipticSunGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.eclipticSunGroup);

    // Realistic sun (far away at 1 AU from Earth)
    const realisticSunRadius = this.SUN_RADIUS;

    const realisticSun = new THREE.Mesh(
      new THREE.SphereGeometry(realisticSunRadius, 64, 64),
      new THREE.MeshBasicMaterial({
        map: realisticSunTexture,
        color: 0xffffff,
        transparent: true,
        opacity: 1.0,
        depthWrite: false
      })
    );

    const sunGlowLayers = [
      { size: realisticSunRadius * 1.2, opacity: 0.1, color: 0xffff99 },
      { size: realisticSunRadius * 1.5, opacity: 0.05, color: 0xffcc66 },
      { size: realisticSunRadius * 2.0, opacity: 0.03, color: 0xff9933 }
    ];

    this.realisticSunGroup = new THREE.Group();
    this.realisticSunGroup.add(realisticSun);

    // Store reference to the realistic sun mesh for color updates
    this.realisticSunMesh = realisticSun;
    this.realisticSunGlowMeshes = [];

    sunGlowLayers.forEach(layer => {
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(layer.size, 32, 32),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.realisticSunGroup.add(glowMesh);
      this.realisticSunGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.realisticSunGroup);
  }

  createMoon() {
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load(this.MOON_TEXTURE_PATH);

    // Ecliptic moon (on the ecliptic plane)
    const eclipticMoonRadius = 0.13;

    const eclipticMoon = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticMoonRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
        color: 0xaaaaaa
      })
    );

    const eclipticMoonGlowLayers = [
      { size: eclipticMoonRadius * 1.2, opacity: 0.15, color: 0xdddddd },
      { size: eclipticMoonRadius * 1.5, opacity: 0.1, color: 0xcccccc }
    ];

    this.eclipticMoonGroup = new THREE.Group();
    this.eclipticMoonGroup.add(eclipticMoon);

    this.eclipticMoonMesh = eclipticMoon;
    this.moonGlowMeshes = [];

    eclipticMoonGlowLayers.forEach(layer => {
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(layer.size, 32, 32),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.eclipticMoonGroup.add(glowMesh);
      this.moonGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.eclipticMoonGroup);

    // Realistic moon (orbits Earth at ~60 Earth radii)
    const realisticMoonRadius = this.MOON_RADIUS;

    const realisticMoon = new THREE.Mesh(
      new THREE.SphereGeometry(realisticMoonRadius, 64, 64),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
        color: 0xaaaaaa
      })
    );

    const realisticMoonGlowLayers = [
      { size: realisticMoonRadius * 1.2, opacity: 0.08, color: 0xffffff },
      { size: realisticMoonRadius * 1.4, opacity: 0.04, color: 0xffffff }
    ];

    this.realisticMoonGroup = new THREE.Group();
    this.realisticMoonGroup.add(realisticMoon);

    this.realisticMoonMesh = realisticMoon;
    this.realisticMoonGlowMeshes = [];

    realisticMoonGlowLayers.forEach(layer => {
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(layer.size, 32, 32),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
      this.realisticMoonGroup.add(glowMesh);
      this.realisticMoonGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.realisticMoonGroup);
  }

  createPlanets() {
    debugLog.log('=== Creating planets ===');
    // Planet data: [name, relative diameter (Earth=1), orbital distance in AU]
    // Distances scaled relative to 1 AU (Earth-Sun distance)
    const planetData = [
      { name: 'mercury', diameter: 0.383, color: 0x8c7853, au: 0.39 },
      { name: 'venus', diameter: 0.949, color: 0xffc649, au: 0.72 },
      { name: 'mars', diameter: 0.532, color: 0xcd5c5c, au: 1.52 },
      { name: 'jupiter', diameter: 11.21, color: 0xc88b3a, au: 5.20 },
      { name: 'saturn', diameter: 9.45, color: 0xfad5a5, au: 9.54 },
      { name: 'uranus', diameter: 4.01, color: 0x4fd0e0, au: 19.19 },
      { name: 'neptune', diameter: 3.88, color: 0x4166f5, au: 30.07 },
      { name: 'pluto', diameter: 0.186, color: 0xbca89f, au: 39.48 }
    ];

    // Base size for Earth (for scaling)
    // Earth radius = this.EARTH_RADIUS, planets scale proportionally
    const earthDiameter = 1.0;
    const baseRadius = this.EARTH_RADIUS; // Earth's actual radius as base

    debugLog.log('CE_RADIUS:', this.CE_RADIUS, 'baseRadius:', baseRadius);

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    const planetTextures = {
      mercury: textureLoader.load(this.MERCURY_TEXTURE_PATH),
      venus: textureLoader.load(this.VENUS_TEXTURE_PATH),
      mars: textureLoader.load(this.MARS_TEXTURE_PATH),
      jupiter: textureLoader.load(this.JUPITER_TEXTURE_PATH),
      saturn: textureLoader.load(this.SATURN_TEXTURE_PATH),
      uranus: textureLoader.load(this.URANUS_TEXTURE_PATH),
      neptune: textureLoader.load(this.NEPTUNE_TEXTURE_PATH),
      pluto: textureLoader.load(this.PLUTO_TEXTURE_PATH)
    };

    // Load Saturn ring textures
    const saturnRingsTexture = textureLoader.load(
      this.SATURN_RINGS_TEXTURE_PATH,
      () => debugLog.log('Saturn rings texture loaded successfully'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings texture:', err)
    );
    const saturnRingsAlpha = textureLoader.load(
      this.SATURN_RINGS_ALPHA_PATH,
      () => debugLog.log('Saturn rings alpha loaded successfully'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings alpha:', err)
    );

    planetData.forEach(planet => {
      // Calculate radius based on relative diameter (scaled up for visibility)
      const radius = baseRadius * (planet.diameter / earthDiameter) * this.PLANET_RADIUS_SCALE;
      const distance = planet.au * this.PLANET_DISTANCE_SCALE; // Scaled distances for visibility

      // Create material with texture
      const material = new THREE.MeshBasicMaterial({
        map: planetTextures[planet.name]
      });

      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        material
      );

      const planetGroup = new THREE.Group();
      planetGroup.add(planetMesh);

      // Add rings for Saturn
      if (planet.name === 'saturn') {
        const ringInnerRadius = radius * 1.2;
        const ringOuterRadius = radius * 2.0;
        const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 64);

        // Fix UV mapping for ring texture
        const pos = ringGeometry.attributes.position;
        const uv = ringGeometry.attributes.uv;
        const v3 = new THREE.Vector3();

        for (let i = 0; i < pos.count; i++) {
          v3.fromBufferAttribute(pos, i);
          const dist = v3.length();
          const u = (dist - ringInnerRadius) / (ringOuterRadius - ringInnerRadius);
          uv.setXY(i, u, uv.getY(i));
        }

        const ringMaterial = new THREE.MeshBasicMaterial({
          map: saturnRingsTexture,
          alphaMap: saturnRingsAlpha,
          transparent: true,
          side: THREE.DoubleSide,
          opacity: 1.0,
          depthWrite: false
        });

        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        ringMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
        planetGroup.add(ringMesh);

        debugLog.log(`Saturn rings created: inner=${ringInnerRadius}, outer=${ringOuterRadius}`);
        debugLog.log('Ring texture:', saturnRingsTexture);
        debugLog.log('Ring alpha:', saturnRingsAlpha);
      }

      // Store the group and main mesh for later positioning
      this.planetGroups[planet.name] = {
        group: planetGroup,
        mesh: planetMesh,
        distance: distance
      };

      this.zodiacGroup.add(planetGroup);
      debugLog.log(`Created planet ${planet.name} with radius ${radius} at distance ${distance}`);
    });
  }

  createAngleSpheres() {
    const addAngle = (name, color) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
      );
      mesh.userData.angleName = name; // Store angle name for tooltip
      this.zodiacGroup.add(mesh);  // Add to zodiacGroup for astrology visualization
      this.spheres[name] = mesh;
    };

    addAngle("MC", 0x888888);
    addAngle("IC", 0x888888);
    addAngle("ASC", 0x888888);
    addAngle("DSC", 0x888888);
    addAngle("VTX", 0x888888);
    addAngle("AVX", 0x888888);
  }


  createAngleLabels() {
    const addAngleLabel = (displayText, dataName) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.8, 0.4, 1);
      sprite.userData.angleName = dataName; // Store angle name for tooltip
      this.scene.add(sprite);
      return sprite;
    };

    this.angleLabels = {
      MC: addAngleLabel('MC', 'MC'),
      IC: addAngleLabel('IC', 'IC'),
      ASC: addAngleLabel('AC', 'ASC'),
      DSC: addAngleLabel('DC', 'DSC'),
      VTX: addAngleLabel('VX', 'VTX'),
      AVX: addAngleLabel('AV', 'AVX')
    };
  }

  setupStarHover() {
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.05; // Make line detection more precise
    const mouse = new THREE.Vector2();

    const onStarHover = (event) => {
      let camera, mouseX, mouseY;

      if (this.stereoEnabled) {
        // In stereo mode, determine which viewport (left or right) the mouse is in
        const halfWidth = window.innerWidth / 2;
        if (event.clientX < halfWidth) {
          // Left viewport
          camera = this.rightCamera; // Swapped for cross-eyed
          mouseX = (event.clientX / halfWidth) * 2 - 1;
        } else {
          // Right viewport
          camera = this.leftCamera; // Swapped for cross-eyed
          mouseX = ((event.clientX - halfWidth) / halfWidth) * 2 - 1;
        }
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      } else {
        // Normal single viewport
        camera = this.camera;
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      }

      mouse.x = mouseX;
      mouse.y = mouseY;

      raycaster.setFromCamera(mouse, camera);

      // Check for stars, sun, moon, planets, and angle spheres
      const starIntersects = raycaster.intersectObjects(this.starGroup.children, false);
      const sunIntersects = raycaster.intersectObjects(this.eclipticSunGroup.children, false);
      const realisticSunIntersects = raycaster.intersectObjects(this.realisticSunGroup.children, false);
      const eclipticMoonIntersects = raycaster.intersectObjects(this.eclipticMoonGroup.children, false);
      const realisticMoonIntersects = raycaster.intersectObjects(this.realisticMoonGroup.children, false);
      
      // Check all planet groups
      const planetIntersects = [];
      Object.entries(this.planetGroups).forEach(([name, planetData]) => {
        const intersects = raycaster.intersectObjects(planetData.group.children, false);
        if (intersects.length > 0) {
          planetIntersects.push({ name, intersects });
        }
      });

      // Check angle spheres and labels
      const angleIntersects = raycaster.intersectObjects([
        this.spheres.MC,
        this.spheres.IC,
        this.spheres.ASC,
        this.spheres.DSC,
        this.spheres.VTX,
        this.spheres.AVX,
        this.angleLabels.MC,
        this.angleLabels.IC,
        this.angleLabels.ASC,
        this.angleLabels.DSC,
        this.angleLabels.VTX,
        this.angleLabels.AVX
      ], false);

      // Check reference circles (Horizon, Meridian, Prime Vertical, Celestial Equator, Ecliptic)
      const circleIntersects = raycaster.intersectObjects([
        this.horizonOutline,
        this.meridianOutline,
        this.primeVerticalOutline,
        this.celestialEquatorOutline,
        this.outerEclipticLine
      ], false);

      // Check pole labels
      const poleIntersects = raycaster.intersectObjects([
        this.poleLabels.NP,
        this.poleLabels.SP
      ], false);

      const starInfoElement = document.getElementById('starInfo');

      // Check sun first (priority) - both ecliptic and realistic sun
      if (sunIntersects.length > 0 || realisticSunIntersects.length > 0) {
        document.getElementById('starName').textContent = `☉ Sun ${this.sunZodiacPosition}`;
        document.getElementById('constellationName').textContent = `↑ ${this.sunRiseSet.sunrise} | ↓ ${this.sunRiseSet.sunset}`;

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check planets second
      else if (planetIntersects.length > 0) {
        const planet = planetIntersects[0];
        const planetSymbols = {
          mercury: '☿',
          venus: '♀',
          mars: '♂',
          jupiter: '♃',
          saturn: '♄',
          uranus: '♅',
          neptune: '♆',
          pluto: '♇'
        };
        const planetFullNames = {
          mercury: 'Mercury',
          venus: 'Venus',
          mars: 'Mars',
          jupiter: 'Jupiter',
          saturn: 'Saturn',
          uranus: 'Uranus',
          neptune: 'Neptune',
          pluto: 'Pluto'
        };

        const symbol = planetSymbols[planet.name] || planet.name;
        const fullName = planetFullNames[planet.name] || planet.name;
        const position = this.planetZodiacPositions[planet.name] || '';

        document.getElementById('starName').textContent = `${symbol} ${fullName} ${position}`;
        document.getElementById('constellationName').textContent = `Planet`;

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check moon third - both ecliptic and realistic
      else if (eclipticMoonIntersects.length > 0 || realisticMoonIntersects.length > 0) {
        document.getElementById('starName').textContent = `☽ Moon ${this.moonZodiacPosition}`;
        document.getElementById('constellationName').textContent = `${this.lunarPhase.phase} (${this.lunarPhase.illumination}% lit)`;

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check angles fourth
      else if (angleIntersects.length > 0) {
        const angle = angleIntersects[0].object;
        const angleName = angle.userData.angleName;
        const fullNames = {
          MC: "Midheaven",
          IC: "Imum Coeli",
          ASC: "Ascendant",
          DSC: "Descendant",
          VTX: "Vertex",
          AVX: "Antivertex"
        };

        document.getElementById('starName').textContent = `${angleName} ${this.anglePositions[angleName]}`;
        document.getElementById('constellationName').textContent = fullNames[angleName];

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check reference circles fifth
      else if (circleIntersects.length > 0) {
        const circle = circleIntersects[0].object;
        const circleName = circle.userData.circleName;
        const descriptions = {
          "Horizon": "Observer's local horizon plane",
          "Meridian": "North-South great circle through zenith",
          "Prime Vertical": "East-West great circle through zenith",
          "Celestial Equator": "Projection of Earth's equator onto celestial sphere",
          "Ecliptic": "Path of the Sun through the zodiac constellations"
        };

        document.getElementById('starName').textContent = circleName;
        document.getElementById('constellationName').textContent = descriptions[circleName];

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check pole labels sixth
      else if (poleIntersects.length > 0) {
        const pole = poleIntersects[0].object;
        const poleName = pole.userData.poleName;
        const descriptions = {
          "NP": "North Celestial Pole",
          "SP": "South Celestial Pole"
        };

        document.getElementById('starName').textContent = poleName;
        document.getElementById('constellationName').textContent = descriptions[poleName];

        this.positionTooltip(starInfoElement, event);
        this.renderer.domElement.style.cursor = 'pointer';
      }
      // Check stars last
      else if (starIntersects.length > 0) {
        const hoveredObject = starIntersects[0].object;
        if (hoveredObject.userData.name && hoveredObject.userData.constellation) {
          document.getElementById('starName').textContent = hoveredObject.userData.name;
          document.getElementById('constellationName').textContent = hoveredObject.userData.constellation;

          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        starInfoElement.classList.remove('visible');
        this.renderer.domElement.style.cursor = 'default';
      }
    };

    this.renderer.domElement.addEventListener('mousemove', onStarHover);
  }

  setupPlanetDoubleClick() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onDoubleClick = (event) => {
      let camera, mouseX, mouseY;

      if (this.stereoEnabled) {
        const halfWidth = window.innerWidth / 2;
        if (event.clientX < halfWidth) {
          camera = this.rightCamera;
          mouseX = (event.clientX / halfWidth) * 2 - 1;
        } else {
          camera = this.leftCamera;
          mouseX = ((event.clientX - halfWidth) / halfWidth) * 2 - 1;
        }
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      } else {
        camera = this.camera;
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      }

      mouse.x = mouseX;
      mouse.y = mouseY;

      raycaster.setFromCamera(mouse, camera);

      // Check all planet groups
      const planetIntersects = [];
      Object.entries(this.planetGroups).forEach(([name, planetData]) => {
        const intersects = raycaster.intersectObjects(planetData.group.children, false);
        if (intersects.length > 0) {
          planetIntersects.push({ name, planetData, intersects });
        }
      });

      // Check realistic sun
      const sunIntersects = raycaster.intersectObjects(this.realisticSunGroup.children, false);

      // Check realistic moon
      const moonIntersects = raycaster.intersectObjects(this.realisticMoonGroup.children, false);

      let targetObject = null;
      let targetRadius = null;
      let targetWorldPos = new THREE.Vector3();

      if (planetIntersects.length > 0) {
        const planet = planetIntersects[0];
        planet.planetData.group.getWorldPosition(targetWorldPos);
        targetRadius = planet.planetData.mesh.geometry.parameters.radius;
        targetObject = 'planet';
      } else if (sunIntersects.length > 0) {
        this.realisticSunGroup.getWorldPosition(targetWorldPos);
        targetRadius = this.realisticSunMesh.geometry.parameters.radius;
        targetObject = 'sun';
      } else if (moonIntersects.length > 0) {
        this.realisticMoonGroup.getWorldPosition(targetWorldPos);
        targetRadius = this.realisticMoonMesh.geometry.parameters.radius;
        targetObject = 'moon';
      }

      if (targetObject) {
        // Calculate camera position (offset from target)
        const zoomDistance = targetRadius * 8; // Distance from surface

        // Get direction from target to current camera
        const direction = camera.position.clone().sub(targetWorldPos).normalize();

        // Calculate new camera position
        const newCameraPos = targetWorldPos.clone().add(direction.multiplyScalar(zoomDistance));

        // Smoothly animate camera
        const startPos = camera.position.clone();
        const startTarget = this.controls.target.clone();
        const duration = 1000; // 1 second
        const startTime = performance.now();

        const animateCamera = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Ease-in-out function
          const eased = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          // Interpolate position
          camera.position.lerpVectors(startPos, newCameraPos, eased);

          // Interpolate target
          this.controls.target.lerpVectors(startTarget, targetWorldPos, eased);

          if (progress < 1) {
            requestAnimationFrame(animateCamera);
          }
        };

        animateCamera();
      }
    };

    this.renderer.domElement.addEventListener('dblclick', onDoubleClick);
  }

  zoomToTarget(targetName) {
    let targetWorldPos = new THREE.Vector3();
    let targetRadius = null;
    const camera = this.stereoEnabled ? this.camera : this.camera;

    // Get target position and radius based on name
    if (targetName === 'sun') {
      this.realisticSunGroup.getWorldPosition(targetWorldPos);
      targetRadius = this.realisticSunMesh.geometry.parameters.radius;
    } else if (targetName === 'moon') {
      this.realisticMoonGroup.getWorldPosition(targetWorldPos);
      targetRadius = this.realisticMoonMesh.geometry.parameters.radius;
    } else if (this.planetGroups[targetName]) {
      this.planetGroups[targetName].group.getWorldPosition(targetWorldPos);
      targetRadius = this.planetGroups[targetName].mesh.geometry.parameters.radius;
    } else {
      debugLog.warn('Target not found:', targetName);
      return;
    }

    // Calculate camera position (offset from target)
    const zoomDistance = targetRadius * 8; // Distance from surface

    // Get direction from target to current camera
    const direction = camera.position.clone().sub(targetWorldPos).normalize();

    // Calculate new camera position
    const newCameraPos = targetWorldPos.clone().add(direction.multiplyScalar(zoomDistance));

    // Smoothly animate camera
    const startPos = camera.position.clone();
    const startTarget = this.controls.target.clone();
    const duration = 1000; // 1 second
    const startTime = performance.now();

    const animateCamera = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out function
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate position
      camera.position.lerpVectors(startPos, newCameraPos, eased);

      // Interpolate target
      this.controls.target.lerpVectors(startTarget, targetWorldPos, eased);

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };

    animateCamera();
  }

  setupContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    const menuItems = contextMenu.querySelectorAll('.context-menu-item');

    // Show context menu on right-click
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();

      // Position menu at mouse location
      contextMenu.style.left = event.clientX + 'px';
      contextMenu.style.top = event.clientY + 'px';
      contextMenu.classList.add('visible');
    });

    // Hide context menu on click outside
    document.addEventListener('click', (event) => {
      if (!contextMenu.contains(event.target)) {
        contextMenu.classList.remove('visible');
      }
    });

    // Handle menu item clicks
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        this.zoomToTarget(target);
        contextMenu.classList.remove('visible');
      });
    });

    // Hide context menu on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        contextMenu.classList.remove('visible');
      }
    });
  }

  positionTooltip(tooltipElement, event) {
    // Position tooltip near mouse with boundary checking
    const offset = 15; // Distance from cursor
    const padding = 10; // Padding from screen edges

    // Get tooltip dimensions (need to make it visible first to measure)
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.classList.add('visible');
    const rect = tooltipElement.getBoundingClientRect();
    tooltipElement.style.visibility = '';

    let left = event.clientX + offset;
    let top = event.clientY + offset;

    // Check right boundary
    if (left + rect.width > window.innerWidth - padding) {
      left = event.clientX - rect.width - offset;
    }

    // Check bottom boundary
    if (top + rect.height > window.innerHeight - padding) {
      top = event.clientY - rect.height - offset;
    }

    // Check left boundary
    if (left < padding) {
      left = padding;
    }

    // Check top boundary
    if (top < padding) {
      top = padding;
    }

    tooltipElement.style.left = left + 'px';
    tooltipElement.style.top = top + 'px';
  }

  updateSphere(astroCalc, currentLatitude, currentLongitude, currentTime, currentDay, currentYear, timezone = null) {
    debugLog.log('=== updateSphere called ===');
    debugLog.log('Planet groups available:', Object.keys(this.planetGroups));
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
    const placeOnZodiac = (deg) => {
        const rad = THREE.MathUtils.degToRad(deg) - ayanamsha;
        // We map 0 degrees to +X, moving counter-clockwise towards +Y
        return new THREE.Vector3(
            this.CE_RADIUS * Math.cos(rad),
            this.CE_RADIUS * Math.sin(rad),
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
    for (const key of ["MC", "IC", "ASC", "DSC", "VTX", "AVX"]) {
        const worldPos = new THREE.Vector3();
        this.spheres[key].getWorldPosition(worldPos);
        const direction = worldPos.clone().normalize();
        worldPos.add(direction.multiplyScalar(0.3));
        this.angleLabels[key].position.copy(worldPos);
    }

    // -----------------------------------------------------------
    // 6. Sun Position
    // -----------------------------------------------------------
    const isLeapYear = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const { month, day } = astroCalc.dayOfYearToMonthDay(currentDay, isLeapYear);
    const hours = Math.floor(currentTime / 60);
    const minutes = currentTime % 60;

    const sunLonRad = astroCalc.calculateSunPosition(
        currentDay, currentYear, month, day, hours, minutes
    );
    const sunDeg = THREE.MathUtils.radToDeg(sunLonRad);

    // Store sun zodiac position for tooltip
    this.sunZodiacPosition = astroCalc.toZodiacString(sunDeg - ayanamshaDeg);

    this.eclipticSunGroup.position.copy(placeOnZodiac(sunDeg));

    // Realistic sun at ORIGIN (0,0,0) for heliocentric system
    this.realisticSunGroup.position.set(0, 0, 0);

    // Update sun color based on whether it's above or below the horizon
    // Force matrix update to get accurate world position
    this.scene.updateMatrixWorld(true);

    const sunWorldPos = new THREE.Vector3();
    this.eclipticSunGroup.getWorldPosition(sunWorldPos);
    const isSunAboveHorizon = sunWorldPos.y > 0;

    debugLog.log('Sun world Y:', sunWorldPos.y, 'Above horizon:', isSunAboveHorizon);

    if (isSunAboveHorizon) {
      // Bright sun with texture when above horizon
      this.eclipticSunMesh.material.color.setHex(0xffaa44);
      debugLog.log('Setting sun to bright color with texture');
    } else {
      // Dark gray without texture when below horizon
      this.eclipticSunMesh.material.color.setHex(0xA04C28);
      debugLog.log('Setting sun to dark color without texture');
    }
    this.eclipticSunMesh.material.needsUpdate = true;

    // Moon position
    const moonLonRad = astroCalc.calculateMoonPosition(
      currentDay, currentYear, month, day, hours, minutes, currentLongitude
    );
    const moonDeg = THREE.MathUtils.radToDeg(moonLonRad);
    this.eclipticMoonGroup.position.copy(placeOnZodiac(moonDeg));

    // Realistic moon at proper distance from Earth (~60 Earth radii)
    const moonDistance = this.MOON_DISTANCE;
    const mRad = THREE.MathUtils.degToRad(moonDeg) - ayanamsha;
    this.realisticMoonGroup.position.set(Math.cos(mRad) * moonDistance, Math.sin(mRad) * moonDistance, 0);

    // Store moon zodiac position for tooltip
    this.moonZodiacPosition = astroCalc.toZodiacString(moonDeg - ayanamshaDeg);

    // Calculate lunar phase
    this.lunarPhase = astroCalc.calculateLunarPhase(sunLonRad, moonLonRad);

    // Check for sun-moon collision and adjust sun transparency
    const sunMoonDistance = this.eclipticSunGroup.position.distanceTo(this.eclipticMoonGroup.position);
    const collisionThreshold = 0.35; // Adjust this value to control when transparency kicks in

    if (sunMoonDistance < collisionThreshold) {
      // Collision detected - make sun transparent (closer = more transparent)
      // When distance = 0, opacity = 0.5; when distance = threshold, opacity = 1.0
      const opacity = 0.5 + (sunMoonDistance / collisionThreshold) * 0.5;
      this.eclipticSunMesh.material.opacity = opacity;
      this.realisticSunMesh.material.opacity = opacity;
    } else {
      // No collision - keep sun opaque
      this.eclipticSunMesh.material.opacity = 1.0;
      this.realisticSunMesh.material.opacity = 1.0;
    }

    // Update planet positions (geocentric - from Earth's perspective)
    debugLog.log('=== Updating planet positions ===');
    debugLog.log('Available planet groups:', Object.keys(this.planetGroups));

    // In heliocentric view, calculate Earth's position first
    // Earth is 1 AU from Sun, at opposite side of Sun from geocentric Sun position
    const earthHeliocentricLon = (sunDeg + 180) % 360; // Earth is opposite to Sun
    const earthDistance = 1.0 * this.PLANET_DISTANCE_SCALE; // Earth at 1 AU
    const earthRad = THREE.MathUtils.degToRad(earthHeliocentricLon) - ayanamsha;

    // In heliocentric system, "Earth" position is where we need to offset from
    const earthHelioPos = new THREE.Vector3(
      Math.cos(earthRad) * earthDistance,
      Math.sin(earthRad) * earthDistance,
      0
    );
    debugLog.log('Earth heliocentric position:', earthHelioPos.x, earthHelioPos.y);

    const planetNames = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

    // Sun is at origin (0,0,0) in heliocentric system
    debugLog.log('Sun at origin (0,0,0) for heliocentric coords');

    planetNames.forEach(planetName => {
      if (this.planetGroups[planetName]) {
        debugLog.log(`Processing ${planetName}...`);
        const planetData = astroCalc.calculatePlanetPosition(
          planetName, currentDay, currentYear, month, day, hours, minutes
        );

        // Use geocentric longitude for tooltip display
        const geocentricDeg = THREE.MathUtils.radToDeg(planetData.geocentricLongitude);
        debugLog.log(`  ${planetName} geocentric longitude (deg):`, geocentricDeg);

        // Use heliocentric coordinates for 3D positioning relative to Sun
        let planetLonRad, distance;

        if (planetData.heliocentricLongitude !== null && planetData.heliocentricDistance !== null) {
          // Use actual heliocentric position
          planetLonRad = planetData.heliocentricLongitude;
          distance = planetData.heliocentricDistance * this.PLANET_DISTANCE_SCALE;
          debugLog.log(`  ${planetName} heliocentric longitude (rad):`, planetLonRad);
          debugLog.log(`  ${planetName} heliocentric distance (AU):`, planetData.heliocentricDistance, '-> scene units:', distance);
        } else {
          // Fallback to average orbital distance
          planetLonRad = planetData.geocentricLongitude;
          distance = this.planetGroups[planetName].distance;
          debugLog.log(`  ${planetName} using fallback distance:`, distance);
        }

        const pRad = planetLonRad - ayanamsha;
        debugLog.log(`  ${planetName} adjusted rad:`, pRad, 'ayanamsha:', ayanamsha);

        // Position planet relative to Sun at origin (heliocentric)
        const x = Math.cos(pRad) * distance;
        const y = Math.sin(pRad) * distance;
        this.planetGroups[planetName].group.position.set(x, y, 0);

        debugLog.log(`  Positioned ${planetName} at (${x.toFixed(2)}, ${y.toFixed(2)}, 0) - geocentric: ${geocentricDeg.toFixed(1)}°`);
        debugLog.log(`  Planet group visible:`, this.planetGroups[planetName].group.visible);
        debugLog.log(`  Planet mesh radius:`, this.planetGroups[planetName].mesh.geometry.parameters.radius);

        // Store planet zodiac position for tooltip (using geocentric longitude)
        this.planetZodiacPositions[planetName] = astroCalc.toZodiacString(geocentricDeg - ayanamshaDeg);
      } else {
        debugLog.warn(`Planet group not found: ${planetName}`);
      }
    });
    debugLog.log('=== Done updating planets ===');

    // -----------------------------------------------------------
    // 7. UI Updates
    // -----------------------------------------------------------
    document.getElementById("lstValue").textContent = astroCalc.lstToTimeString(LSTdeg);
    document.getElementById("mcValue").textContent = astroCalc.toZodiacString(MCdeg - ayanamshaDeg);
    document.getElementById("acValue").textContent = astroCalc.toZodiacString(ACdeg - ayanamshaDeg);

    // Calculate rise/set only when date or location changes (not time of day)
    const riseSetKey = `${currentDay}-${currentYear}-${currentLatitude.toFixed(2)}-${currentLongitude.toFixed(2)}-${timezone}`;
    if (this.riseSetCacheKey !== riseSetKey) {
      debugLog.log('Recalculating sunrise/sunset for', riseSetKey);
      this.cachedRiseSet = astroCalc.calculateRiseSet(sunLonRad, currentLatitude, currentLongitude, currentDay, currentYear, timezone);
      this.riseSetCacheKey = riseSetKey;
    }

    // Store rise/set for tooltip
    if (this.cachedRiseSet) {
      this.sunRiseSet = {
        sunrise: this.cachedRiseSet.sunrise,
        sunset: this.cachedRiseSet.sunset
      };
    }
  }

  toggleStarfield(visible) {
    this.starGroup.visible = visible;
    this.constellationLineGroup.visible = visible;
    this.bgStarField.visible = visible;
  }

  toggleStereo(enabled) {
    this.stereoEnabled = enabled;
    this.onWindowResize(); // Update camera aspects
  }

  setEyeSeparation(separation) {
    this.eyeSeparation = separation;
  }

  onWindowResize() {
    if (this.stereoEnabled) {
      // Split viewport mode - each camera gets half the width
      const aspect = (window.innerWidth / 2) / window.innerHeight;
      this.leftCamera.aspect = aspect;
      this.leftCamera.updateProjectionMatrix();
      this.rightCamera.aspect = aspect;
      this.rightCamera.updateProjectionMatrix();
    } else {
      // Normal single viewport
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  updateStereoCameras() {
    // Copy main camera position and rotation to stereo cameras
    this.leftCamera.position.copy(this.camera.position);
    this.leftCamera.rotation.copy(this.camera.rotation);
    this.rightCamera.position.copy(this.camera.position);
    this.rightCamera.rotation.copy(this.camera.rotation);

    // Offset cameras horizontally (left/right) for stereo effect
    // We offset along the camera's local X-axis
    const cameraRight = new THREE.Vector3();
    this.camera.getWorldDirection(cameraRight);
    cameraRight.cross(this.camera.up).normalize();

    this.leftCamera.position.add(cameraRight.clone().multiplyScalar(-this.eyeSeparation / 2));
    this.rightCamera.position.add(cameraRight.clone().multiplyScalar(this.eyeSeparation / 2));
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();

    if (this.stereoEnabled) {
      // Update stereo camera positions based on main camera
      this.updateStereoCameras();

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
