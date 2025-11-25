// celestialObjects.js - Stars, sun, moon, planets, and Earth

import * as THREE from 'three';
import { starData, constellationLines } from '../stardata.js';

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

    // Texture paths
    this.texturePaths = texturePaths;

    // Objects that will be exposed as properties
    this.starGroup = null;
    this.starMeshes = {};
    this.constellationLineGroup = null;
    this.bgStarField = null;
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

    // Initialize all celestial objects
    this.createStarField();
    this.createSun();
    this.createMoon();
    this.createHeliocentricNodes();
    this.createPlanets();
    this.createEclipticPlanets();
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
      star.userData = { name, constellation };

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
        glow.userData = { name, constellation };

        this.starGroup.add(glow);
      });
    });

    // Add constellation lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x5555cc,
      transparent: true,
      opacity: 0.3,
      linewidth: 1
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

    // Add stars to inertial sphere (stationary reference frame)
    this.inertialStarSphere.add(this.starGroup);
    this.inertialStarSphere.add(this.constellationLineGroup);

    // Background stars
    const bgStarCount = 1000;
    const bgStarGeometry = new THREE.BufferGeometry();
    const bgStarPositions = [];
    const bgStarColors = [];

    for (let i = 0; i < bgStarCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = this.STAR_FIELD_RADIUS * 1.2;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      bgStarPositions.push(x, y, z);

      const brightness = 0.1 + Math.random() * 0.3;
      bgStarColors.push(brightness, brightness, brightness * 0.98);
    }

    bgStarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bgStarPositions, 3));
    bgStarGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bgStarColors, 3));

    const bgStarMaterial = new THREE.PointsMaterial({
      size: 15.0,
      vertexColors: true,
      transparent: true,
      opacity: 0.4
    });

    this.bgStarField = new THREE.Points(bgStarGeometry, bgStarMaterial);
    this.inertialStarSphere.add(this.bgStarField);
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
        depthWrite: false
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
          blending: THREE.AdditiveBlending,
          depthWrite: false
        })
      );
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

    const eclipticMoon = new THREE.Mesh(
      new THREE.SphereGeometry(eclipticMoonRadius, 32, 32),
      new THREE.MeshBasicMaterial({
        map: moonTexture,
        color: 0xaaaaaa
      })
    );

    const eclipticMoonGlowLayers = [
      { size: eclipticMoonRadius * 1.2, opacity: 0.15, color: 0xdddddd },
      { size: eclipticMoonRadius * 1.5, opacity: 0.1, color: 0xcccccc }
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
          depthWrite: false
        })
      );
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
    // Align Moon's poles (Y-axis of texture) with the ecliptic normal (Z-axis)
    realisticMoon.rotation.x = Math.PI / 2;

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
        map: planetTextures[planet.name]
      });

      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 32),
        material
      );

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
        ringMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
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
        ringMesh.rotation.x = Math.PI / 2; // Rotate to be horizontal
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
