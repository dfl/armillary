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

        // Procedural sunset/sunrise colors (replaces broken physical scattering for twilight)
        vec3 sunDir = normalize(uSunDirection);
        float sunAltitude = sunDir.y;

        // Apply sunset colors when sun is near or below horizon
        if (sunAltitude < 0.3 && sunAltitude > -0.25) {
          // Reduce base blue sky during sunset/sunrise
          float skyDimming = smoothstep(0.3, -0.1, sunAltitude);
          color *= (1.0 - skyDimming * 0.6);

          // Angle between view direction and sun
          float sunDot = dot(viewDir, sunDir);
          float sunAngle = acos(clamp(sunDot, -1.0, 1.0));

          // How close to the horizon plane (y=0)
          float horizonDist = abs(viewDir.y);

          // Calculate sunset influence based on sun altitude
          // Fades out quickly after sun sets to avoid aurora effect
          float sunsetStrength = 0.0;

          if (sunAltitude > 0.0) {
            // Sun above horizon: full strength golden hour
            sunsetStrength = smoothstep(0.3, 0.0, sunAltitude);
          } else if (sunAltitude > -0.1) {
            // Just below horizon (0° to -6°): civil twilight, fading fast
            sunsetStrength = smoothstep(-0.1, 0.0, sunAltitude) * 0.7;
          } else {
            // Below -6°: nautical twilight, very dim and fading out
            sunsetStrength = smoothstep(-0.25, -0.1, sunAltitude) * 0.3;
          }

          // Create radial gradient from sun position with smooth falloff
          float sunGlow = smoothstep(2.0, 0.0, sunAngle);

          // Horizon band - only on sun's side of sky (not opposite)
          float towardsSun = smoothstep(-0.3, 0.3, sunDot); // 0 when facing away, 1 toward sun
          float horizonBand = smoothstep(0.5, 0.0, horizonDist) * smoothstep(0.0, 0.15, horizonDist) * towardsSun;

          // Combine radial and horizon effects (increased influence)
          float colorInfluence = max(sunGlow * 0.85, horizonBand * 0.65) * sunsetStrength;

          // Multi-layer sunset colors based on angle from sun
          vec3 sunsetColor;
          if (sunAngle < 0.4) {
            // Near sun: deep orange/red
            sunsetColor = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.5, 0.1), sunAngle / 0.4);
          } else if (sunAngle < 0.8) {
            // Medium: orange to pink
            float t = (sunAngle - 0.4) / 0.4;
            sunsetColor = mix(vec3(1.0, 0.5, 0.1), vec3(1.0, 0.45, 0.25), t);
          } else if (sunAngle < 1.4) {
            // Far: pink to warm purple
            float t = (sunAngle - 0.8) / 0.6;
            sunsetColor = mix(vec3(1.0, 0.45, 0.25), vec3(0.7, 0.35, 0.5), t);
          } else {
            // Very far: purple to deep twilight blue
            float t = (sunAngle - 1.4) / 0.6;
            sunsetColor = mix(vec3(0.7, 0.35, 0.5), vec3(0.3, 0.35, 0.6), t);
          }

          // Smooth blend with base sky color
          color = mix(color, sunsetColor, colorInfluence);
        }

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

        // Boost color intensity for sunset/sunrise visibility
        color *= 1.5;

        // Enhanced tone mapping for sunset/sunrise color preservation
        // Use gentler filmic curve
        vec3 x = max(vec3(0.0), color - 0.004);
        color = (x * (6.2 * x + 0.5)) / (x * (6.2 * x + 1.7) + 0.06);

        // Strong saturation boost during twilight for vivid colors
        if (luminance < 0.8 && luminance > 0.005) {
          vec3 luminanceVec = vec3(dot(color, vec3(0.2126, 0.7152, 0.0722)));
          float saturationBoost = smoothstep(0.005, 0.5, luminance) * 0.5;
          color = mix(luminanceVec, color, 1.0 + saturationBoost);
        }

        // Lighter gamma for more visible twilight colors
        color = pow(color, vec3(0.85));

        // Calculate alpha based on sky brightness
        // Night sky should be transparent to let stars through
        // Scale luminance to get appropriate alpha
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
      // Rayleigh scattering coefficients (wavelength-dependent scattering)
      // Values in RGB order: red scatters least (shortest path), blue scatters most
      // Based on β ∝ 1/λ⁴: λ_red=680nm, λ_green=550nm, λ_blue=440nm
      // Increased significantly for dramatic sunset colors
      uRayleighCoeff: { value: new THREE.Vector3(3.8e-6, 13.5e-6, 33.0e-6) },
      // Mie scattering coefficient (aerosols: dust, pollution)
      // Minimal to avoid sun halo
      uMieCoeff: { value: 3e-6 },
      // Scale heights (atmospheric density falloff with altitude)
      uRayleighScaleHeight: { value: 8000.0 }, // Air molecules: 8km
      uMieScaleHeight: { value: 1200.0 },      // Aerosols: 1.2km
      // Mie anisotropy - reduced to minimize forward-scattering halo effect
      uMieAnisotropy: { value: 0.65 },
      // Opacity for fading
      uOpacity: { value: 1.0 }
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      side: THREE.BackSide, // Render inside of sphere
      transparent: true,
      depthWrite: true, // Write to depth buffer to clip realistic sun/moon
      depthTest: true // Test depth to properly layer with other objects
    });

    // Create hemisphere (upper half only - sky is above horizon)
    // phiStart=0, phiLength=2π (full circle), thetaStart=0, thetaLength=π/2 (upper hemisphere)
    // Default orientation: dome at +Y (up), open at Y=0 (horizon plane)
    const geometry = new THREE.SphereGeometry(this.SKY_RADIUS, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
    this.skyMesh = new THREE.Mesh(geometry, material);
    this.skyMesh.renderOrder = -1; // Render before realistic sun/moon for proper clipping

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

    // Adjust sun intensity based on altitude for realistic day/twilight/night transitions
    // The sunAltitude is normalized direction, roughly maps to sin(altitude_angle)
    const sunAltitude = this.sunDirection.y; // y is "up" in local space

    if (sunAltitude > 0.05) {
      // Daytime - full intensity (sun more than ~3° above horizon)
      this.uniforms.uSunIntensity.value = 25.0;
    } else if (sunAltitude > -0.05) {
      // Horizon crossing (-3° to +3°) - GOLDEN HOUR
      // Very high intensity for dramatic sunset/sunrise colors
      const t = (sunAltitude + 0.05) / 0.1; // 0 at -3°, 1 at +3°
      // Use power curve for more dramatic transition
      this.uniforms.uSunIntensity.value = 18.0 + Math.pow(t, 0.6) * 12.0;
    } else if (sunAltitude > -0.15) {
      // Civil twilight (-3° to -9°) - strong scattering for pink/orange sky
      const t = (sunAltitude + 0.15) / 0.1;
      this.uniforms.uSunIntensity.value = 8.0 + t * 10.0;
    } else if (sunAltitude > -0.25) {
      // Nautical twilight (-9° to -15°) - dimmer blue hour
      const t = (sunAltitude + 0.25) / 0.1;
      this.uniforms.uSunIntensity.value = 2.0 + t * 6.0;
    } else if (sunAltitude > -0.35) {
      // Astronomical twilight (-15° to -21°) - fading to night
      const t = (sunAltitude + 0.35) / 0.1;
      this.uniforms.uSunIntensity.value = 0.3 + t * 1.7;
    } else {
      // Night - minimal contribution for complete darkness
      this.uniforms.uSunIntensity.value = 0.05;
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
