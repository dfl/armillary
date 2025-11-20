// zodiac.js - Ecliptic plane and zodiac wheel visualization

import * as THREE from 'three';

/**
 * ZodiacWheel class manages the ecliptic plane and zodiac constellation markers.
 *
 * This includes:
 * - Ecliptic plane circle (tilted by obliquity relative to celestial equator)
 * - Radial lines dividing the zodiac into 12 signs
 * - Zodiac glyph labels positioned at 30° intervals
 * - Outer ecliptic line in the star field
 */
export default class ZodiacWheel {
  constructor(zodiacGroup, CE_RADIUS, obliquity) {
    this.zodiacGroup = zodiacGroup;
    this.CE_RADIUS = CE_RADIUS;
    this.obliquity = obliquity;

    // Reference that will be exposed as property
    this.outerEclipticLine = null;

    // Initialize zodiac wheel
    this.createEclipticZodiacWheel();
  }

  createEclipticZodiacWheel() {
    const sphereRadius = this.CE_RADIUS * 1.6;
    const ecliptic = new THREE.Mesh(
      new THREE.CircleGeometry(sphereRadius, 128),
      new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide, transparent: true, opacity: 0.1, depthWrite: false })
    );
    this.zodiacGroup.add(ecliptic);

    const eclipticOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      eclipticOutlinePoints.push(new THREE.Vector3(sphereRadius * Math.cos(angle), sphereRadius * Math.sin(angle), 0));
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
          new THREE.Vector3(sphereRadius * Math.cos(angle), sphereRadius * Math.sin(angle), 0)
        ]),
        radialLineMaterial
      );
      this.zodiacGroup.add(radialLine);
    }

    // Zodiac glyphs
    const zodiacRadius = this.CE_RADIUS * 1.35;
    const zodiacGlyphs = Array.from({ length: 12 }, (_, i) => String.fromCodePoint(0x2648 + i) + '\uFE0E');

    const scale = this.CE_RADIUS / 1.5;
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
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2 * scale, 1.2 * scale), mat);
      mesh.position.set(zodiacRadius * Math.cos(angle), zodiacRadius * Math.sin(angle), 0);

      // ROTATION FIX:
      // angle is direction from center.
      // angle - Math.PI/2 ensures the local "Up" (top of glyph) aligns with the outward vector.
      mesh.rotation.z = angle - Math.PI / 2;
      this.zodiacGroup.add(mesh);
    });
  }

  /**
   * Creates the outer ecliptic line that appears in the star field.
   * This should be called after the zodiac wheel is created.
   * @param {number} STAR_FIELD_RADIUS - Radius of the star field
   */
  createOuterEclipticLine(STAR_FIELD_RADIUS) {
    const outerEclipticRadius = STAR_FIELD_RADIUS;
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
  }
}
