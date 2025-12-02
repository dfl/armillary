// celestialObjects.js - Stars, sun, moon, planets, and Earth

import * as THREE from 'three';
import { starData } from '../stardata.js';
import { createConstellationFigures } from '../constellationFigures.js';
import { stellariumConstellations } from '../stellariumData.js';
import { hipparcosCatalog } from '../hipparcosCatalog.js';

/**
 * CelestialObjects class manages all celestial bodies in the visualization.
 *
 * This includes:
 * - Star field with named stars, constellation lines, and background stars
 * - Sun (both ecliptic and realistic heliocentric)
 * - Moon (both ecliptic and realistic geocentric)
 * - Planets (Mercury through Pluto)
 * - Earth (with day/night shader)
 */
export default class CelestialObjects {
  constructor(scene, celestial, zodiacGroup, inertialStarSphere, constants, texturePaths) {
    this.scene = scene;
    this.celestial = celestial;
    this.zodiacGroup = zodiacGroup;
    this.inertialStarSphere = inertialStarSphere;

    // Constants
    this.CE_RADIUS = constants.CE_RADIUS;
    this.EARTH_RADIUS = constants.EARTH_RADIUS;
    this.SUN_RADIUS = constants.SUN_RADIUS;
    this.MOON_RADIUS = constants.MOON_RADIUS;
    this.MOON_DISTANCE = constants.MOON_DISTANCE;
    this.STAR_FIELD_RADIUS = constants.STAR_FIELD_RADIUS;
    this.PLANET_RADIUS_SCALE = constants.PLANET_RADIUS_SCALE;
    this.PLANET_DISTANCE_SCALE = constants.PLANET_DISTANCE_SCALE;

    // Planetary pole orientations in ecliptic coordinates (J2000.0)
    // Based on IAU Working Group on Cartographic Coordinates and Rotational Elements
    // Converted from equatorial RA/Dec to ecliptic longitude/latitude
    this.planetPoles = {
      mercury: { lon: 277, lat: 61 },       // Small tilt ~0.03°
      venus: { lon: 181, lat: -68 },        // Retrograde rotation (upside down)
      mars: { lon: 329, lat: 63 },          // ~25° tilt
      jupiter: { lon: 268, lat: 64 },       // Small tilt ~3°
      saturn: { lon: 80, lat: 62 },         // ~27° tilt (matches rings)
      uranus: { lon: 98, lat: -15 },        // Extreme ~98° tilt (retrograde, on its side)
      neptune: { lon: 314, lat: 43 },       // ~28° tilt
      sun: { lon: 0, lat: 90 },             // Sun's north pole at ecliptic north
      moon: { lon: 0, lat: 90 }             // Moon's axis roughly perpendicular to ecliptic
    };

    // Texture paths
    this.texturePaths = texturePaths;

    // Objects that will be exposed as properties
    this.starGroup = null;
    this.starMeshes = {};
    this.constellationLineGroup = null;
    this.constellationFigureGroup = null;
    this.milkyWayMesh = null;
    this.eclipticSunGroup = null;
    this.realisticSunGroup = null;
    this.sunTexture = null;
    this.eclipticSunMesh = null;
    this.eclipticSunGlowMeshes = [];
    this.realisticSunMesh = null;
    this.realisticSunGlowMeshes = [];
    this.eclipticMoonGroup = null;
    this.eclipticMoonMesh = null;
    this.realisticMoonGroup = null;
    this.realisticMoonMesh = null;
    this.moonGlowMeshes = [];
    this.realisticMoonGlowMeshes = [];
    this.heliocentricNodeGroups = {}; // Lunar nodes in heliocentric view
    this.planetGroups = {};
    this.eclipticPlanetGroups = {}; // Planets on the ecliptic zodiac wheel
    this.earthGroup = null;
    this.earthMesh = null;

    // Sky view sun/moon (flat discs for zenith view)
    this.skySunMesh = null;
    this.skyMoonMesh = null;
    this.skyMoonMaterial = null;

    // Initialize all celestial objects
    this.createStarField();
    this.createMilkyWay();
    // Constellation figures loaded asynchronously - call loadConstellationFigures() after construction
    this.createSun();
    this.createMoon();
    this.createSkySunAndMoon();
    this.createHeliocentricNodes();
    this.createPlanets();
    this.createEclipticPlanets();
  }

  /**
   * Calculate pole direction vector from ecliptic coordinates and apply rotation to mesh
   * @param {THREE.Mesh} mesh - The mesh to rotate
   * @param {string} planetName - Name of the planet to get pole coordinates
   */
  applyPoleOrientation(mesh, planetName) {
    const pole = this.planetPoles[planetName];
    if (!pole) return;

    const poleEclipticLon = THREE.MathUtils.degToRad(pole.lon);
    const poleEclipticLat = THREE.MathUtils.degToRad(pole.lat);

    // Calculate pole direction vector in ecliptic coordinates
    const poleDirection = new THREE.Vector3(
      Math.cos(poleEclipticLat) * Math.cos(poleEclipticLon),
      Math.cos(poleEclipticLat) * Math.sin(poleEclipticLon),
      Math.sin(poleEclipticLat)
    );

    // Default sphere texture has north pole at +Y, which in our coordinate system is +Z
    // So we rotate from +Z to the pole direction
    const defaultNorth = new THREE.Vector3(0, 0, 1);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNorth, poleDirection);
    mesh.quaternion.copy(quaternion);
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
    const k = 500.0; // Scaled up for larger star field radius

    // Create stars
    starData.forEach(([name, ra, dec, mag, constellation]) => {
      const size = k * Math.max(0.3, 1.0 - mag * 0.2);
      const brightness = Math.max(0.3, 1.0 - mag * 0.15);

      const starGeometry = new THREE.SphereGeometry(size, 8, 8);
      const starMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(brightness, brightness, brightness * 0.95)
      });

      const star = new THREE.Mesh(starGeometry, starMaterial);
      const position = raDecToVector3(ra, dec, this.STAR_FIELD_RADIUS);
      star.position.copy(position);
      star.userData = { name, constellation, magnitude: mag };

      this.starGroup.add(star);
      this.starMeshes[name] = star;

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
        glow.userData = { name, constellation, magnitude: mag };

        this.starGroup.add(glow);
      });
    });

    // Add constellation lines using Stellarium data
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x5555cc,
      transparent: true,
      opacity: 0.3,
      linewidth: 1
    });

    // Helper function to get star position from Hipparcos catalog
    const getHipStarPosition = (hipId, radius) => {
      const star = hipparcosCatalog[hipId.toString()];
      if (!star) return null;
      return raDecToVector3(star.ra, star.dec, radius);
    };

    // Track which Hipparcos IDs we've created markers for
    const hipStarMarkers = new Map();

    // Iterate through all Stellarium constellations
    Object.values(stellariumConstellations).forEach(constellation => {
      if (!constellation.lines) return;

      // Each constellation has an array of line segments
      // Each line segment is an array of Hipparcos IDs
      constellation.lines.forEach(lineSegment => {
        if (lineSegment.length < 2) return;

        // Create line connecting consecutive stars in this segment
        for (let i = 0; i < lineSegment.length - 1; i++) {
          const hipId1 = lineSegment[i];
          const hipId2 = lineSegment[i + 1];

          const pos1 = getHipStarPosition(hipId1, this.STAR_FIELD_RADIUS);
          const pos2 = getHipStarPosition(hipId2, this.STAR_FIELD_RADIUS);

          if (pos1 && pos2) {
            const points = [pos1, pos2];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, lineMaterial);
            this.constellationLineGroup.add(line);

            // Create invisible clickable markers for constellation line stars
            // This enables tooltips for all stars in constellation lines
            [hipId1, hipId2].forEach((hipId, idx) => {
              const position = idx === 0 ? pos1 : pos2;
              const hipKey = `${hipId}_${constellation.native}`;

              // Only create marker if we haven't already created one for this star
              if (!hipStarMarkers.has(hipKey)) {
                const markerSize = k * 2.0; // Larger hit target than visual stars
                const markerGeometry = new THREE.SphereGeometry(markerSize, 8, 8);
                const markerMaterial = new THREE.MeshBasicMaterial({
                  transparent: true,
                  opacity: 0.001, // Nearly invisible but still raycastable
                  depthTest: true, // Need depth test for raycasting
                  depthWrite: false // Don't write to depth buffer to avoid occlusion
                });

                const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                marker.position.copy(position);
                marker.renderOrder = -1; // Render behind everything

                // Store metadata for tooltips
                // Try to find a common name for this star, otherwise use HIP designation
                const hipStar = hipparcosCatalog[hipId.toString()];
                const starName = `HIP ${hipId}`;

                marker.userData = {
                  name: starName,
                  constellation: constellation.native,
                  magnitude: 5.0, // Default magnitude for constellation line stars
                  hipId: hipId,
                  isConstellationLineStar: true
                };

                this.starGroup.add(marker);
                hipStarMarkers.set(hipKey, marker);
              }
            });
          }
        }
      });
    });

    // Add stars to inertial sphere (stationary reference frame)
    this.inertialStarSphere.add(this.starGroup);
    this.inertialStarSphere.add(this.constellationLineGroup);
  }

  createMilkyWay() {
    // Create Milky Way background sphere with texture
    // Uses the same approach as Stellarium - a textured sphere in celestial coordinates
    // The texture should be an equirectangular map in RA/Dec coordinates

    const textureLoader = new THREE.TextureLoader();

    // Load Milky Way texture with error handling
    // Use import.meta.env.BASE_URL for proper Vite path resolution
    const milkyWayTexture = textureLoader.load(
      import.meta.env.BASE_URL + 'images/milkyway.png',
      () => {
        console.log('Milky Way texture loaded successfully');
      },
      undefined,
      (err) => {
        console.warn('Milky Way texture not found. Add a texture at images/milkyway.png to enable.');
        // Hide the mesh if texture fails to load
        if (this.milkyWayMesh) {
          this.milkyWayMesh.visible = false;
        }
      }
    );

    // Create sphere geometry slightly inside the star field
    // This ensures stars render on top of the Milky Way
    const milkyWayGeometry = new THREE.SphereGeometry(
      this.STAR_FIELD_RADIUS * 0.92, // Behind constellation figures (0.98) and stars (1.0)
      64, // Higher segment count for smooth appearance
      64
    );

    // Create material with normal blending for natural appearance
    // More transparent and without color artifacts
    const milkyWayMaterial = new THREE.MeshBasicMaterial({
      map: milkyWayTexture,
      side: THREE.BackSide, // View from inside the sphere
      transparent: true,
      opacity: 0.15, // Very subtle (was 0.25, originally 0.5)
      blending: THREE.NormalBlending, // Normal blending avoids green tint artifacts
      depthWrite: false, // Don't write to depth buffer
      fog: false // Not affected by fog
    });

    this.milkyWayMesh = new THREE.Mesh(milkyWayGeometry, milkyWayMaterial);
    this.milkyWayMesh.name = 'milkyWay';

    // Rotate to align with celestial coordinates (RA/Dec)
    // The texture seam should align with RA 0h (Vernal Equinox)
    // Adjust this rotation if the galactic center doesn't appear at RA ~17h 45m (Sagittarius)
    // Note: Try different values if orientation is wrong: 0, π/2, π, -π/2
    this.milkyWayMesh.rotation.y = 0; // No rotation initially - test and adjust

    // Debug: Log reference star positions to verify RA/Dec alignment
    console.log('Star field orientation check:');
    console.log('- Regulus (Leo): RA 10h = 150°, should appear in Leo on ecliptic');
    console.log('- Spica (Virgo): RA 13h = 195°, should appear in Virgo on ecliptic');
    console.log('- Antares (Scorpius): RA 16h = 240°, should appear in Scorpius on ecliptic');

    // Add to inertial star sphere so it rotates with stars in RA/Dec coordinates
    this.inertialStarSphere.add(this.milkyWayMesh);
  }

  async loadConstellationFigures() {
    // Load Stellarium constellation artwork with texture warping
    try {
      this.constellationFigureGroup = await createConstellationFigures(
        this.STAR_FIELD_RADIUS * 0.98, // Slightly inside star field
        import.meta.env.BASE_URL + 'images/constellations/'
      );

      // Add to inertial star sphere (same as stars)
      this.inertialStarSphere.add(this.constellationFigureGroup);
    } catch (err) {
      console.error('Failed to load constellation figures:', err);
      this.constellationFigureGroup = new THREE.Group();
    }
  }

  createSun() {
    const textureLoader = new THREE.TextureLoader();
    this.sunTexture = textureLoader.load(this.texturePaths.SUN_TEXTURE_PATH);
    const realisticSunTexture = textureLoader.load(this.texturePaths.REALISTIC_SUN_TEXTURE_PATH);

    // Scale sun relative to celestial sphere radius (approx 12% of radius)
    const eclipticSunRadius = this.CE_RADIUS * 0.12;

    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticSunRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: this.sunTexture,
        color: 0xffaa44,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        depthTest: false // Render on top of sky dome
      })
    );
    sun.renderOrder = 100; // Render after sky dome

    // Apply pole orientation
    this.applyPoleOrientation(sun, 'sun');

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
          depthWrite: false,
          depthTest: false // Render on top of sky dome
        })
      );
      glowMesh.renderOrder = 99; // Render after sky dome but before sun
      glowMesh.raycast = () => {}; // Exclude from raycasting
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

    // Apply pole orientation
    this.applyPoleOrientation(realisticSun, 'sun');

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
      glowMesh.raycast = () => {}; // Exclude from raycasting
      this.realisticSunGroup.add(glowMesh);
      this.realisticSunGlowMeshes.push(glowMesh);
    });

    // Add a point light to represent the Sun
    const sunLight = new THREE.PointLight(0xffffff, 2.0, 0, 0);
    this.realisticSunGroup.add(sunLight);

    // Add realistic sun to the root scene (heliocentric center)
    this.scene.add(this.realisticSunGroup);

    // Hide initially until first updateSphere() call
    this.realisticSunGroup.visible = false;
  }

  createMoon() {
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load(this.texturePaths.MOON_TEXTURE_PATH);
    const moonBumpTexture = textureLoader.load(this.texturePaths.MOON_BUMP_TEXTURE_PATH);

    // Ecliptic moon (on the ecliptic plane)
    // Scale moon relative to celestial sphere radius (approx 9% of radius)
    const eclipticMoonRadius = this.CE_RADIUS * 0.09;

    // Moon phase shader - shows realistic illumination based on sun position
    const moonPhaseMaterial = new THREE.ShaderMaterial({
      uniforms: {
        moonTexture: { value: moonTexture },
        sunDirection: { value: new THREE.Vector3(1, 0, 0) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          vUv = uv;
          // Keep normal in object space to match sunDirection (also in object space)
          vNormal = normalize(normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D moonTexture;
        uniform vec3 sunDirection;

        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          vec4 texColor = texture2D(moonTexture, vUv);

          // Calculate illumination based on sun direction
          vec3 sunDir = normalize(sunDirection);
          float illumination = dot(vNormal, sunDir);

          // Smooth the terminator slightly
          illumination = smoothstep(-0.1, 0.2, illumination);

          // Apply illumination - dark side is very dark but not black
          vec3 litColor = texColor.rgb * 0.9;
          vec3 darkColor = texColor.rgb * 0.05;
          vec3 finalColor = mix(darkColor, litColor, illumination);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    const eclipticMoon = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticMoonRadius, 32, 32),
      moonPhaseMaterial
    );
    eclipticMoon.renderOrder = 100; // Render after sky dome

    // Store reference to update sun direction
    this.moonPhaseMaterial = moonPhaseMaterial;

    // Apply pole orientation
    this.applyPoleOrientation(eclipticMoon, 'moon');

    const eclipticMoonGlowLayers = [
      { size: eclipticMoonRadius * 1.4, opacity: 0.25, color: 0xffffee },
      { size: eclipticMoonRadius * 2.0, opacity: 0.15, color: 0xeeeedd },
      { size: eclipticMoonRadius * 3.0, opacity: 0.08, color: 0xddddcc }
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
          depthWrite: false,
          depthTest: false // Render on top of sky dome
        })
      );
      glowMesh.renderOrder = 99; // Render after sky dome but before moon
      this.eclipticMoonGroup.add(glowMesh);
      this.moonGlowMeshes.push(glowMesh);
    });

    this.zodiacGroup.add(this.eclipticMoonGroup);

    // Realistic moon (orbits Earth at ~60 Earth radii)
    const realisticMoonRadius = this.MOON_RADIUS;

    const realisticMoon = new THREE.Mesh(
      new THREE.SphereGeometry(realisticMoonRadius, 64, 64),
      new THREE.MeshStandardMaterial({
        map: moonTexture,
        bumpMap: moonBumpTexture,
        bumpScale: 0.05,
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.0
      })
    );

    // Apply pole orientation
    this.applyPoleOrientation(realisticMoon, 'moon');

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

    // Add realistic moon to the root scene (will be positioned relative to Earth)
    this.scene.add(this.realisticMoonGroup);

    // Hide initially until first updateSphere() call
    this.realisticMoonGroup.visible = false;
  }

  /**
   * Create sky-view sun and moon (flat discs for zenith view)
   * Based on Stellarium's approach with Oren-Nayar diffuse shading
   */
  createSkySunAndMoon() {
    const textureLoader = new THREE.TextureLoader();
    const moonTexture = textureLoader.load(this.texturePaths.MOON_TEXTURE_PATH);

    // Sky sun - glowing disc with corona effect
    const sunRadius = this.CE_RADIUS * 0.15;

    const skySunMaterial = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(1.0, 0.95, 0.8) },
        intensity: { value: 1.5 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center) * 2.0;

          // Core disc (sharp edge)
          float core = 1.0 - smoothstep(0.0, 0.7, dist);

          // Inner glow
          float innerGlow = exp(-dist * 3.0) * 0.8;

          // Outer corona
          float corona = exp(-dist * 1.5) * 0.4;

          float totalGlow = core + innerGlow + corona;

          // Limb darkening effect for the core
          float limbDarkening = 1.0 - pow(dist * 0.7, 2.0) * 0.3;
          vec3 color = glowColor * totalGlow * limbDarkening * intensity;

          float alpha = clamp(totalGlow, 0.0, 1.0);
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    this.skySunMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sunRadius * 2, sunRadius * 2),
      skySunMaterial
    );
    this.skySunMesh.renderOrder = 101;
    this.skySunMesh.visible = false; // Hidden until zenith view

    // Add to ecliptic sun group so it follows sun position
    this.eclipticSunGroup.add(this.skySunMesh);

    // Sky moon - disc with Oren-Nayar-like phase shading
    const moonRadius = this.CE_RADIUS * 0.12;

    this.skyMoonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        moonTexture: { value: moonTexture },
        phaseAngle: { value: 0.0 } // Phase angle in radians (0 = new, PI = full)
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D moonTexture;
        uniform float phaseAngle;

        varying vec2 vUv;

        void main() {
          vec2 centered = (vUv - 0.5) * 2.0;
          float r2 = dot(centered, centered);

          // Discard pixels outside the disc
          if (r2 > 1.0) {
            discard;
          }

          // Sample texture
          vec4 texColor = texture2D(moonTexture, vUv);

          // Generate spherical normal for this point on the disc
          float z = sqrt(max(0.0, 1.0 - r2));
          vec3 normal = vec3(centered.x, centered.y, z);

          // Light direction based on phase angle
          // Phase 0 = new moon (light from behind, -Z)
          // Phase PI = full moon (light from front, +Z)
          vec3 lightDir = vec3(sin(phaseAngle), 0.0, -cos(phaseAngle));

          // Simple diffuse lighting
          float diffuse = max(dot(normal, lightDir), 0.0);

          // Smooth terminator
          float terminator = smoothstep(-0.1, 0.2, dot(normal, lightDir));

          // Apply illumination
          vec3 litColor = texColor.rgb * 0.95;
          vec3 darkColor = texColor.rgb * 0.03;
          vec3 finalColor = mix(darkColor, litColor, terminator);

          // Slight limb darkening
          float limbDark = 1.0 - pow(sqrt(r2), 3.0) * 0.15;
          finalColor *= limbDark;

          // Soft edge for antialiasing
          float edgeAlpha = 1.0 - smoothstep(0.95, 1.0, sqrt(r2));

          gl_FragColor = vec4(finalColor, edgeAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    });

    this.skyMoonMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(moonRadius * 2, moonRadius * 2),
      this.skyMoonMaterial
    );
    this.skyMoonMesh.renderOrder = 101;
    this.skyMoonMesh.visible = false; // Hidden until zenith view

    // Add to ecliptic moon group so it follows moon position
    this.eclipticMoonGroup.add(this.skyMoonMesh);
  }

  createHeliocentricNodes() {
    // Create visual markers for lunar nodes in the heliocentric view
    // These show where the moon's orbital plane intersects the ecliptic plane
    // Using sprite glyphs (☊ and ☋) that always face the camera

    const createNodeMarker = (name, symbol) => {
      const group = new THREE.Group();

      // Create canvas with node symbol
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 64, 64);

      // Create sprite from canvas
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        depthTest: true,
        transparent: true,
        opacity: 0.9
      });
      const sprite = new THREE.Sprite(material);

      // Scale the sprite (similar to moon size)
      const scale = this.MOON_RADIUS * 3.0;
      sprite.scale.set(scale, scale, 1);
      sprite.userData.nodeName = name;

      group.add(sprite);
      group.userData.nodeName = name;

      // Add to scene
      this.scene.add(group);
      group.visible = false; // Hidden by default, shown when ecliptic plane is visible

      return group;
    };

    this.heliocentricNodeGroups.NORTH_NODE = createNodeMarker('NORTH_NODE', '☊');
    this.heliocentricNodeGroups.SOUTH_NODE = createNodeMarker('SOUTH_NODE', '☋');
  }

  createPlanets() {
    debugLog.log('=== Creating planets ===');
    // Planet data: actual radii in km and orbital distances in AU
    // Radii: Mercury 2440km, Venus 6052km, Earth 6371km, Mars 3390km,
    //        Jupiter 69911km, Saturn 58232km, Uranus 25362km, Neptune 24622km
    // Moon 1737km, Sun 696000km
    const EARTH_RADIUS_KM = 6371;

    const planetData = [
      { name: 'mercury', radiusKm: 2440, color: 0x8c7853, au: 0.39 },
      { name: 'venus', radiusKm: 6052, color: 0xffc649, au: 0.72 },
      { name: 'mars', radiusKm: 3390, color: 0xcd5c5c, au: 1.52 },
      { name: 'jupiter', radiusKm: 69911, color: 0xc88b3a, au: 5.20 },
      { name: 'saturn', radiusKm: 58232, color: 0xfad5a5, au: 9.54 },
      { name: 'uranus', radiusKm: 25362, color: 0x4fd0e0, au: 19.19 },
      { name: 'neptune', radiusKm: 24622, color: 0x4166f5, au: 30.07 },
      { name: 'pluto', radiusKm: 1188, color: 0xbca89f, au: 39.48 }
    ];

    // Earth's scene radius is the base unit
    const baseRadius = this.EARTH_RADIUS;

    debugLog.log('CE_RADIUS:', this.CE_RADIUS, 'baseRadius:', baseRadius);

    // Load textures
    const textureLoader = new THREE.TextureLoader();
    const planetTextures = {
      mercury: textureLoader.load(this.texturePaths.MERCURY_TEXTURE_PATH),
      venus: textureLoader.load(this.texturePaths.VENUS_TEXTURE_PATH),
      mars: textureLoader.load(this.texturePaths.MARS_TEXTURE_PATH),
      jupiter: textureLoader.load(this.texturePaths.JUPITER_TEXTURE_PATH),
      saturn: textureLoader.load(this.texturePaths.SATURN_TEXTURE_PATH),
      uranus: textureLoader.load(this.texturePaths.URANUS_TEXTURE_PATH),
      neptune: textureLoader.load(this.texturePaths.NEPTUNE_TEXTURE_PATH),
      pluto: textureLoader.load(this.texturePaths.PLUTO_TEXTURE_PATH)
    };

    // Create Earth
    const earthTexture = textureLoader.load(this.texturePaths.EARTH_TEXTURE_PATH);
    const earthNightTexture = textureLoader.load(this.texturePaths.EARTH_NIGHT_TEXTURE_PATH);

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: earthTexture },
        nightTexture: { value: earthNightTexture },
        sunPosition: { value: new THREE.Vector3(0, 0, 0) },
        opacity: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vUv = uv;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunPosition;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 sunDirection = normalize(sunPosition - vWorldPosition);
          float intensity = dot(vNormal, sunDirection);
          float mixFactor = smoothstep(-0.2, 0.2, intensity);
          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = texture2D(nightTexture, vUv);
          vec4 finalColor = mix(nightColor, dayColor, mixFactor);
          gl_FragColor = vec4(finalColor.rgb, opacity);
        }
      `
    });

    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.EARTH_RADIUS, 32, 32),
      earthMaterial
    );
    this.earthMaterial = earthMaterial; // Store reference for dynamic depthWrite toggling

    // Create invisible depth-only sphere to occlude equator backside
    // This sphere writes depth but not color, using DoubleSide to occlude backside
    const depthOnlyMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false, // Don't write color
      depthWrite: false, // Will be toggled same as Earth material
      side: THREE.DoubleSide // Render both sides to write depth on backside
    });
    this.earthDepthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.EARTH_RADIUS, 32, 32),
      depthOnlyMaterial
    );
    this.earthDepthMaterial = depthOnlyMaterial;

    this.earthGroup = new THREE.Group();
    this.earthGroup.add(this.earthMesh);
    this.earthGroup.add(this.earthDepthMesh);
    this.scene.add(this.earthGroup);

    // Hide initially until first updateSphere() call
    this.earthGroup.visible = false;

    // Load Saturn ring textures
    const saturnRingsTexture = textureLoader.load(
      this.texturePaths.SATURN_RINGS_TEXTURE_PATH,
      () => debugLog.log('Saturn rings texture loaded successfully'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings texture:', err)
    );
    const saturnRingsAlpha = textureLoader.load(
      this.texturePaths.SATURN_RINGS_ALPHA_PATH,
      () => debugLog.log('Saturn rings alpha loaded successfully'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings alpha:', err)
    );

    planetData.forEach(planet => {
      // Calculate radius proportional to Earth based on actual km
      // Scale all radii up by PLANET_RADIUS_SCALE for visibility
      const radius = baseRadius * (planet.radiusKm / EARTH_RADIUS_KM) * this.PLANET_RADIUS_SCALE;
      const distance = planet.au * this.PLANET_DISTANCE_SCALE; // Scaled distances for visibility

      // Create material with texture
      const material = new THREE.MeshBasicMaterial({
        map: planetTextures[planet.name],
        depthWrite: true,
        depthTest: true
      });

      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        material
      );

      // Set render order so planets render before orbital rings
      planetMesh.renderOrder = 1;

      // Apply pole orientation to align texture with planet's actual axis
      this.applyPoleOrientation(planetMesh, planet.name);

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

        // Saturn's rings lie in its equatorial plane, so orient them with the same pole
        // The planet mesh orientation is already set by applyPoleOrientation above
        this.applyPoleOrientation(ringMesh, 'saturn');

        planetGroup.add(ringMesh);

        debugLog.log(`Saturn rings created: inner=${ringInnerRadius}, outer=${ringOuterRadius}`);
        debugLog.log('Ring texture:', saturnRingsTexture);
        debugLog.log('Ring alpha:', saturnRingsAlpha);
      }

      // Store the group and main mesh for later positioning
      // Also store radius ratio for size equalization at zoom
      this.planetGroups[planet.name] = {
        group: planetGroup,
        mesh: planetMesh,
        distance: distance,
        radiusRatio: planet.radiusKm / EARTH_RADIUS_KM
      };

      this.scene.add(planetGroup);

      // Hide initially until first updateSphere() call
      planetGroup.visible = false;

      debugLog.log(`Created planet ${planet.name} with radius ${radius} at distance ${distance}`);
    });
  }

  createEclipticPlanets() {
    debugLog.log('=== Creating ecliptic planets ===');

    const textureLoader = new THREE.TextureLoader();

    // Load Saturn ring textures
    const saturnRingsTexture = textureLoader.load(
      this.texturePaths.SATURN_RINGS_TEXTURE_PATH,
      () => debugLog.log('Saturn rings texture loaded successfully (ecliptic)'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings texture (ecliptic):', err)
    );
    const saturnRingsAlpha = textureLoader.load(
      this.texturePaths.SATURN_RINGS_ALPHA_PATH,
      () => debugLog.log('Saturn rings alpha loaded successfully (ecliptic)'),
      undefined,
      (err) => debugLog.error('Error loading Saturn rings alpha (ecliptic):', err)
    );

    // Planet data with colors matching the 3D planets
    const planetData = [
      { name: 'mercury', color: 0x8c7853, texturePath: this.texturePaths.MERCURY_TEXTURE_PATH },
      { name: 'venus', color: 0xffc649, texturePath: this.texturePaths.VENUS_TEXTURE_PATH },
      { name: 'mars', color: 0xcd5c5c, texturePath: this.texturePaths.MARS_TEXTURE_PATH },
      { name: 'jupiter', color: 0xc88b3a, texturePath: this.texturePaths.JUPITER_TEXTURE_PATH },
      { name: 'saturn', color: 0xfad5a5, texturePath: this.texturePaths.SATURN_TEXTURE_PATH },
      { name: 'uranus', color: 0x4fd0e0, texturePath: this.texturePaths.URANUS_TEXTURE_PATH },
      { name: 'neptune', color: 0x4166f5, texturePath: this.texturePaths.NEPTUNE_TEXTURE_PATH },
      { name: 'pluto', color: 0xbca89f, texturePath: this.texturePaths.PLUTO_TEXTURE_PATH }
    ];

    // Size relative to celestial sphere (smaller than sun/moon for less clutter)
    const basePlanetRadius = this.CE_RADIUS * 0.06;

    planetData.forEach(planet => {
      const planetTexture = textureLoader.load(planet.texturePath);

      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(basePlanetRadius, 32, 32),
        new THREE.MeshBasicMaterial({
          map: planetTexture,
          color: 0xffffff,
          transparent: true, // Keep true to allow dynamic opacity changes
          opacity: 1.0,
          depthWrite: true // Enable depth write when fully opaque
        })
      );

      // Apply pole orientation to align texture with planet's actual axis
      this.applyPoleOrientation(planetMesh, planet.name);

      const planetGroup = new THREE.Group();
      planetGroup.add(planetMesh);

      // Add rings for Saturn
      if (planet.name === 'saturn') {
        const ringInnerRadius = basePlanetRadius * 1.2;
        const ringOuterRadius = basePlanetRadius * 2.0;
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
          depthWrite: true // Enable depth write when fully opaque
        });

        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);

        // Saturn's rings lie in its equatorial plane, so orient them with the same pole
        // The planet mesh orientation is already set by applyPoleOrientation above
        this.applyPoleOrientation(ringMesh, 'saturn');

        ringMesh.name = 'saturnRing'; // Name it for collision detection
        planetGroup.add(ringMesh);

        debugLog.log(`Saturn rings created for ecliptic planet: inner=${ringInnerRadius}, outer=${ringOuterRadius}`);
      }

      // Store the planet group for later positioning
      // For Saturn, also store the ring mesh for opacity control
      const ringMesh = planet.name === 'saturn' ? planetGroup.getObjectByName('saturnRing') : null;
      this.eclipticPlanetGroups[planet.name] = {
        group: planetGroup,
        mesh: planetMesh,
        ringMesh: ringMesh
      };

      this.zodiacGroup.add(planetGroup);

      debugLog.log(`Created ecliptic planet ${planet.name}`);
    });
  }
}
