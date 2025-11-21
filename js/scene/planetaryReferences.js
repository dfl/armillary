// planetaryReferences.js - Reference geometry for Earth and Sun (equators, poles, ecliptic plane)

import * as THREE from 'three';

/**
 * PlanetaryReferences class manages reference circles and planes for Earth and Sun
 * in the heliocentric view.
 *
 * This includes:
 * - Earth equator outline
 * - Earth pole markers and labels (North/South)
 * - Sun ecliptic plane (extending to star field)
 */
export default class PlanetaryReferences {
  constructor(scene, earthGroup, earthMesh, sunGroup, EARTH_RADIUS, PLANET_DISTANCE_SCALE, STAR_FIELD_RADIUS, MOON_DISTANCE) {
    this.scene = scene;
    this.earthGroup = earthGroup;
    this.earthMesh = earthMesh;
    this.sunGroup = sunGroup;
    this.EARTH_RADIUS = EARTH_RADIUS;
    this.PLANET_DISTANCE_SCALE = PLANET_DISTANCE_SCALE;
    this.STAR_FIELD_RADIUS = STAR_FIELD_RADIUS;
    this.MOON_DISTANCE = MOON_DISTANCE;

    // Groups to hold reference elements
    this.earthReferencesGroup = null;
    this.sunReferencesGroup = null;
    this.geocentricEclipticGroup = null;

    // Individual elements
    this.earthEquatorOutline = null;
    this.earthPoleLabels = {};
    this.geocentricEclipticOutline = null;
    this.sunEclipticPlane = null;
    this.sunEclipticOutline = null;
    this.moonOrbitOutline = null; // Moon's orbital path around Earth
    this.eclipticDots = []; // Store ecliptic rim dots for hover detection

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

    // Geocentric ecliptic plane (zodiac ring) - in XY plane (Sun's ecliptic), centered at Earth
    // This is added to earthGroup (not earthMesh) so it follows Earth's position but stays in ecliptic plane
    this.geocentricEclipticGroup = new THREE.Group();
    // No rotation - stays in XY plane to match Sun's ecliptic

    // Ecliptic plane - gray circular plane extending beyond Earth
    const eclipticRadius = this.EARTH_RADIUS * 1.5;
    const planeGeometry = new THREE.CircleGeometry(eclipticRadius, 128);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.15,
      depthWrite: false
    });
    this.geocentricEclipticOutline = new THREE.Mesh(planeGeometry, planeMaterial);
    this.geocentricEclipticOutline.userData.circleName = "Geocentric Ecliptic";
    this.geocentricEclipticGroup.add(this.geocentricEclipticOutline);

    // Zodiac glyphs inside the ecliptic plane
    const zodiacGlyphRadius = eclipticRadius * 0.85;
    const zodiacGlyphs = Array.from({ length: 12 }, (_, i) => String.fromCodePoint(0x2648 + i) + '\uFE0E');
    const glyphScale = this.EARTH_RADIUS * 0.4;

    zodiacGlyphs.forEach((glyph, i) => {
      const angle = THREE.MathUtils.degToRad(i * 30 + 15); // Center of each sign
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 84px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(glyph, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(glyphScale, glyphScale, 1);
      sprite.position.set(
        zodiacGlyphRadius * Math.cos(angle),
        zodiacGlyphRadius * Math.sin(angle),
        0
      );
      sprite.userData.zodiacSign = glyph;
      this.geocentricEclipticGroup.add(sprite);
    });

    // Add to earthGroup (not earthReferencesGroup) so it follows Earth's position but stays in ecliptic plane
    this.earthGroup.add(this.geocentricEclipticGroup);

    // Hide by default
    this.earthReferencesGroup.visible = false;
    this.geocentricEclipticGroup.visible = false;
  }

  createSunReferences() {
    // Create group to hold all Sun references (ecliptic plane)
    this.sunReferencesGroup = new THREE.Group();
    this.scene.add(this.sunReferencesGroup);

    // Sun ecliptic plane (in XY plane where Earth orbits)
    // Extends all the way to the star field for wide visualization
    const eclipticRadius = this.STAR_FIELD_RADIUS;
    const planeGeometry = new THREE.CircleGeometry(eclipticRadius, 128);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.05,
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
      new THREE.LineDashedMaterial({
        color: 0x888888,
        opacity: 0.3,
        transparent: true,
        dashSize: 100.0,
        gapSize: 100.0,
        depthTest: true,
        depthWrite: false
      })
    );
    this.sunEclipticOutline.computeLineDistances();
    this.sunEclipticOutline.userData.circleName = "Ecliptic Plane";
    this.sunReferencesGroup.add(this.sunEclipticOutline);

    // Radial lines dividing the zodiac into 12 signs (without glyphs)
    const radialLineMaterial = new THREE.LineBasicMaterial({
      color: 0x888888,
      opacity: 0.3,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });

    for (let i = 0; i < 12; i++) {
      const angle = THREE.MathUtils.degToRad(i * 30);
      const radialLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(eclipticRadius * Math.cos(angle), eclipticRadius * Math.sin(angle), 0)
        ]),
        radialLineMaterial
      );
      this.sunReferencesGroup.add(radialLine);
    }

    // 360 dots around the outer rim, one for each zodiac degree
    const dotGeometry = new THREE.SphereGeometry(eclipticRadius * 0.003, 8, 8);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.6,
      depthTest: true,
      depthWrite: false
    });

    for (let i = 0; i < 360; i++) {
      const angle = THREE.MathUtils.degToRad(i);
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(
        eclipticRadius * Math.cos(angle),
        eclipticRadius * Math.sin(angle),
        0
      );
      // Store degree information for hover tooltip
      dot.userData.eclipticDegree = i;
      this.eclipticDots.push(dot);
      this.sunReferencesGroup.add(dot);
    }

    // Moon orbital path around Earth (dotted circle)
    // This will be positioned relative to Earth in updateSphere
    const moonOrbitPoints = [];
    const moonOrbitSegments = 128;
    for (let i = 0; i <= moonOrbitSegments; i++) {
      const angle = (i / moonOrbitSegments) * Math.PI * 2;
      moonOrbitPoints.push(new THREE.Vector3(
        this.MOON_DISTANCE * Math.cos(angle),
        this.MOON_DISTANCE * Math.sin(angle),
        0
      ));
    }
    this.moonOrbitOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(moonOrbitPoints),
      new THREE.LineDashedMaterial({
        color: 0xaaaaff,
        opacity: 0.5,
        transparent: true,
        dashSize: 4.0,
        gapSize: 8.0,
        depthTest: true,
        depthWrite: false
      })
    );
    this.moonOrbitOutline.computeLineDistances();
    this.moonOrbitOutline.userData.circleName = "Moon Orbit";
    this.moonOrbitOutline.visible = false; // Hide by default, shown with ecliptic plane
    this.scene.add(this.moonOrbitOutline); // Add to scene (not sunReferencesGroup) so we can position it independently

    // Hide by default
    this.sunReferencesGroup.visible = false;
  }

  toggleEarthReferences(visible) {
    if (this.earthReferencesGroup) {
      this.earthReferencesGroup.visible = visible;
    }
    if (this.geocentricEclipticGroup) {
      this.geocentricEclipticGroup.visible = visible;
    }
  }

  toggleSunReferences(visible) {
    if (this.sunReferencesGroup) {
      this.sunReferencesGroup.visible = visible;
    }
    if (this.moonOrbitOutline) {
      this.moonOrbitOutline.visible = visible;
    }
  }
}
