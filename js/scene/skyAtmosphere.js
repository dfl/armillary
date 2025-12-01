// skyAtmosphere.js - Physical sky rendering with Rayleigh/Mie scattering
// Based on wwwtyro/glsl-atmosphere and Stellarium's atmospheric model

import * as THREE from 'three';

/**
 * SkyAtmosphere class renders a physically-based sky dome using
 * Rayleigh and Mie scattering algorithms.
 *
 * Features:
 * - Realistic blue sky during daytime
 * - Orange/red sunset and sunrise colors
 * - Dark night sky with proper twilight transitions
 * - Distance-based fading for zenith view transition
 */
export default class SkyAtmosphere {
  constructor(armillaryRoot, sphereRadius) {
    this.armillaryRoot = armillaryRoot;
    this.SKY_RADIUS = sphereRadius;

    // Create sky dome mesh with custom shader
    this.skyMesh = null;
    this.uniforms = null;

    // Track sun position for updates
    this.sunDirection = new THREE.Vector3(0, 1, 0);

    // Opacity for distance-based fading
    this.opacity = 1.0;

    this.createSkyDome();
  }

  createSkyDome() {
    // Vertex shader - pass position to fragment shader
    const vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Fragment shader - Rayleigh/Mie scattering with moon glow
    const fragmentShader = `
      #define PI 3.141592653589793
      #define iSteps 16
      #define jSteps 8

      uniform vec3 uSunDirection;
      uniform float uSunIntensity;
      uniform vec3 uMoonDirection;
      uniform float uMoonIntensity;
      uniform float uPlanetRadius;
      uniform float uAtmosphereRadius;
      uniform vec3 uRayleighCoeff;
      uniform float uMieCoeff;
      uniform float uRayleighScaleHeight;
      uniform float uMieScaleHeight;
      uniform float uMieAnisotropy;
      uniform float uOpacity;

      varying vec3 vWorldPosition;
      varying vec3 vPosition;

      // Ray-sphere intersection
      vec2 raySphereIntersect(vec3 r0, vec3 rd, float sr) {
        float a = dot(rd, rd);
        float b = 2.0 * dot(rd, r0);
        float c = dot(r0, r0) - (sr * sr);
        float d = (b * b) - 4.0 * a * c;
        if (d < 0.0) return vec2(1e5, -1e5);
        return vec2(
          (-b - sqrt(d)) / (2.0 * a),
          (-b + sqrt(d)) / (2.0 * a)
        );
      }

      vec3 atmosphere(vec3 r, vec3 r0, vec3 pSun, float iSun, float rPlanet, float rAtmos,
                      vec3 kRlh, float kMie, float shRlh, float shMie, float g) {
        // Normalize directions
        pSun = normalize(pSun);
        r = normalize(r);

        // Calculate step size of primary ray
        vec2 p = raySphereIntersect(r0, r, rAtmos);
        if (p.x > p.y) return vec3(0.0);

        // Don't trace below planet surface
        vec2 planetHit = raySphereIntersect(r0, r, rPlanet);
        if (planetHit.x < planetHit.y && planetHit.x > 0.0) {
          p.y = min(p.y, planetHit.x);
        }

        float iStepSize = (p.y - p.x) / float(iSteps);

        // Initialize ray time and accumulators
        float iTime = 0.0;
        vec3 totalRlh = vec3(0.0);
        vec3 totalMie = vec3(0.0);
        float iOdRlh = 0.0;
        float iOdMie = 0.0;

        // Calculate phase functions
        float mu = dot(r, pSun);
        float mumu = mu * mu;
        float gg = g * g;
        float pRlh = 3.0 / (16.0 * PI) * (1.0 + mumu);
        float pMie = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) /
                     (pow(1.0 + gg - 2.0 * mu * g, 1.5) * (2.0 + gg));

        // Sample primary ray
        for (int i = 0; i < iSteps; i++) {
          vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);
          float iHeight = length(iPos) - rPlanet;

          // Optical depth for this step
          float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
          float odStepMie = exp(-iHeight / shMie) * iStepSize;

          iOdRlh += odStepRlh;
          iOdMie += odStepMie;

          // Secondary ray toward sun
          float jStepSize = raySphereIntersect(iPos, pSun, rAtmos).y / float(jSteps);
          float jTime = 0.0;
          float jOdRlh = 0.0;
          float jOdMie = 0.0;

          for (int j = 0; j < jSteps; j++) {
            vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);
            float jHeight = length(jPos) - rPlanet;
            jOdRlh += exp(-jHeight / shRlh) * jStepSize;
            jOdMie += exp(-jHeight / shMie) * jStepSize;
            jTime += jStepSize;
          }

          // Attenuation
          vec3 attn = exp(-(kMie * (iOdMie + jOdMie) + kRlh * (iOdRlh + jOdRlh)));

          totalRlh += odStepRlh * attn;
          totalMie += odStepMie * attn;

          iTime += iStepSize;
        }

        return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
      }

      void main() {
        // View direction from center of sphere
        vec3 viewDir = normalize(vPosition);

        // Observer position (at planet surface, slightly above)
        vec3 observerPos = vec3(0.0, uPlanetRadius + 1.0, 0.0);

        // Calculate atmospheric scattering from sun
        vec3 color = atmosphere(
          viewDir,
          observerPos,
          uSunDirection,
          uSunIntensity,
          uPlanetRadius,
          uAtmosphereRadius,
          uRayleighCoeff,
          uMieCoeff,
          uRayleighScaleHeight,
          uMieScaleHeight,
          uMieAnisotropy
        );

        // Add moon glow effect (soft radial glow around moon position)
        if (uMoonIntensity > 0.0) {
          vec3 moonDir = normalize(uMoonDirection);
          float moonAngle = acos(clamp(dot(viewDir, moonDir), -1.0, 1.0));

          // Create soft glow layers around moon
          // Inner glow (tight, bright)
          float innerGlow = exp(-moonAngle * moonAngle * 80.0);
          // Middle glow (medium spread)
          float midGlow = exp(-moonAngle * moonAngle * 20.0);
          // Outer glow (wide, subtle)
          float outerGlow = exp(-moonAngle * moonAngle * 5.0);

          // Moon color (slightly cool white/blue tint)
          vec3 moonColor = vec3(0.9, 0.92, 1.0);

          // Combine glow layers with intensity
          float totalGlow = innerGlow * 0.5 + midGlow * 0.3 + outerGlow * 0.15;
          color += moonColor * totalGlow * uMoonIntensity;
        }

        // Calculate luminance before tone mapping (for alpha calculation)
        // Using standard luminance weights
        float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));

        // Tone mapping (simple Reinhard)
        color = color / (1.0 + color);

        // Gamma correction
        color = pow(color, vec3(1.0 / 2.2));

        // Calculate alpha based on sky brightness
        // Night sky should be transparent to let stars through
        // Scale luminance to get appropriate alpha (tune these values)
        float skyAlpha = clamp(luminance * 2.0, 0.0, 1.0);

        // Smooth the transition to avoid harsh edges
        skyAlpha = smoothstep(0.0, 0.3, skyAlpha);

        // Combine with distance-based opacity
        float finalAlpha = skyAlpha * uOpacity;

        gl_FragColor = vec4(color, finalAlpha);
      }
    `;

    // Atmosphere parameters (scaled for visualization)
    // Using Earth-like ratios but scaled to our CE_RADIUS units
    const planetRadius = 6371.0; // Earth radius in km (reference scale)
    const atmosphereRadius = 6471.0; // Atmosphere top (~100km above surface)

    this.uniforms = {
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uSunIntensity: { value: 22.0 },
      uMoonDirection: { value: new THREE.Vector3(0, 1, 0) },
      uMoonIntensity: { value: 0.0 },
      uPlanetRadius: { value: planetRadius },
      uAtmosphereRadius: { value: atmosphereRadius },
      // Rayleigh scattering coefficients (wavelength-dependent blue scattering)
      uRayleighCoeff: { value: new THREE.Vector3(5.5e-6, 13.0e-6, 22.4e-6) },
      // Mie scattering coefficient (wavelength-independent, creates sun glow)
      uMieCoeff: { value: 21e-6 },
      // Scale heights (how density falls off with altitude)
      uRayleighScaleHeight: { value: 8000.0 },
      uMieScaleHeight: { value: 1200.0 },
      // Mie anisotropy (forward scattering preference, creates sun halo)
      uMieAnisotropy: { value: 0.758 },
      // Opacity for fading
      uOpacity: { value: 1.0 }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: THREE.BackSide, // Render inside of sphere
      transparent: true,
      depthWrite: false,
      depthTest: false // Don't occlude other objects
    });

    // Create hemisphere (upper half only - sky is above horizon)
    // phiStart=0, phiLength=2π (full circle), thetaStart=0, thetaLength=π/2 (upper hemisphere)
    // Default orientation: dome at +Y (up), open at Y=0 (horizon plane)
    const geometry = new THREE.SphereGeometry(this.SKY_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    this.skyMesh = new THREE.Mesh(geometry, material);
    this.skyMesh.renderOrder = -100; // Render first (background)

    // Add to armillary root so it moves with observer
    this.armillaryRoot.add(this.skyMesh);
  }

  /**
   * Update sun direction based on sun's position in local horizon coordinates
   * @param {THREE.Vector3} sunLocalPos - Sun position in armillaryRoot's local space
   */
  updateSunPosition(sunLocalPos) {
    // Normalize to get direction
    this.sunDirection.copy(sunLocalPos).normalize();
    this.uniforms.uSunDirection.value.copy(this.sunDirection);

    // Adjust sun intensity based on altitude
    // Below horizon: reduce intensity for twilight/night
    const sunAltitude = this.sunDirection.y; // y is "up" in local space

    if (sunAltitude > 0) {
      // Day time - full intensity
      this.uniforms.uSunIntensity.value = 22.0;
    } else if (sunAltitude > -0.1) {
      // Civil twilight (-6°) - gradual fade
      const t = (sunAltitude + 0.1) / 0.1;
      this.uniforms.uSunIntensity.value = 2.0 + t * 20.0;
    } else if (sunAltitude > -0.2) {
      // Nautical twilight (-12°) - dim
      const t = (sunAltitude + 0.2) / 0.1;
      this.uniforms.uSunIntensity.value = 0.5 + t * 1.5;
    } else if (sunAltitude > -0.3) {
      // Astronomical twilight (-18°) - very dim
      const t = (sunAltitude + 0.3) / 0.1;
      this.uniforms.uSunIntensity.value = 0.1 + t * 0.4;
    } else {
      // Night - minimal glow
      this.uniforms.uSunIntensity.value = 0.1;
    }
  }

  /**
   * Update moon direction and intensity for sky glow effect
   * @param {THREE.Vector3} moonLocalPos - Moon position in armillaryRoot's local space
   * @param {number} sunAltitude - Sun's altitude (y component, normalized)
   */
  updateMoonPosition(moonLocalPos, sunAltitude) {
    // Normalize to get direction
    const moonDirection = moonLocalPos.clone().normalize();
    this.uniforms.uMoonDirection.value.copy(moonDirection);

    // Moon is only above horizon if y > 0
    const moonAltitude = moonDirection.y;

    if (moonAltitude > 0) {
      // Moon is above horizon - calculate intensity based on time of day
      // Moon glow is most visible at night, less during twilight, invisible during day
      let intensity = 0.0;

      if (sunAltitude < -0.2) {
        // Deep night - full moon glow
        intensity = 0.8;
      } else if (sunAltitude < -0.1) {
        // Nautical twilight - moderate glow
        const t = (sunAltitude + 0.2) / 0.1;
        intensity = 0.8 - t * 0.4;
      } else if (sunAltitude < 0) {
        // Civil twilight - slight glow
        const t = (sunAltitude + 0.1) / 0.1;
        intensity = 0.4 - t * 0.3;
      } else {
        // Daytime - minimal glow (moon still visible but not glowing)
        intensity = 0.1 * (1.0 - Math.min(sunAltitude * 2, 1.0));
      }

      // Scale by moon altitude (dimmer near horizon due to atmospheric extinction)
      intensity *= Math.pow(moonAltitude, 0.3);

      this.uniforms.uMoonIntensity.value = intensity;
    } else {
      // Moon below horizon - no glow
      this.uniforms.uMoonIntensity.value = 0.0;
    }
  }

  /**
   * Set opacity for distance-based fading (similar to Earth fade)
   * @param {number} opacity - Opacity value between 0 and 1
   */
  setOpacity(opacity) {
    this.opacity = opacity;
    this.uniforms.uOpacity.value = opacity;
  }

  /**
   * Show/hide the sky dome
   * @param {boolean} visible
   */
  setVisible(visible) {
    this.skyMesh.visible = visible;
  }
}
