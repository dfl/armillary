// camera.js - Camera controls and stereo rendering

import * as THREE from 'three';

/**
 * CameraController class manages camera operations and stereo rendering.
 *
 * This includes:
 * - Zoom to target functionality
 * - Stereo (cross-eyed 3D) mode toggle
 * - Eye separation adjustment
 * - Stereo camera synchronization
 * - Starfield visibility toggle
 * - Earth visibility based on distance
 * - Window resize handling
 */
export default class CameraController {
  constructor(camera, leftCamera, rightCamera, renderer, controls, sceneRef) {
    this.camera = camera;
    this.leftCamera = leftCamera;
    this.rightCamera = rightCamera;
    this.renderer = renderer;
    this.controls = controls;
    this.sceneRef = sceneRef;

    // Properties
    this.stereoEnabled = false;
    this.eyeSeparation = 0.3;
  }

  zoomToTarget(targetName) {
    let targetWorldPos = new THREE.Vector3();
    let targetRadius = null;
    const camera = this.stereoEnabled ? this.camera : this.camera;

    // Get target position and radius based on name
    if (targetName === 'horizon') {
      this.sceneRef.armillaryRoot.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.CE_RADIUS;
    } else if (targetName === 'earth') {
      this.sceneRef.earthGroup.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.EARTH_RADIUS;
    } else if (targetName === 'sun') {
      this.sceneRef.realisticSunGroup.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.realisticSunMesh.geometry.parameters.radius;
    } else if (targetName === 'moon') {
      this.sceneRef.realisticMoonGroup.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.realisticMoonMesh.geometry.parameters.radius;
    } else if (targetName === 'ecliptic-north') {
      // Special case: view from ecliptic north pole, looking down at solar system
      // Position camera high above the ecliptic plane to see all planets including Pluto
      this.sceneRef.realisticSunGroup.getWorldPosition(targetWorldPos);
      targetRadius = 39.48 * this.sceneRef.PLANET_DISTANCE_SCALE * 1.3; // Pluto's orbit * 1.3 for margin
    } else if (this.sceneRef.planetGroups[targetName]) {
      this.sceneRef.planetGroups[targetName].group.getWorldPosition(targetWorldPos);
      // Get the actual visual radius (accounting for planet scale)
      const geometryRadius = this.sceneRef.planetGroups[targetName].mesh.geometry.parameters.radius;
      const currentScale = this.sceneRef.planetGroups[targetName].group.scale.x;
      targetRadius = geometryRadius * currentScale;
    } else {
      debugLog.warn('Target not found:', targetName);
      return;
    }

    // Calculate camera position (offset from target)
    let newCameraPos;
    let newUp = new THREE.Vector3(0, 1, 0); // Default to world up

    if (targetName === 'horizon') {
      // Orient facing South (Local -Z) from North (Local +Z)
      // Position camera at North (+Z) and slightly Up (+Y)
      // This places ASC on the left and DSC on the right
      const localOffset = new THREE.Vector3(0, targetRadius * 2.0, targetRadius * 6.0);

      // Transform to world space
      const worldOffset = localOffset.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
      newCameraPos = targetWorldPos.clone().add(worldOffset);

      // Align camera up with local up
      const localUp = new THREE.Vector3(0, 1, 0);
      newUp = localUp.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
    } else if (targetName === 'ecliptic-north') {
      // Position camera directly above ecliptic north pole, looking straight down at the ecliptic plane
      // The zodiacGroup has the ecliptic plane in the XY plane (Z=0) in local coordinates
      // The ecliptic north pole is therefore in the +Z direction in zodiacGroup's local space
      const localOffset = new THREE.Vector3(0, 0, targetRadius);

      // Get the zodiacGroup's world quaternion to transform our local offset
      const zodiacWorldQuaternion = new THREE.Quaternion();
      this.sceneRef.zodiacGroup.getWorldQuaternion(zodiacWorldQuaternion);

      // Transform offset to world space
      const worldOffset = localOffset.applyQuaternion(zodiacWorldQuaternion);
      newCameraPos = targetWorldPos.clone().add(worldOffset);

      // Camera up vector should point toward 90° on the zodiac (along +Y in zodiacGroup's local space)
      // This orients the view with 0° Aries (vernal equinox) pointing to the right (+X)
      const localUp = new THREE.Vector3(0, 1, 0);
      newUp = localUp.applyQuaternion(zodiacWorldQuaternion);
    } else {
      // For planets and other bodies, use a multiplier to fill ~1/2 of screen
      const zoomDistance = targetRadius * 4; // Distance from surface
      const direction = camera.position.clone().sub(targetWorldPos).normalize();
      newCameraPos = targetWorldPos.clone().add(direction.multiplyScalar(zoomDistance));
    }

    // Smoothly animate camera
    const startPos = camera.position.clone();
    const startTarget = this.controls.target.clone();
    const startUp = camera.up.clone();
    const duration = 1000; // 1 second
    const startTime = performance.now();

    // Disable controls during animation to prevent conflict
    this.controls.enabled = false;

    const animateCamera = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out function
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Interpolate position
      camera.position.lerpVectors(startPos, newCameraPos, eased);

      // Interpolate target
      this.controls.target.lerpVectors(startTarget, targetWorldPos, eased);

      // Interpolate up vector
      camera.up.lerpVectors(startUp, newUp, eased).normalize();

      // Ensure camera looks at target during transition
      camera.lookAt(this.controls.target);

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      } else {
        // Animation complete
        this.controls.enabled = true;
        this.controls.update();
      }
    };

    animateCamera();
  }

  toggleStereo(enabled) {
    this.stereoEnabled = enabled;
    this.onWindowResize(); // Update camera aspects
  }

  setEyeSeparation(separation) {
    this.eyeSeparation = separation;
  }

  updateStereoCameras() {
    // Copy main camera position and rotation to stereo cameras
    this.leftCamera.position.copy(this.camera.position);
    this.leftCamera.rotation.copy(this.camera.rotation);
    this.rightCamera.position.copy(this.camera.position);
    this.rightCamera.rotation.copy(this.camera.rotation);

    // Offset cameras horizontally (left/right) for stereo effect
    // We offset along the camera's local X-axis
    const cameraRight = new THREE.Vector3();
    this.camera.getWorldDirection(cameraRight);
    cameraRight.cross(this.camera.up).normalize();

    this.leftCamera.position.add(cameraRight.clone().multiplyScalar(-this.eyeSeparation / 2));
    this.rightCamera.position.add(cameraRight.clone().multiplyScalar(this.eyeSeparation / 2));
  }

  toggleStarfield(visible) {
    this.sceneRef.starGroup.visible = visible;
    this.sceneRef.constellationLineGroup.visible = visible;
    this.sceneRef.bgStarField.visible = visible;
  }

  updateEarthVisibility() {
    if (!this.sceneRef.earthGroup || !this.camera || !this.sceneRef.earthMesh) return;

    const dist = this.camera.position.distanceTo(this.sceneRef.earthGroup.position);
    const surfaceDist = dist - this.sceneRef.EARTH_RADIUS;

    // Opacity logic:
    // Close (surface view): Transparent
    // Far (space view): Opaque
    const minVal = 0.0;
    const maxVal = 1.0;
    // Transition based on distance from Earth's surface
    // Start transition at 10% of Earth radius, complete at 2x Earth radius
    const minRange = this.sceneRef.EARTH_RADIUS * 0.1;
    const maxRange = this.sceneRef.EARTH_RADIUS * 2.0;

    let opacity = 1.0;
    if (surfaceDist < minRange) {
      opacity = minVal;
    } else if (surfaceDist > maxRange) {
      opacity = maxVal;
    } else {
      const t = (surfaceDist - minRange) / (maxRange - minRange);
      opacity = minVal + t * (maxVal - minVal);
    }

    if (this.sceneRef.earthMesh.material.uniforms && this.sceneRef.earthMesh.material.uniforms.opacity) {
      this.sceneRef.earthMesh.material.uniforms.opacity.value = opacity;
    }

    this.sceneRef.earthGroup.visible = true;
  }

  onWindowResize() {
    if (this.stereoEnabled) {
      // Split viewport mode - each camera gets half the width
      const aspect = (window.innerWidth / 2) / window.innerHeight;
      this.leftCamera.aspect = aspect;
      this.leftCamera.updateProjectionMatrix();
      this.rightCamera.aspect = aspect;
      this.rightCamera.updateProjectionMatrix();
    } else {
      // Normal single viewport
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
