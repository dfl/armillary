// constellationFigures.js - Stellarium constellation artwork renderer
// Uses texture warping with anchor points to align artwork with star positions

import * as THREE from 'three';
import { stellariumConstellations } from './stellariumData.js';
import { hipparcosCatalog } from './hipparcosCatalog.js';

/**
 * Convert RA/Dec to Vector3 on celestial sphere
 * @param {number} ra - Right ascension in hours
 * @param {number} dec - Declination in degrees
 * @param {number} radius - Sphere radius
 * @returns {THREE.Vector3}
 */
function raDecToVector3(ra, dec, radius) {
  const raRad = (ra / 24) * Math.PI * 2;
  const decRad = THREE.MathUtils.degToRad(dec);

  const x = radius * Math.cos(decRad) * Math.cos(raRad);
  const y = radius * Math.cos(decRad) * Math.sin(raRad);
  const z = radius * Math.sin(decRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Get star position from Hipparcos catalog
 * @param {number} hip - Hipparcos ID
 * @param {number} radius - Sphere radius
 * @returns {THREE.Vector3|null}
 */
function getStarPosition(hip, radius) {
  const star = hipparcosCatalog[hip];
  if (!star) return null;
  return raDecToVector3(star.ra, star.dec, radius);
}

/**
 * Compute 4x4 transformation matrix from pixel coords to 3D positions
 * This follows Stellarium's approach: X = B × A⁻¹
 * where A is built from pixel coords and B from 3D star positions
 */
function computePixelTo3DTransform(anchors, hipparcosCatalog, radius) {
  if (anchors.length < 3) return null;

  // Get first 3 anchors (Stellarium uses exactly 3)
  const anchor1 = anchors[0];
  const anchor2 = anchors[1];
  const anchor3 = anchors[2];

  const star1 = hipparcosCatalog[anchor1.hip];
  const star2 = hipparcosCatalog[anchor2.hip];
  const star3 = hipparcosCatalog[anchor3.hip];

  if (!star1 || !star2 || !star3) return null;

  // Get 3D positions of anchor stars (unit vectors)
  const p1 = raDecToVector3(star1.ra, star1.dec, 1);
  const p2 = raDecToVector3(star2.ra, star2.dec, 1);
  const p3 = raDecToVector3(star3.ra, star3.dec, 1);

  // Compute normal vector (4th basis vector)
  const v12 = new THREE.Vector3().subVectors(p2, p1);
  const v13 = new THREE.Vector3().subVectors(p3, p1);
  const normal = new THREE.Vector3().crossVectors(v12, v13).normalize();

  // Build matrix A from pixel coordinates (4x4)
  // Each column is [px, py, 0, 1] for the 3 anchors, 4th column is [0, 0, 1, 1]
  const A = [
    [anchor1.pos[0], anchor2.pos[0], anchor3.pos[0], 0],
    [anchor1.pos[1], anchor2.pos[1], anchor3.pos[1], 0],
    [0, 0, 0, 1],
    [1, 1, 1, 1]
  ];

  // Build matrix B from 3D positions (4x4)
  // Each column is the 3D position of an anchor star, 4th column is normal
  const B = [
    [p1.x, p2.x, p3.x, normal.x],
    [p1.y, p2.y, p3.y, normal.y],
    [p1.z, p2.z, p3.z, normal.z],
    [1, 1, 1, 1]
  ];

  // Compute A inverse using 4x4 matrix inversion
  const Ainv = invert4x4(A);
  if (!Ainv) return null;

  // Compute X = B × Ainv
  const X = multiply4x4(B, Ainv);

  // Return transformation function
  return {
    transform: (px, py) => {
      // Multiply X × [px, py, 0, 1]^T
      const x = X[0][0] * px + X[0][1] * py + X[0][2] * 0 + X[0][3] * 1;
      const y = X[1][0] * px + X[1][1] * py + X[1][2] * 0 + X[1][3] * 1;
      const z = X[2][0] * px + X[2][1] * py + X[2][2] * 0 + X[2][3] * 1;
      // Normalize and scale to radius
      const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(radius);
      return v;
    }
  };
}

/**
 * Invert a 4x4 matrix
 */
function invert4x4(m) {
  const [
    [a00, a01, a02, a03],
    [a10, a11, a12, a13],
    [a20, a21, a22, a23],
    [a30, a31, a32, a33]
  ] = m;

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-10) return null;

  const invDet = 1.0 / det;

  return [
    [
      (a11 * b11 - a12 * b10 + a13 * b09) * invDet,
      (a02 * b10 - a01 * b11 - a03 * b09) * invDet,
      (a31 * b05 - a32 * b04 + a33 * b03) * invDet,
      (a22 * b04 - a21 * b05 - a23 * b03) * invDet
    ],
    [
      (a12 * b08 - a10 * b11 - a13 * b07) * invDet,
      (a00 * b11 - a02 * b08 + a03 * b07) * invDet,
      (a32 * b02 - a30 * b05 - a33 * b01) * invDet,
      (a20 * b05 - a22 * b02 + a23 * b01) * invDet
    ],
    [
      (a10 * b10 - a11 * b08 + a13 * b06) * invDet,
      (a01 * b08 - a00 * b10 - a03 * b06) * invDet,
      (a30 * b04 - a31 * b02 + a33 * b00) * invDet,
      (a21 * b02 - a20 * b04 - a23 * b00) * invDet
    ],
    [
      (a11 * b07 - a10 * b09 - a12 * b06) * invDet,
      (a00 * b09 - a01 * b07 + a02 * b06) * invDet,
      (a31 * b01 - a30 * b03 - a32 * b00) * invDet,
      (a20 * b03 - a21 * b01 + a22 * b00) * invDet
    ]
  ];
}

/**
 * Multiply two 4x4 matrices
 */
function multiply4x4(a, b) {
  const result = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

/**
 * Create a textured mesh for a constellation using anchor points
 * Tessellates the image into a grid of triangles for proper spherical projection
 *
 * @param {Object} constellation - Constellation data from stellariumConstellations
 * @param {THREE.Texture} texture - The loaded constellation texture
 * @param {number} radius - Celestial sphere radius
 * @returns {THREE.Mesh|null}
 */
function createConstellationMesh(constellation, texture, radius) {
  const { anchors, size } = constellation;

  if (!anchors || anchors.length < 3) {
    console.warn(`Constellation ${constellation.name} has fewer than 3 anchors`);
    return null;
  }

  // Compute the pixel-to-3D transformation (Stellarium's method)
  const transform = computePixelTo3DTransform(anchors, hipparcosCatalog, radius * 0.995);
  if (!transform) {
    console.warn(`Could not compute transform for ${constellation.name}`);
    return null;
  }

  const w = size[0];
  const h = size[1];

  // Tessellate image into a grid (Stellarium uses 5x5)
  const gridSize = 5;
  const vertices = [];
  const uvs = [];
  const indices = [];

  // Generate vertices
  for (let j = 0; j <= gridSize; j++) {
    for (let i = 0; i <= gridSize; i++) {
      // Texture coordinates (0 to 1)
      const u = i / gridSize;
      const v = j / gridSize;

      // Pixel coordinates
      const px = u * w;
      const py = (1 - v) * h;  // Flip Y: UV v=0 is bottom, pixel y=0 is top

      // Transform to 3D position
      const pos = transform.transform(px, py);
      vertices.push(pos.x, pos.y, pos.z);
      uvs.push(u, v);
    }
  }

  // Generate triangle indices
  for (let j = 0; j < gridSize; j++) {
    for (let i = 0; i < gridSize; i++) {
      const idx = j * (gridSize + 1) + i;
      // Two triangles per grid cell
      indices.push(idx, idx + 1, idx + gridSize + 1);
      indices.push(idx + 1, idx + gridSize + 2, idx + gridSize + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { constellation: constellation.native };
  mesh.renderOrder = -1;
  mesh.visible = false;

  // Create canvas for alpha sampling (used by hover detection)
  if (texture.image) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(texture.image, 0, 0);
      // Test that we can read pixel data (fails if canvas is tainted)
      ctx.getImageData(0, 0, 1, 1);
      mesh.userData.alphaCanvas = canvas;
      mesh.userData.alphaContext = ctx;
      mesh.userData.textureWidth = texture.image.width;
      mesh.userData.textureHeight = texture.image.height;
    } catch (e) {
      console.warn(`Could not create alpha canvas for ${constellation.native}:`, e.message);
    }
  } else {
    console.warn(`No texture image for ${constellation.native}`);
  }

  return mesh;
}

/**
 * Create all constellation figure meshes
 * @param {number} radius - Celestial sphere radius
 * @param {string} texturePath - Base path to constellation textures
 * @returns {Promise<THREE.Group>}
 */
export async function createConstellationFigures(radius, texturePath = 'images/constellations/') {
  const group = new THREE.Group();
  const textureLoader = new THREE.TextureLoader();

  const constellationNames = Object.keys(stellariumConstellations);
  console.log(`Loading ${constellationNames.length} constellation figures...`);

  let loaded = 0;
  let failed = 0;

  for (const name of constellationNames) {
    const constellation = stellariumConstellations[name];

    try {
      // Load texture
      const texture = await new Promise((resolve, reject) => {
        textureLoader.load(
          texturePath + constellation.file,
          resolve,
          undefined,
          reject
        );
      });

      texture.colorSpace = THREE.SRGBColorSpace;

      // Create mesh
      const mesh = createConstellationMesh(constellation, texture, radius);
      if (mesh) {
        group.add(mesh);
        loaded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn(`Failed to load constellation ${name}:`, err.message);
      failed++;
    }
  }

  console.log(`Constellation figures: ${loaded} loaded, ${failed} failed`);
  return group;
}

/**
 * Get list of available constellation names
 * @returns {string[]}
 */
export function getAvailableConstellationFigures() {
  return Object.keys(stellariumConstellations);
}

/**
 * Show a constellation figure by name with fade-in animation
 * @param {THREE.Group} figureGroup - The constellation figure group
 * @param {string} constellationName - Name of the constellation to show
 */
export function showConstellationFigure(figureGroup, constellationName) {
  if (!figureGroup) return;

  figureGroup.children.forEach(mesh => {
    if (mesh.userData.constellation === constellationName) {
      mesh.visible = true;
      // Animate opacity
      const targetOpacity = 0.45; // Reduced from 0.7 for more subtle highlighting
      const startOpacity = mesh.material.opacity;
      const duration = 200; // ms
      const startTime = performance.now();

      const animate = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        mesh.material.opacity = startOpacity + (targetOpacity - startOpacity) * progress;

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      animate();
    }
  });
}

/**
 * Hide a constellation figure by name with fade-out animation
 * @param {THREE.Group} figureGroup - The constellation figure group
 * @param {string} constellationName - Name of the constellation to hide (or null to hide all)
 */
export function hideConstellationFigure(figureGroup, constellationName = null) {
  if (!figureGroup) return;

  figureGroup.children.forEach(mesh => {
    if (constellationName === null || mesh.userData.constellation === constellationName) {
      if (mesh.material.opacity > 0) {
        // Animate opacity to 0
        const startOpacity = mesh.material.opacity;
        const duration = 150; // ms
        const startTime = performance.now();

        const animate = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          mesh.material.opacity = startOpacity * (1 - progress);

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            mesh.visible = false;
          }
        };
        animate();
      }
    }
  });
}

/**
 * Hide all constellation figures immediately (no animation)
 * @param {THREE.Group} figureGroup - The constellation figure group
 */
export function hideAllConstellationFigures(figureGroup) {
  if (!figureGroup) return;

  figureGroup.children.forEach(mesh => {
    mesh.visible = false;
    mesh.material.opacity = 0;
  });
}
