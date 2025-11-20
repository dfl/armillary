// angles.js - Astrological angle markers (MC, IC, ASC, DSC, VTX, AVX)

import * as THREE from 'three';

/**
 * AngleMarkers class manages the astrological angle markers on the ecliptic.
 *
 * This includes:
 * - Sphere markers for MC, IC, ASC, DSC, VTX, AVX
 * - Text labels for each angle
 */
export default class AngleMarkers {
  constructor(zodiacGroup, CE_RADIUS) {
    this.zodiacGroup = zodiacGroup;
    this.CE_RADIUS = CE_RADIUS;

    // Objects that will be exposed as properties
    this.spheres = {};
    this.angleLabels = {};

    // Initialize angle markers
    this.createAngleSpheres();
    this.createAngleLabels();
  }

  createAngleSpheres() {
    const sphereRadius = this.CE_RADIUS * 1.6;
    const addAngle = (name, color) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08 * (this.CE_RADIUS / 1.5), 16, 16),
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
      const s = this.CE_RADIUS / 1.5;
      sprite.scale.set(1.2 * s, 0.6 * s, 1);
      sprite.userData.angleName = dataName; // Store angle name for tooltip
      this.zodiacGroup.add(sprite);
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
}
