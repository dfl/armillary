// viewMode.js - View mode and opacity management

/**
 * View Mode Manager
 * Handles opacity and visibility based on view mode (horizon vs earth vs zenith)
 */
export class ViewModeManager {
  constructor(scene) {
    this.scene = scene;
  }

  /**
   * Set opacity of horizon view elements (for zenith view fade effect)
   * @param {number} opacity - Opacity value between 0 and 1
   */
  setHorizonElementsOpacity(opacity) {
    const isZenithView = opacity < 0.5; // Entering zenith view when opacity drops below 50%

    this._setHorizonOpacity(opacity, isZenithView);
    this._setReferenceOpacity(opacity);
    this._setPoleLabelsOpacity(opacity);
    this._setZodiacWheelOpacity(opacity, isZenithView);
    this._setAngleMarkersVisibility(isZenithView, opacity);
    this._setEclipticPlanetVisibility(isZenithView);
    this._setCompassRoseOpacity(opacity);
    this._setSunMoonOpacity(opacity, isZenithView);
    this._setRealisticBodiesOpacity(opacity);
    this._finalizeHorizonOutline(isZenithView);
  }

  /**
   * Set horizon plane and outline opacity
   */
  _setHorizonOpacity(opacity, isZenithView) {
    if (isZenithView) {
      // Approaching or in zenith view - keep horizon outline at full visibility
      if (this.scene.horizonOutline) {
        this.scene.horizonOutline.visible = true;
        if (this.scene.horizonOutline.material) {
          this.scene.horizonOutline.material.opacity = 1.0; // Always full brightness
          this.scene.horizonOutline.material.transparent = true;
          this.scene.horizonOutline.material.depthTest = false; // Always visible, no depth clipping
          this.scene.horizonOutline.material.needsUpdate = true;
        }
        this.scene.horizonOutline.renderOrder = 1000; // Render on top of everything
      }
      // Fade out horizon plane as approaching zenith
      if (this.scene.horizonPlane) {
        if (opacity === 0) {
          this.scene.horizonPlane.visible = false;
        } else {
          this.scene.horizonPlane.visible = true;
          this._setMaterialOpacity(this.scene.horizonPlane, opacity, 0.1);
        }
      }
    } else {
      // Normal view - fade with opacity and reset depth settings
      if (this.scene.horizonPlane) {
        this.scene.horizonPlane.visible = true;
        this._setMaterialOpacity(this.scene.horizonPlane, opacity, 0.1);
      }
      if (this.scene.horizonOutline) {
        this.scene.horizonOutline.visible = true;
        this.scene.horizonOutline.renderOrder = 0; // Reset render order
        if (this.scene.horizonOutline.material) {
          this.scene.horizonOutline.material.depthTest = true; // Re-enable depth testing
        }
        this._setMaterialOpacity(this.scene.horizonOutline, opacity, 0.5);
      }
    }
  }

  /**
   * Set reference lines opacity (meridian, prime vertical, celestial equator)
   */
  _setReferenceOpacity(opacity) {
    this._setMaterialOpacity(this.scene.meridianOutline, opacity, 0.5);
    this._setMaterialOpacity(this.scene.primeVerticalOutline, opacity, 0.5);
    this._setMaterialOpacity(this.scene.celestialEquatorOutline, opacity, 0.6);
  }

  /**
   * Set pole labels opacity
   */
  _setPoleLabelsOpacity(opacity) {
    if (this.scene.poleLabels) {
      if (this.scene.poleLabels.NP && this.scene.poleLabels.NP.material) {
        this.scene.poleLabels.NP.material.opacity = opacity;
      }
      if (this.scene.poleLabels.SP && this.scene.poleLabels.SP.material) {
        this.scene.poleLabels.SP.material.opacity = opacity;
      }
    }
  }

  /**
   * Set zodiac wheel elements opacity (but not sun/moon/planets)
   */
  _setZodiacWheelOpacity(opacity, isZenithView) {
    if (!this.scene.zodiacGroup) return;

    this.scene.zodiacGroup.traverse((child) => {
      // Skip sun and moon groups and all their descendants
      if (this._isDescendantOf(child, this.scene.eclipticSunGroup)) return;
      if (this._isDescendantOf(child, this.scene.eclipticMoonGroup)) return;
      if (child === this.scene.eclipticSunGroup) return;
      if (child === this.scene.eclipticMoonGroup) return;

      // Skip ecliptic planet groups and their descendants
      if (this.scene.eclipticPlanetGroups) {
        for (const name in this.scene.eclipticPlanetGroups) {
          const planetGroup = this.scene.eclipticPlanetGroups[name].group;
          if (child === planetGroup || this._isDescendantOf(child, planetGroup)) return;
        }
      }

      // Skip angle markers - their visibility is controlled explicitly elsewhere
      if (child.userData?.angleName) return;

      if (child.material) {
        const baseOpacity = child.material.userData?.baseOpacity ?? child.material.opacity;
        if (!child.material.userData) child.material.userData = {};
        child.material.userData.baseOpacity = baseOpacity;
        child.material.opacity = opacity * Math.min(baseOpacity, 1.0);
        child.material.transparent = true;
      }
    });
  }

  /**
   * Set angle markers visibility (MC, IC, ASC, DSC, VTX, AVX)
   */
  _setAngleMarkersVisibility(isZenithView, opacity) {
    // IMPORTANT: Angle spheres should NEVER show in zenith view
    if (this.scene.spheres) {
      for (const name in this.scene.spheres) {
        const sphere = this.scene.spheres[name];
        if (sphere) {
          // Force hidden in zenith view, regardless of other toggle states
          sphere.visible = !isZenithView && opacity > 0;
        }
      }
    }

    // Angle labels
    if (this.scene.angleLabels) {
      for (const name in this.scene.angleLabels) {
        const label = this.scene.angleLabels[name];
        if (label) {
          // Force hidden in zenith view, regardless of other toggle states
          label.visible = !isZenithView && opacity > 0;
        }
      }
    }
  }

  /**
   * Set ecliptic planet markers visibility
   */
  _setEclipticPlanetVisibility(isZenithView) {
    // IMPORTANT: Should NEVER show in zenith view, regardless of planets toggle
    if (this.scene.eclipticPlanetGroups) {
      for (const planetName in this.scene.eclipticPlanetGroups) {
        const planetGroup = this.scene.eclipticPlanetGroups[planetName].group;
        if (planetGroup) {
          // In zenith view, always hide. Otherwise, respect the planets toggle state
          if (isZenithView) {
            planetGroup.visible = false;
          } else {
            // Restore visibility based on planets toggle when not in zenith view
            const planetsToggle = document.getElementById('planetsToggle');
            const planetsVisible = planetsToggle ? planetsToggle.checked : true;
            planetGroup.visible = planetsVisible;
          }
        }
      }
    }
  }

  /**
   * Set compass rose and other armillaryRoot children opacity
   */
  _setCompassRoseOpacity(opacity) {
    if (!this.scene.armillaryRoot) return;

    this.scene.armillaryRoot.children.forEach(child => {
      // Skip sky atmosphere
      if (this.scene.skyAtmosphere && child === this.scene.skyAtmosphere.skyMesh) return;
      // Skip celestial group (contains stars, zodiac with sun/moon)
      if (child === this.scene.celestial) return;
      if (child === this.scene.tiltGroup) return;

      // Hide/show based on opacity
      if (child.material) {
        const baseOpacity = child.material.userData?.baseOpacity ?? child.material.opacity;
        if (!child.material.userData) child.material.userData = {};
        child.material.userData.baseOpacity = baseOpacity;
        child.material.opacity = opacity * Math.min(baseOpacity, 1.0);
        child.material.transparent = true;
      }
      // Also set visibility for objects without materials (groups)
      if (opacity === 0) {
        child.visible = false;
      } else {
        child.visible = true;
      }
    });
  }

  /**
   * Set sun and moon opacity (ecliptic spheres and sky billboards)
   */
  _setSunMoonOpacity(opacity, isZenithView) {
    // Make sure sun and moon groups stay visible
    if (this.scene.eclipticSunGroup) this.scene.eclipticSunGroup.visible = true;
    if (this.scene.eclipticMoonGroup) this.scene.eclipticMoonGroup.visible = true;

    // Ecliptic sun/moon spheres - fade out as approaching zenith view
    if (this.scene.eclipticSunMesh) {
      this.scene.eclipticSunMesh.visible = opacity > 0;
      if (this.scene.eclipticSunMesh.material && opacity < 1) {
        this.scene.eclipticSunMesh.material.opacity = opacity;
        this.scene.eclipticSunMesh.material.transparent = true;
      }
    }
    if (this.scene.eclipticMoonMesh) {
      this.scene.eclipticMoonMesh.visible = opacity > 0;
      if (this.scene.eclipticMoonMesh.material && opacity < 1) {
        this.scene.eclipticMoonMesh.material.opacity = opacity;
        this.scene.eclipticMoonMesh.material.transparent = true;
      }
    }

    // Sun/moon glow meshes - fade out with their parent spheres
    this._setGlowOpacity(this.scene.eclipticSunGlowMeshes, opacity);
    this._setGlowOpacity(this.scene.moonGlowMeshes, opacity);

    // Sky sun/moon discs - fade in as ecliptic spheres fade out
    this._setSkyBillboardOpacity(this.scene.celestialObjects?.skySunMesh, opacity);
    this._setSkyBillboardOpacity(this.scene.celestialObjects?.skyMoonMesh, opacity);
  }

  /**
   * Set realistic heliocentric sun and moon opacity
   */
  _setRealisticBodiesOpacity(opacity) {
    // Fade these out in zenith view so they don't distract from the sky view
    if (this.scene.realisticSunMesh) {
      this.scene.realisticSunMesh.visible = opacity > 0;
      if (this.scene.realisticSunMesh.material && opacity < 1) {
        this.scene.realisticSunMesh.material.opacity = opacity;
        this.scene.realisticSunMesh.material.transparent = true;
      }
    }
    this._setGlowOpacity(this.scene.realisticSunGlowMeshes, opacity);

    if (this.scene.realisticMoonMesh) {
      this.scene.realisticMoonMesh.visible = opacity > 0;
      if (this.scene.realisticMoonMesh.material && opacity < 1) {
        this.scene.realisticMoonMesh.material.opacity = opacity;
        this.scene.realisticMoonMesh.material.transparent = true;
      }
    }
    this._setGlowOpacity(this.scene.realisticMoonGlowMeshes, opacity);
  }

  /**
   * Final override: Force horizon outline to stay visible in zenith view
   */
  _finalizeHorizonOutline(isZenithView) {
    if (isZenithView && this.scene.horizonOutline) {
      this.scene.horizonOutline.visible = true;
      this.scene.horizonOutline.renderOrder = 1000;
      if (this.scene.horizonOutline.material) {
        this.scene.horizonOutline.material.opacity = 1.0;
        this.scene.horizonOutline.material.transparent = true;
        this.scene.horizonOutline.material.depthTest = false;
        this.scene.horizonOutline.material.needsUpdate = true;
      }
    }
  }

  // ===================================================================
  // Helper Methods
  // ===================================================================

  /**
   * Set material opacity with base opacity multiplier
   */
  _setMaterialOpacity(obj, opacity, baseOpacity = 1.0) {
    if (!obj || !obj.material) return;
    obj.material.opacity = opacity * baseOpacity;
    obj.material.transparent = true;
    obj.material.needsUpdate = true;
  }

  /**
   * Check if object is descendant of a group
   */
  _isDescendantOf(obj, group) {
    if (!group) return false;
    let parent = obj.parent;
    while (parent) {
      if (parent === group) return true;
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Set glow meshes opacity
   */
  _setGlowOpacity(glowMeshes, opacity) {
    if (!glowMeshes) return;
    glowMeshes.forEach(glow => {
      glow.visible = opacity > 0;
      if (glow.material && opacity < 1) {
        glow.material.opacity = opacity * (glow.material.userData?.baseOpacity ?? 1.0);
      }
    });
  }

  /**
   * Set sky billboard opacity (fade in as spheres fade out)
   */
  _setSkyBillboardOpacity(billboard, opacity) {
    if (!billboard) return;
    // Start showing billboard when opacity < 0.5, fully visible at opacity = 0
    const billboardOpacity = opacity < 0.5 ? (1.0 - opacity * 2.0) : 0.0;
    billboard.visible = billboardOpacity > 0;
    if (billboard.material && billboardOpacity > 0) {
      billboard.material.opacity = billboardOpacity;
      billboard.material.transparent = true;
    }
    if (billboardOpacity > 0 && this.scene.camera) {
      // Make billboard face camera
      billboard.quaternion.copy(this.scene.camera.quaternion);
    }
  }
}

export default ViewModeManager;
