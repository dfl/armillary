// deviceOrientation.js - Device Orientation Controller for mobile compass mode
// Uses the DeviceOrientation API to control camera based on phone orientation

import * as THREE from 'three';

export default class DeviceOrientationController {
  constructor(camera, controls, armillaryRoot) {
    this.camera = camera;
    this.controls = controls;
    this.armillaryRoot = armillaryRoot;

    this.enabled = false;
    this.deviceOrientation = null;
    this.screenOrientation = 0;

    // Store original camera state for restoration
    this.originalCameraPosition = null;
    this.originalCameraUp = null;
    this.originalControlsTarget = null;

    // Calibration offset (allows user to recenter)
    this.alphaOffset = 0;

    // Smoothing for camera movement
    this.targetQuaternion = new THREE.Quaternion();
    this.smoothingFactor = 0.1;

    // Reusable objects for calculations
    this.euler = new THREE.Euler();
    this.quaternion = new THREE.Quaternion();
    this.zee = new THREE.Vector3(0, 0, 1);
    this.q0 = new THREE.Quaternion();
    this.q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg around X

    // Bound event handlers
    this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.onScreenOrientationChange = this.onScreenOrientationChange.bind(this);

    // Check for API support
    this.isSupported = 'DeviceOrientationEvent' in window;
    this.needsPermission = typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  /**
   * Check if device orientation is supported
   */
  static isSupported() {
    return 'DeviceOrientationEvent' in window;
  }

  /**
   * Check if we're on a mobile/touch device
   */
  static isMobileDevice() {
    return 'ontouchstart' in window ||
           navigator.maxTouchPoints > 0 ||
           /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /**
   * Request permission and enable device orientation control
   * Returns a promise that resolves to true if successful
   */
  async enable() {
    if (!this.isSupported) {
      console.warn('DeviceOrientation API not supported');
      return false;
    }

    // iOS 13+ requires explicit permission
    if (this.needsPermission) {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          console.warn('DeviceOrientation permission denied');
          return false;
        }
      } catch (error) {
        console.error('Error requesting DeviceOrientation permission:', error);
        return false;
      }
    }

    // Store original camera state
    this.originalCameraPosition = this.camera.position.clone();
    this.originalCameraUp = this.camera.up.clone();
    this.originalControlsTarget = this.controls.target.clone();

    // Disable OrbitControls
    this.controls.enabled = false;

    // Position camera at the observer's location (center of armillary sphere)
    // This puts you "inside" the horizon looking out at the sky
    const observerPosition = new THREE.Vector3();
    this.armillaryRoot.getWorldPosition(observerPosition);
    this.camera.position.copy(observerPosition);
    this.camera.up.set(0, 1, 0);

    // Add event listeners
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
    window.addEventListener('orientationchange', this.onScreenOrientationChange);

    // Get initial screen orientation
    this.screenOrientation = window.orientation || 0;

    this.enabled = true;
    console.log('Device orientation mode enabled - camera at observer position');
    return true;
  }

  /**
   * Disable device orientation control and restore original camera state
   */
  disable() {
    if (!this.enabled) return;

    // Remove event listeners
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
    window.removeEventListener('orientationchange', this.onScreenOrientationChange);

    // Restore original camera state
    if (this.originalCameraPosition) {
      this.camera.position.copy(this.originalCameraPosition);
      this.camera.up.copy(this.originalCameraUp);
      this.controls.target.copy(this.originalControlsTarget);
    }

    // Re-enable OrbitControls
    this.controls.enabled = true;
    this.controls.update();

    this.enabled = false;
    this.alphaOffset = 0;
    console.log('Device orientation mode disabled');
  }

  /**
   * Recalibrate - set current heading as "forward"
   */
  calibrate() {
    if (this.deviceOrientation && this.deviceOrientation.alpha !== null) {
      this.alphaOffset = this.deviceOrientation.alpha;
      console.log('Compass calibrated, offset:', this.alphaOffset);
    }
  }

  /**
   * Handle device orientation events
   */
  onDeviceOrientation(event) {
    if (!this.enabled) return;

    this.deviceOrientation = event;

    // Get orientation values
    let alpha = event.alpha || 0; // compass heading (0-360)
    const beta = event.beta || 0;  // front-back tilt (-180 to 180)
    const gamma = event.gamma || 0; // left-right tilt (-90 to 90)

    // Apply calibration offset
    alpha = (alpha - this.alphaOffset + 360) % 360;

    // Convert to radians
    const alphaRad = THREE.MathUtils.degToRad(alpha);
    const betaRad = THREE.MathUtils.degToRad(beta);
    const gammaRad = THREE.MathUtils.degToRad(gamma);

    // Create quaternion from device orientation
    this.setQuaternionFromOrientation(alphaRad, betaRad, gammaRad);
  }

  /**
   * Convert device orientation angles to a quaternion
   * Based on the W3C Device Orientation spec
   *
   * The device orientation gives us:
   * - alpha: compass heading (0-360, 0 = north)
   * - beta: front-back tilt (-180 to 180, 90 = pointing up)
   * - gamma: left-right tilt (-90 to 90)
   *
   * We need to convert this to a camera orientation that matches
   * the local horizon frame of the armillary sphere.
   */
  setQuaternionFromOrientation(alpha, beta, gamma) {
    // Get the armillary's world orientation (accounts for latitude tilt)
    const armillaryQuat = new THREE.Quaternion();
    this.armillaryRoot.getWorldQuaternion(armillaryQuat);

    // Convert device orientation to camera look direction
    // Device coordinate system: X=right, Y=up (screen), Z=towards user
    // We need to rotate so the camera looks outward from the device screen

    // Start with device orientation
    // ZXY order: alpha (yaw), then beta (pitch), then gamma (roll)
    this.euler.set(beta, alpha, -gamma, 'YXZ');
    this.quaternion.setFromEuler(this.euler);

    // Apply screen orientation correction
    const screenOrientRad = THREE.MathUtils.degToRad(-this.screenOrientation);
    this.q0.setFromAxisAngle(this.zee, screenOrientRad);
    this.quaternion.multiply(this.q0);

    // Rotate from device frame to camera frame
    // -90 deg around X to convert from device "screen up" to camera "look forward"
    this.quaternion.multiply(this.q1);

    // Apply the armillary's world orientation so that:
    // - When pointing north (alpha=0), camera looks toward geographic north in the scene
    // - The tilt accounts for the observer's latitude
    this.quaternion.premultiply(armillaryQuat);

    // Store as target for smoothing
    this.targetQuaternion.copy(this.quaternion);
  }

  /**
   * Handle screen orientation changes (portrait/landscape)
   */
  onScreenOrientationChange() {
    this.screenOrientation = window.orientation || 0;
  }

  /**
   * Update camera - should be called in animation loop
   */
  update() {
    if (!this.enabled) return;

    // Smoothly interpolate to target quaternion
    this.camera.quaternion.slerp(this.targetQuaternion, this.smoothingFactor);
  }

  /**
   * Get current compass heading in degrees (0-360, 0 = North)
   */
  getHeading() {
    if (!this.deviceOrientation || this.deviceOrientation.alpha === null) {
      return null;
    }
    return (this.deviceOrientation.alpha - this.alphaOffset + 360) % 360;
  }

  /**
   * Get current altitude (tilt up/down) in degrees
   */
  getAltitude() {
    if (!this.deviceOrientation || this.deviceOrientation.beta === null) {
      return null;
    }
    // Beta is -180 to 180, where 0 is flat, 90 is pointing up
    // Convert to altitude where 0 = horizon, 90 = zenith, -90 = nadir
    let altitude = this.deviceOrientation.beta;
    if (altitude > 90) altitude = 180 - altitude;
    if (altitude < -90) altitude = -180 - altitude;
    return altitude;
  }

  /**
   * Toggle enabled state
   */
  async toggle() {
    if (this.enabled) {
      this.disable();
      return false;
    } else {
      return await this.enable();
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.disable();
  }
}
