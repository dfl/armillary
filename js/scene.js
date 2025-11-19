// scene.js - 3D scene rendering with Three.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { starData, constellationLines } from './stardata.js';

export class ArmillaryScene {
  constructor() {
    this.obliquity = 23.44 * Math.PI / 180;
    this.CE_RADIUS = 3;
    this.SUN_TEXTURE_PATH = './images/sun_texture.jpg';
    this.MOON_TEXTURE_PATH = './images/moon_texture.jpg';

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.celestial = null;
    this.zodiacGroup = null;
    this.starGroup = null;
    this.constellationLineGroup = null;
    this.bgStarField = null;
    this.starMeshes = {}; // Store star meshes for hover detection

    this.spheres = {};
    this.angleLabels = {};
    this.eclipticSunGroup = null;
    this.realisticSunGroup = null;
    this.sunTexture = null; // Store texture reference for toggling
    this.moonGroup = null;
    this.moonMesh = null;
    this.moonGlowMeshes = [];

    // Cache for sunrise/sunset calculation
    this.cachedRiseSet = null;
    this.riseSetCacheKey = null;

    this.initScene();
    this.initGroups();
    this.createFixedReferences();
    this.createCelestialEquator();
    this.createEclipticZodiacWheel();
    this.createStarField();
    this.createSun();
    this.createMoon();
    this.createAngleSpheres();
    this.createAngleLabels();
    this.setupStarHover();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2.5, -6);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initGroups() {
    this.celestial = new THREE.Group();
    this.scene.add(this.celestial);

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
    const horizonOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(horizonOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    horizonOutline.rotation.x = -Math.PI / 2;
    this.scene.add(horizonOutline);

    // Compass rose
    this.createCompassRose();

    // Meridian outline
    const meridianOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      meridianOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    const meridianOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(meridianOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    meridianOutline.rotation.y = Math.PI / 2;
    this.scene.add(meridianOutline);

    // Prime vertical outline
    const pvOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pvOutlinePoints.push(new THREE.Vector3(this.CE_RADIUS * Math.cos(angle), this.CE_RADIUS * Math.sin(angle), 0));
    }
    const pvOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pvOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.scene.add(pvOutline);

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
    const ceqOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ceqPoints),
      new THREE.LineDashedMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true, dashSize: 0.5, gapSize: 0.3 })
    );
    ceqOutline.computeLineDistances();
    this.celestial.add(ceqOutline);

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
      this.celestial.add(sprite);
    };

    addPoleLabel('NP', this.CE_RADIUS + polarLineLength);
    addPoleLabel('SP', -this.CE_RADIUS - polarLineLength);
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

    // Create stars
    starData.forEach(([name, ra, dec, mag, constellation]) => {
      const size = Math.max(0.015, 0.05 - mag * 0.01);
      const brightness = Math.max(0.3, 1.0 - mag * 0.15);

      const starGeometry = new THREE.SphereGeometry(size, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(brightness, brightness, brightness * 0.95)
      });

      const star = new THREE.Mesh(starGeometry, starMaterial);
      const position = raDecToVector3(ra, dec, this.CE_RADIUS * 10.0);
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
      color: 0x6666ff,
      transparent: true,
      opacity: 0.6,
      linewidth: 2
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

    // Background stars
    const bgStarCount = 1000;
    const bgStarGeometry = new THREE.BufferGeometry();
    const bgStarPositions = [];
    const bgStarColors = [];

    for (let i = 0; i < bgStarCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = this.CE_RADIUS * 100;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      bgStarPositions.push(x, y, z);

      const brightness = 0.3 + Math.random() * 0.5;
      bgStarColors.push(brightness, brightness, brightness * 0.98);
    }

    bgStarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bgStarPositions, 3));
    bgStarGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bgStarColors, 3));

    const bgStarMaterial = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    this.bgStarField = new THREE.Points(bgStarGeometry, bgStarMaterial);
    this.celestial.add(this.bgStarField);
  }

  createSun() {
    const textureLoader = new THREE.TextureLoader();
    this.sunTexture = textureLoader.load(this.SUN_TEXTURE_PATH); // Store for referencing later

    const eclipticSunRadius = 0.18;

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticSunRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: this.sunTexture,
        color: 0xffaa44
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
          blending: THREE.AdditiveBlending
        })
      );
      this.eclipticSunGroup.add(glowMesh);
      this.eclipticSunGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.eclipticSunGroup);

    // Realistic sun (far away)
    const sunAngularDiameter = 0.53 * Math.PI / 180;
    const sunDistance = this.CE_RADIUS * 50;
    const realisticSunRadius = sunDistance * Math.tan(sunAngularDiameter / 2);

    const realisticSun = new THREE.Mesh(
      new THREE.SphereGeometry(realisticSunRadius, 64, 64),
      new THREE.MeshBasicMaterial({ color: 0xffaa44 })
    );

    const sunGlowLayers = [
      { size: realisticSunRadius * 1.15, opacity: 0.7, color: 0xffff99 },
      { size: realisticSunRadius * 1.4, opacity: 0.5, color: 0xffcc66 },
      { size: realisticSunRadius * 2.0, opacity: 0.3, color: 0xff9933 },
      { size: realisticSunRadius * 3.0, opacity: 0.15, color: 0xff6600 }
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
          blending: THREE.AdditiveBlending
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

    const moonRadius = 0.13;

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(moonRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
        color: 0xaaaaaa
      })
    );

    const moonGlowLayers = [
      { size: moonRadius * 1.2, opacity: 0.15, color: 0xdddddd },
      { size: moonRadius * 1.5, opacity: 0.1, color: 0xcccccc }
    ];

    this.moonGroup = new THREE.Group();
    this.moonGroup.add(moon);

    this.moonMesh = moon;
    this.moonGlowMeshes = [];

    moonGlowLayers.forEach(layer => {
      const glowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(layer.size, 32, 32),
        new THREE.MeshBasicMaterial({
          color: layer.color,
          transparent: true,
          opacity: layer.opacity,
          blending: THREE.AdditiveBlending
        })
      );
      this.moonGroup.add(glowMesh);
      this.moonGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.moonGroup);
  }

  createAngleSpheres() {
    const addAngle = (name, color) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })
      );
      this.zodiacGroup.add(mesh);  // Add to zodiacGroup for astrology visualization
      this.spheres[name] = mesh;
    };

    addAngle("MC", 0x888888);
    addAngle("IC", 0x888888);
    addAngle("ASC", 0x888888);
    addAngle("DSC", 0x888888);
  }


  createAngleLabels() {
    const addAngleLabel = (name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(0.8, 0.4, 1);
      this.scene.add(sprite);
      return sprite;
    };

    this.angleLabels = {
      MC: addAngleLabel('MC'),
      IC: addAngleLabel('IC'),
      ASC: addAngleLabel('ASC'),
      DSC: addAngleLabel('DSC')
    };
  }

  setupStarHover() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onStarHover = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, this.camera);
      const intersects = raycaster.intersectObjects(this.starGroup.children, false);

      const starInfoElement = document.getElementById('starInfo');

      if (intersects.length > 0) {
        const hoveredObject = intersects[0].object;
        if (hoveredObject.userData.name && hoveredObject.userData.constellation) {
          document.getElementById('starName').textContent = hoveredObject.userData.name;
          document.getElementById('constellationName').textContent = hoveredObject.userData.constellation;
          starInfoElement.classList.add('visible');
          this.renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        starInfoElement.classList.remove('visible');
        this.renderer.domElement.style.cursor = 'default';
      }
    };

    this.renderer.domElement.addEventListener('mousemove', onStarHover);
  }

  updateSphere(astroCalc, currentLatitude, currentLongitude, currentTime, currentDay, currentYear, timezone = null) {
    // -----------------------------------------------------------
    // 1. Convert inputs
    // -----------------------------------------------------------
    const latRad = THREE.MathUtils.degToRad(currentLatitude);
    const { LST: LSTdeg, julianDate } = astroCalc.calculateLST(currentDay, currentTime, currentLongitude, currentYear);
    const lstRad = THREE.MathUtils.degToRad(LSTdeg);

    // precise obliquity
    this.obliquity = astroCalc.getObliquity(julianDate);

    // -----------------------------------------------------------
    // 2. Orient the Celestial Sphere (The Equator)
    // -----------------------------------------------------------
    // The Celestial group represents the EQUATORIAL Coordinate System.
    // Local Coordinates: Z is North Pole, XY plane is Celestial Equator.
    // World Coordinates: Z is North, Y is Zenith, X is East.
    
    // We must set rotation order to ZXY:
    // 1. Z: Spin the sky (Earth's rotation / Time).
    // 2. X: Tilt the Pole to the correct altitude (Latitude).
    this.celestial.rotation.order = 'ZXY';

    // TILT (X): 
    // To align Local Z (Pole) with World North (at altitude = Latitude),
    // we rotate around X. Mathematical derivation maps this to -Latitude.
    this.celestial.rotation.x = -latRad;

    // SPIN (Z): 
    // Rotate the sky opposite to Earth's spin (-LST).
    // Phase shift: At LST 0, 0° Aries is on the Meridian. 
    // In our geometry (0° = +X axis), we need a -90 degree offset so +X points South/Up.
    this.celestial.rotation.z = -lstRad - Math.PI / 2;


    // -----------------------------------------------------------
    // 3. Orient the Zodiac Wheel (The Ecliptic)
    // -----------------------------------------------------------
    // The Zodiac is a child of Celestial. It represents the Solar System plane.
    // It is purely a static tilt relative to the Equator. 
    // We do NOT apply LST or Lat here; the parent 'celestial' group handles that.
    
    this.zodiacGroup.rotation.order = 'XYZ';
    this.zodiacGroup.rotation.set(this.obliquity, 0, 0);


    // -----------------------------------------------------------
    // 4. Calculate Angles (ASC/MC)
    // -----------------------------------------------------------
    const MCdeg = astroCalc.calculateMC(lstRad, this.obliquity);
    const ICdeg = (MCdeg + 180) % 360;
    let { AC: ACdeg, DSC: DCdeg } = astroCalc.calculateAscendant(lstRad, latRad, this.obliquity);

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
        const rad = THREE.MathUtils.degToRad(deg);
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

    // Update Labels (offset for visibility)
    for (const key of ["MC", "IC", "ASC", "DSC"]) {
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

    this.eclipticSunGroup.position.copy(placeOnZodiac(sunDeg));

    // Realistic distant sun
    const distance = this.CE_RADIUS * 50;
    const sRad = THREE.MathUtils.degToRad(sunDeg);
    this.realisticSunGroup.position.set(Math.cos(sRad) * distance, Math.sin(sRad) * distance, 0);

    // Moon position
    const moonLonRad = astroCalc.calculateMoonPosition(
      currentDay, currentYear, month, day, hours, minutes, currentLongitude
    );
    const moonDeg = THREE.MathUtils.radToDeg(moonLonRad);
    this.moonGroup.position.copy(placeOnZodiac(moonDeg));

    // -----------------------------------------------------------
    // 7. UI Updates
    // -----------------------------------------------------------
    document.getElementById("lstValue").textContent = astroCalc.lstToTimeString(LSTdeg);
    document.getElementById("mcValue").textContent = astroCalc.toZodiacString(MCdeg);
    document.getElementById("acValue").textContent = astroCalc.toZodiacString(ACdeg);
    document.getElementById("sunPositionValue").textContent = astroCalc.toZodiacString(sunDeg);

    // Calculate rise/set only when date or location changes (not time of day)
    const riseSetKey = `${currentDay}-${currentYear}-${currentLatitude.toFixed(2)}-${currentLongitude.toFixed(2)}-${timezone}`;
    if (this.riseSetCacheKey !== riseSetKey) {
      console.log('Recalculating sunrise/sunset for', riseSetKey);
      this.cachedRiseSet = astroCalc.calculateRiseSet(sunLonRad, currentLatitude, currentLongitude, currentDay, currentYear, timezone);
      this.riseSetCacheKey = riseSetKey;
    }

    document.getElementById("sunriseValue").textContent = this.cachedRiseSet.sunrise;
    document.getElementById("sunsetValue").textContent = this.cachedRiseSet.sunset;
  }

  toggleStarfield(visible) {
    this.starGroup.visible = visible;
    this.constellationLineGroup.visible = visible;
    this.bgStarField.visible = visible;
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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
        console.log("Placed diagnostic marker:", label, deg);
    }
  }

}
