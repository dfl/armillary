// planetaryReferences.js - Reference geometry for Earth and Sun (equators, poles, ecliptic plane)

import * as THREE from 'three';

/**
 * PlanetaryReferences class manages reference circles and planes for Earth and Sun
 * in the heliocentric view.
 *
 * This includes:
 * - Earth equator outline
 * - Earth pole markers and labels (North/South)
 * - Sun ecliptic plane with zodiac markers
 * - Ecliptic pole markers
 */
export default class PlanetaryReferences {
  constructor(scene, earthGroup, earthMesh, sunGroup, EARTH_RADIUS, PLANET_DISTANCE_SCALE) {
    this.scene = scene;
    this.earthGroup = earthGroup;
    this.earthMesh = earthMesh;
    this.sunGroup = sunGroup;
    this.EARTH_RADIUS = EARTH_RADIUS;
    this.PLANET_DISTANCE_SCALE = PLANET_DISTANCE_SCALE;

    // Groups to hold reference elements
    this.earthReferencesGroup = null;
    this.sunReferencesGroup = null;

    // Individual elements
    this.earthEquatorOutline = null;
    this.earthPoleLabels = {};
    this.sunEclipticPlane = null;
    this.sunEclipticOutline = null;
    this.sunZodiacMarkers = null;

    // Create all reference geometry
    this.createEarthReferences();
    this.createSunReferences();
  }

  createEarthReferences() {
    // Note: We need to get earthMesh reference, which will be passed in constructor
    // For now, we'll create the group and add it later in the initialization
    this.earthReferencesGroup = new THREE.Group();

    // Earth equator outline (in XZ plane, matching SphereGeometry equator)
    const equatorRadius = this.EARTH_RADIUS; // Exactly at Earth's surface for proper depth clipping
    const equatorPoints = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      equatorPoints.push(new THREE.Vector3(
        equatorRadius * Math.cos(angle),
        0,
        equatorRadius * Math.sin(angle)
      ));
    }
    this.earthEquatorOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(equatorPoints),
      new THREE.LineDashedMaterial({
        color: 0x00ffff,
        opacity: 0.6,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        dashSize: 5,
        gapSize: 3
      })
    );
    this.earthEquatorOutline.computeLineDistances();
    this.earthEquatorOutline.userData.circleName = "Earth Equator";
    this.earthReferencesGroup.add(this.earthEquatorOutline);

    // Earth polar axis lines (extending from poles, matching horizon view style)
    const polarLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true });
    const polarLineLength = this.EARTH_RADIUS * 0.45;

    // North Pole line (from surface outward)
    const npLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, this.EARTH_RADIUS, 0),
        new THREE.Vector3(0, this.EARTH_RADIUS + polarLineLength, 0)
      ]),
      polarLineMaterial
    );
    this.earthReferencesGroup.add(npLine);

    // South Pole line (from surface outward)
    const spLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -this.EARTH_RADIUS, 0),
        new THREE.Vector3(0, -this.EARTH_RADIUS - polarLineLength, 0)
      ]),
      polarLineMaterial
    );
    this.earthReferencesGroup.add(spLine);

    // Pole labels (sprites that always face camera, matching horizon view)
    const addPoleLabel = (name, y) => {
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
      const scale = this.EARTH_RADIUS * 0.5;
      sprite.scale.set(1 * scale, 0.5 * scale, 1);
      sprite.position.set(0, y, 0);
      sprite.userData.poleName = name;
      this.earthReferencesGroup.add(sprite);
      return sprite;
    };

    this.earthPoleLabels.NP = addPoleLabel('NP', this.EARTH_RADIUS + polarLineLength);
    this.earthPoleLabels.SP = addPoleLabel('SP', -this.EARTH_RADIUS - polarLineLength);

    // Add to earthMesh so references follow Earth's rotation
    this.earthMesh.add(this.earthReferencesGroup);

    // Hide by default
    this.earthReferencesGroup.visible = false;
  }

  createSunReferences() {
    // Create group to hold all Sun references (ecliptic plane)
    this.sunReferencesGroup = new THREE.Group();
    this.scene.add(this.sunReferencesGroup);

    // Sun ecliptic plane (in XY plane where Earth orbits)
    const eclipticRadius = this.PLANET_DISTANCE_SCALE * 3; // Large enough to encompass inner planets
    const planeGeometry = new THREE.CircleGeometry(eclipticRadius, 128);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    });
    this.sunEclipticPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    // No rotation needed - CircleGeometry is already in XY plane where Earth orbits
    this.sunReferencesGroup.add(this.sunEclipticPlane);

    // Ecliptic outline (circle in XY plane)
    const eclipticPoints = [];
    for (let i = 0; i <= 128; i++) {
      const angle = (i / 128) * Math.PI * 2;
      eclipticPoints.push(new THREE.Vector3(
        eclipticRadius * Math.cos(angle),
        eclipticRadius * Math.sin(angle),
        0
      ));
    }
    this.sunEclipticOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(eclipticPoints),
      new THREE.LineBasicMaterial({
        color: 0x888888,
        opacity: 0.5,
        transparent: true
      })
    );
    this.sunEclipticOutline.userData.circleName = "Ecliptic Plane";
    this.sunReferencesGroup.add(this.sunEclipticOutline);

    // Zodiac markers at 30-degree intervals (12 signs)
    this.createZodiacMarkers(eclipticRadius);

    // Hide by default
    this.sunReferencesGroup.visible = false;
  }

  createZodiacMarkers(radius) {
    // Generate zodiac glyphs using Unicode code points with text-style rendering (not emoji)
    const zodiacGlyphs = Array.from({ length: 12 }, (_, i) => String.fromCodePoint(0x2648 + i) + '\uFE0E');

    const zodiacRadius = radius * 0.85; // Place markers inside the ecliptic circle
    const scale = this.PLANET_DISTANCE_SCALE * 0.35; // Increased from 0.2 for bigger glyphs

    zodiacGlyphs.forEach((glyph, i) => {
      // Center glyph at 15° into each 30° segment (same as ZodiacWheel)
      const angle = THREE.MathUtils.degToRad(i * 30 + 15);

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      // Render text normally (matching ZodiacWheel)
      ctx.fillStyle = 'white';
      ctx.font = 'bold 84px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthTest: false
      });

      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 1.2 * scale), mat);
      mesh.position.set(zodiacRadius * Math.cos(angle), zodiacRadius * Math.sin(angle), 0);

      // Rotation fix: angle - PI/2 ensures the local "Up" aligns with outward vector
      mesh.rotation.z = angle - Math.PI / 2;

      this.sunReferencesGroup.add(mesh);
    });

    // Radial lines dividing the zodiac into 12 signs
    const radialLineMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      opacity: 0.3,
      transparent: true
    });

    for (let i = 0; i < 12; i++) {
      const angle = THREE.MathUtils.degToRad(i * 30);
      const radialLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(radius * Math.cos(angle), radius * Math.sin(angle), 0)
        ]),
        radialLineMaterial
      );
      this.sunReferencesGroup.add(radialLine);
    }
  }

  toggleEarthReferences(visible) {
    if (this.earthReferencesGroup) {
      this.earthReferencesGroup.visible = visible;
    }
  }

  toggleSunReferences(visible) {
    if (this.sunReferencesGroup) {
      this.sunReferencesGroup.visible = visible;
    }
  }
}
