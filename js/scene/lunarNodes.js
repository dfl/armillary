// lunarNodes.js - Lunar node markers (☊ ascending and ☋ descending)

import * as THREE from 'three';

/**
 * LunarNodes class manages the lunar node markers on the ecliptic.
 *
 * This includes:
 * - Sprite markers for the ascending (☊) and descending (☋) nodes
 */
export default class LunarNodes {
  constructor(zodiacGroup, CE_RADIUS) {
    this.zodiacGroup = zodiacGroup;
    this.CE_RADIUS = CE_RADIUS;

    // Objects that will be exposed as properties
    this.spheres = {}; // Stores the sprite markers (named spheres for compatibility with update logic)
    this.nodeLabels = {}; // Stores references to the same sprites to prevent update loop crashes

    // Initialize node markers
    this.createNodeMarkers();
  }

  createNodeMarkers() {
    const addNodeMarker = (displayText, name) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 100px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayText, 64, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: true,
        depthWrite: false,
        transparent: true,
        opacity: 0.9
      });

      const sprite = new THREE.Sprite(material);
      // Scale relative to CE_RADIUS, slightly larger than Moon's diameter (0.18) to account for texture padding
      const s = this.CE_RADIUS * 0.25;
      sprite.scale.set(s, s, 1);
      sprite.userData.nodeName = name; // Store node name for tooltip

      this.zodiacGroup.add(sprite);
      this.spheres[name] = sprite; // Store in spheres so position updates work
      
      // Create a dummy object for nodeLabels to satisfy the update loop
      // This prevents the sprite from being offset if the updater applies label offsets
      this.nodeLabels[name] = new THREE.Object3D();
    };

    addNodeMarker('☊', 'NORTH_NODE');
    addNodeMarker('☋', 'SOUTH_NODE');
  }
}
