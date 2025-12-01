// references.js - Fixed reference geometry (horizon, meridian, compass, celestial equator)

import * as THREE from 'three';

/**
 * ReferenceGeometry class manages the fixed reference circles and compass rose
 * for the armillary sphere visualization.
 *
 * This includes:
 * - Horizon plane and outline
 * - Compass rose and cardinal direction labels
 * - Meridian outline (North-South great circle)
 * - Prime vertical outline (East-West great circle)
 * - Celestial equator outline
 * - Celestial pole labels (NP/SP)
 */
export default class ReferenceGeometry {
  constructor(scene, armillaryRoot, celestial, CE_RADIUS, SPHERE_RADIUS) {
    this.scene = scene;
    this.armillaryRoot = armillaryRoot;
    this.celestial = celestial;
    this.CE_RADIUS = CE_RADIUS;
    this.SPHERE_RADIUS = SPHERE_RADIUS;

    // References that will be exposed as properties
    this.horizonPlane = null;
    this.horizonOutline = null;
    this.meridianOutline = null;
    this.primeVerticalOutline = null;
    this.celestialEquatorOutline = null;
    this.poleLabels = {};

    // Initialize all reference geometry
    this.createFixedReferences();
    this.createCelestialEquator();
  }

  createFixedReferences() {
    const planeOpts = { side: THREE.DoubleSide, transparent: true, opacity: 0.1 };
    const sphereRadius = this.SPHERE_RADIUS;

    // Horizon plane
    this.horizonPlane = new THREE.Mesh(
      new THREE.CircleGeometry(sphereRadius, 64),
      new THREE.MeshBasicMaterial({ color: 0x00ff00, ...planeOpts })
    );
    this.horizonPlane.rotation.x = -Math.PI / 2;
    this.armillaryRoot.add(this.horizonPlane);

    // Horizon outline
    const horizonOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      horizonOutlinePoints.push(new THREE.Vector3(sphereRadius * Math.cos(angle), sphereRadius * Math.sin(angle), 0));
    }
    this.horizonOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(horizonOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.horizonOutline.rotation.x = -Math.PI / 2;
    this.horizonOutline.userData.circleName = "Horizon";
    this.armillaryRoot.add(this.horizonOutline);

    // Compass rose
    this.createCompassRose();

    // Meridian outline
    const meridianOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      meridianOutlinePoints.push(new THREE.Vector3(sphereRadius * Math.cos(angle), sphereRadius * Math.sin(angle), 0));
    }
    this.meridianOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(meridianOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.meridianOutline.rotation.y = Math.PI / 2;
    this.meridianOutline.userData.circleName = "Meridian";
    this.armillaryRoot.add(this.meridianOutline);

    // Prime vertical outline
    const pvOutlinePoints = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pvOutlinePoints.push(new THREE.Vector3(sphereRadius * Math.cos(angle), sphereRadius * Math.sin(angle), 0));
    }
    this.primeVerticalOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pvOutlinePoints),
      new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true })
    );
    this.primeVerticalOutline.userData.circleName = "Prime Vertical";
    this.armillaryRoot.add(this.primeVerticalOutline);

    // Compass labels
    this.addCompassLabels();
  }

  createCompassRose() {
    // Load compass rosette texture
    const textureLoader = new THREE.TextureLoader();
    const compassTexture = textureLoader.load('/armillary/images/compass_rosette.png');

    // Create a plane geometry to display the image
    const scale = this.CE_RADIUS * 1.2; // Size of the compass rosette
    const compassGeometry = new THREE.PlaneGeometry(scale, scale);

    const compassMaterial = new THREE.MeshBasicMaterial({
      map: compassTexture,
      transparent: true,
      opacity: 0.5, // Semi-transparent
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const compassRosette = new THREE.Mesh(compassGeometry, compassMaterial);

    // Rotate to lie flat on the horizon plane
    compassRosette.rotation.x = -Math.PI / 2;

    // Position slightly above the horizon to avoid z-fighting
    compassRosette.position.y = 0.01;

    this.armillaryRoot.add(compassRosette);
  }

  addCompassLabels() {
    const compassRadius = this.CE_RADIUS * 1.1;
    const scale = this.CE_RADIUS / 1.5;
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
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1 * scale, 1 * scale), mat);
      mesh.position.set(x, 0.01, z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotZ;
      this.armillaryRoot.add(mesh);
    };

    addCompassLabel('N', 0, compassRadius, 0);
    addCompassLabel('S', 0, -compassRadius, Math.PI);
    addCompassLabel('E', -compassRadius, 0, Math.PI / 2);  // Swapped: E is now at -X (left when facing N)
    addCompassLabel('W', compassRadius, 0, -Math.PI / 2);   // Swapped: W is now at +X (right when facing N)
  }

  createCelestialEquator() {
    const sphereRadius = this.SPHERE_RADIUS;
    const ceqPoints = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ceqPoints.push(new THREE.Vector3(sphereRadius * Math.cos(a), sphereRadius * Math.sin(a), 0));
    }
    this.celestialEquatorOutline = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(ceqPoints),
      new THREE.LineDashedMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true, dashSize: 0.025, gapSize: 0.025 })
    );
    this.celestialEquatorOutline.computeLineDistances();
    this.celestialEquatorOutline.userData.circleName = "Celestial Equator";
    this.celestial.add(this.celestialEquatorOutline);

    // Celestial poles
    const polarLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, opacity: 0.6, transparent: true });
    const polarLineLength = this.CE_RADIUS * 0.45;

    const npLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, sphereRadius),
        new THREE.Vector3(0, 0, sphereRadius + polarLineLength)
      ]),
      polarLineMaterial
    );
    this.celestial.add(npLine);

    const spLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -sphereRadius),
        new THREE.Vector3(0, 0, -sphereRadius - polarLineLength)
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
      const s = this.CE_RADIUS / 1.5;
      sprite.scale.set(1 * s, 0.5 * s, 1);
      sprite.position.set(0, 0, z);
      sprite.userData.poleName = name; // Store pole name for tooltip
      this.celestial.add(sprite);
      return sprite;
    };

    this.poleLabels.NP = addPoleLabel('NP', sphereRadius + polarLineLength);
    this.poleLabels.SP = addPoleLabel('SP', -sphereRadius - polarLineLength);
  }
}
