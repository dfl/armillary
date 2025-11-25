// lunarNodes.js - Lunar node markers (☊ ascending and ☋ descending)

import * as THREE from 'three';

/**
 * LunarNodes class manages the lunar node markers on the ecliptic.
 *
 * This includes:
 * - Sphere markers for the ascending (☊) and descending (☋) nodes
 * - Text labels with node symbols
 */
export default class LunarNodes {
  constructor(zodiacGroup, CE_RADIUS) {
    this.zodiacGroup = zodiacGroup;
    this.CE_RADIUS = CE_RADIUS;

    // Objects that will be exposed as properties
    this.spheres = {};
    this.nodeLabels = {};

    // Initialize node markers
    this.createNodeSpheres();
    this.createNodeLabels();
  }

  createNodeSpheres() {
    const addNode = (name, color) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.10 * this.CE_RADIUS, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false })
      );
      mesh.userData.nodeName = name; // Store node name for tooltip
      this.zodiacGroup.add(mesh);  // Add to zodiacGroup for ecliptic visualization
      this.spheres[name] = mesh;
    };

    addNode("NORTH_NODE", 0xaaaaaa);
    addNode("SOUTH_NODE", 0xaaaaaa);
  }

  createNodeLabels() {
    const addNodeLabel = (displayText, dataName) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, 64, 32);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      const s = this.CE_RADIUS;
      sprite.scale.set(1.2 * s, 0.6 * s, 1);
      sprite.userData.nodeName = dataName; // Store node name for tooltip
      this.zodiacGroup.add(sprite);
      return sprite;
    };

    this.nodeLabels = {
      NORTH_NODE: addNodeLabel('☊', 'NORTH_NODE'),
      SOUTH_NODE: addNodeLabel('☋', 'SOUTH_NODE')
    };
  }
}
