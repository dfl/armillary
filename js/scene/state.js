// state.js - Scene state management

import * as THREE from 'three';

/**
 * Scene State Manager
 * Manages all stateful data for the armillary scene
 */
export class SceneState {
  constructor() {
    // ===================================================================
    // Previous State for Camera Synchronization
    // ===================================================================
    this.prevArmillaryPos = null;
    this.prevArmillaryQuat = null;

    // ===================================================================
    // Astronomical State
    // ===================================================================
    // Store lunar phase info for tooltip
    this.lunarPhase = { phase: "", illumination: 0 };
    this.lunarPhaseAngle = undefined;

    // Store sun/moon positions for tooltips
    this.sunZodiacPosition = "";
    this.moonZodiacPosition = "";

    // Store lunar node positions for tooltips
    this.nodePositions = null;

    // Store lunar apsis positions for tooltips
    this.lunarApsisPositions = {};

    // Store angle positions for tooltips
    this.anglePositions = {
      MC: "",
      IC: "",
      ASC: "",
      DSC: "",
      VTX: "",
      AVX: ""
    };

    // Store planet zodiac positions for tooltips
    this.planetZodiacPositions = {};

    // ===================================================================
    // View Mode State
    // ===================================================================
    this.zenithViewUpVector = null;

    // ===================================================================
    // Other State
    // ===================================================================
    this._lastOrbitYear = null; // Track last year orbits were calculated
    this.constellationArtAlwaysOn = false;
  }

  /**
   * Update previous armillary position/rotation for camera sync
   */
  updatePreviousArmillaryState(armillaryRoot) {
    if (!this.prevArmillaryPos) {
      this.prevArmillaryPos = armillaryRoot.position.clone();
    }
    if (!this.prevArmillaryQuat) {
      this.prevArmillaryQuat = armillaryRoot.quaternion.clone();
    }

    const armillaryDelta = new THREE.Vector3().subVectors(
      armillaryRoot.position,
      this.prevArmillaryPos
    );
    this.prevArmillaryPos.copy(armillaryRoot.position);

    const deltaQuat = new THREE.Quaternion()
      .copy(armillaryRoot.quaternion)
      .multiply(this.prevArmillaryQuat.clone().invert());
    this.prevArmillaryQuat.copy(armillaryRoot.quaternion);

    return { armillaryDelta, deltaQuat };
  }

  /**
   * Initialize node positions if not already set
   */
  initNodePositions() {
    if (!this.nodePositions) {
      this.nodePositions = {};
    }
  }

  /**
   * Check if orbits need to be recalculated for a new year
   */
  shouldRecalculateOrbits(currentYear) {
    return !this._lastOrbitYear || this._lastOrbitYear !== currentYear;
  }

  /**
   * Mark orbits as calculated for a given year
   */
  markOrbitsCalculated(currentYear) {
    this._lastOrbitYear = currentYear;
  }
}

export default SceneState;
