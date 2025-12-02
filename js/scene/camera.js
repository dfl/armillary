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
    // Read default from HTML element, fallback to 0.05 if not available
    const eyeSeparationSlider = typeof document !== 'undefined' ? document.getElementById('eyeSeparationSlider') : null;
    this.eyeSeparation = eyeSeparationSlider ? parseFloat(eyeSeparationSlider.value) : 0.05;
    this.currentZoomTarget = null; // Track current zoom target for dynamic updates
    this.isZoomAnimating = false; // Track if zoom animation is in progress
  }

  zoomToTarget(targetName, skipAnimation = false) {
    // Store current zoom target for dynamic updates when planet zoom changes
    this.currentZoomTarget = targetName;

    let targetWorldPos = new THREE.Vector3();
    let targetRadius = null;
    const camera = this.stereoEnabled ? this.camera : this.camera;

    // Get target position and radius based on name
    if (targetName === 'horizon') {
      this.sceneRef.armillaryRoot.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.CE_RADIUS;
    } else if (targetName === 'zenith') {
      this.sceneRef.armillaryRoot.getWorldPosition(targetWorldPos);
      targetRadius = this.sceneRef.CE_RADIUS;
    } else if (targetName === 'earth') {
      this.sceneRef.earthGroup.getWorldPosition(targetWorldPos);
      // Account for Earth's current scale from planet zoom
      const currentScale = this.sceneRef.earthGroup.scale.x;
      targetRadius = this.sceneRef.EARTH_RADIUS * currentScale;
    } else if (targetName === 'sun') {
      this.sceneRef.realisticSunGroup.getWorldPosition(targetWorldPos);
      // Account for Sun's current scale from planet zoom
      const currentScale = this.sceneRef.realisticSunGroup.scale.x;
      targetRadius = this.sceneRef.realisticSunMesh.geometry.parameters.radius * currentScale;
    } else if (targetName === 'moon') {
      this.sceneRef.realisticMoonGroup.getWorldPosition(targetWorldPos);
      // Account for Moon's current scale from planet zoom
      const currentScale = this.sceneRef.realisticMoonGroup.scale.x;
      targetRadius = this.sceneRef.realisticMoonMesh.geometry.parameters.radius * currentScale;
    } else if (targetName === 'ecliptic-north') {
      // Special case: view from ecliptic north pole, looking down at solar system
      // Position camera high above the ecliptic plane to see all planets including Pluto
      this.sceneRef.realisticSunGroup.getWorldPosition(targetWorldPos);
      // Account for distance compression: Pluto at 39.48 AU gets compressed
      const distanceExponent = 1.0 - this.sceneRef.planetZoomFactor * 0.65;
      const compressedPlutoDistAU = Math.pow(39.48, distanceExponent);
      // Apply zoom scale (same as in scene.js planet positioning)
      const zoomScale = 1.0 - this.sceneRef.planetZoomFactor * 0.7;
      targetRadius = compressedPlutoDistAU * this.sceneRef.PLANET_DISTANCE_SCALE * zoomScale * 1.3; // Pluto's orbit * 1.3 for margin
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
      // Position camera at North (+Z) and slightly Up (+Y) in horizon's current frame
      // This places ASC on the left and DSC on the right
      const localOffset = new THREE.Vector3(0, targetRadius * 2.0, targetRadius * 6.0);

      // Transform to world space using current armillary orientation
      const worldOffset = localOffset.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
      newCameraPos = targetWorldPos.clone().add(worldOffset);

      // Camera up aligns with horizon's current up direction
      const localUp = new THREE.Vector3(0, 1, 0);
      newUp = localUp.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
    } else if (targetName === 'zenith') {
      // Position camera near observer's position looking up at the sky
      const armillaryPos = new THREE.Vector3();
      this.sceneRef.armillaryRoot.getWorldPosition(armillaryPos);

      // Camera slightly above the horizon plane (so horizon circle is visible below and OrbitControls works smoothly)
      const localCameraOffset = new THREE.Vector3(0, targetRadius * 0.02, 0);
      const worldCameraOffset = localCameraOffset.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
      newCameraPos = armillaryPos.clone().add(worldCameraOffset);

      // Target at 45° angle up (so you can see both horizon and sky)
      const localTarget = new THREE.Vector3(0, targetRadius * 0.5, targetRadius * 0.5);
      const worldTarget = localTarget.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
      targetWorldPos.copy(armillaryPos).add(worldTarget);

      // Camera up perpendicular to horizon plane
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

      // Align camera up with ecliptic north (+Z in zodiac group's local space)
      const zodiacWorldQuaternion = new THREE.Quaternion();
      this.sceneRef.zodiacGroup.getWorldQuaternion(zodiacWorldQuaternion);
      const localUp = new THREE.Vector3(0, 0, 1); // Ecliptic north pole
      newUp = localUp.applyQuaternion(zodiacWorldQuaternion);
    }

    if (skipAnimation) {
      // Immediate update without animation (for planet zoom changes)
      camera.position.copy(newCameraPos);
      this.controls.target.copy(targetWorldPos);
      camera.up.copy(newUp);
      camera.lookAt(this.controls.target);
      this.controls.update();
    } else {
      // Smoothly animate camera
      const startPos = camera.position.clone();
      const startTarget = this.controls.target.clone();
      const startUp = camera.up.clone();
      const duration = 1000; // 1 second
      const startTime = performance.now();

      // Mark zoom animation as in progress and clear zenithViewUpVector so it can be recaptured after zoom
      this.isZoomAnimating = true;
      if (targetName === 'zenith' || targetName === 'horizon') {
        this.sceneRef.zenithViewUpVector = null;
      }

      // Disable controls during animation to prevent conflict
      this.controls.enabled = false;

      const animateCamera = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in-out function
        const eased = progress < 0.5
          ? 2 * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // For horizon/zenith zoom, dynamically track armillaryRoot position and orientation
        // to handle cases where Earth moves or time advances while zooming
        let currentTargetPos = targetWorldPos;
        let currentCameraPos = newCameraPos;
        let currentUp = newUp;

        if (targetName === 'horizon') {
          currentTargetPos = new THREE.Vector3();
          this.sceneRef.armillaryRoot.getWorldPosition(currentTargetPos);

          // Recalculate camera position based on current armillary orientation
          const localOffset = new THREE.Vector3(0, targetRadius * 2.0, targetRadius * 6.0);
          const worldOffset = localOffset.clone().applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
          currentCameraPos = currentTargetPos.clone().add(worldOffset);

          // Recalculate up vector to stay aligned with current horizon orientation
          const localUp = new THREE.Vector3(0, 1, 0);
          currentUp = localUp.clone().applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
        } else if (targetName === 'zenith') {
          const armillaryPos = new THREE.Vector3();
          this.sceneRef.armillaryRoot.getWorldPosition(armillaryPos);

          // Camera slightly above the horizon plane
          const localCameraOffset = new THREE.Vector3(0, targetRadius * 0.02, 0);
          const worldCameraOffset = localCameraOffset.clone().applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
          currentCameraPos = armillaryPos.clone().add(worldCameraOffset);

          // Target at 45° angle up
          const localTarget = new THREE.Vector3(0, targetRadius * 0.5, targetRadius * 0.5);
          const worldTarget = localTarget.clone().applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
          currentTargetPos = armillaryPos.clone().add(worldTarget);

          // Recalculate up vector to stay aligned with current horizon orientation
          const localUp = new THREE.Vector3(0, 1, 0);
          currentUp = localUp.clone().applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
        }

        // Interpolate position
        camera.position.lerpVectors(startPos, currentCameraPos, eased);

        // Interpolate target
        this.controls.target.lerpVectors(startTarget, currentTargetPos, eased);

        // Interpolate up vector using quaternion slerp for smooth rotation without tilting
        // Convert up vectors to quaternions for proper spherical interpolation
        const startQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          startUp.clone().normalize()
        );
        const currentQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          currentUp.clone().normalize()
        );
        const interpQuat = new THREE.Quaternion().slerpQuaternions(startQuat, currentQuat, eased);
        camera.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(interpQuat));

        // Ensure camera looks at target during transition
        camera.lookAt(this.controls.target);

        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          // Animation complete
          this.isZoomAnimating = false;

          // For zenith zoom, capture the final camera.up as zenithViewUpVector to ensure continuity
          if (targetName === 'zenith') {
            this.sceneRef.zenithViewUpVector = camera.up.clone();
          }

          this.controls.enabled = true;
          this.controls.update();
        }
      };

      animateCamera();
    }
  }

  updateForPlanetZoom() {
    // Re-zoom to current target if one is set (for dynamic planet zoom updates)
    if (this.currentZoomTarget) {
      this.zoomToTarget(this.currentZoomTarget, true); // Skip animation for smooth updates
    }
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
    // Don't control constellation lines here - they're controlled by constellation mode
    if (this.sceneRef.milkyWayMesh) {
      this.sceneRef.milkyWayMesh.visible = visible;
    }
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

    // Update sky atmosphere opacity (inverse of Earth - visible when close, fades when far)
    this.updateSkyAtmosphereVisibility();

    // Update horizon elements visibility (fade out when very close for zenith view)
    this.updateHorizonElementsVisibility();
  }

  updateSkyAtmosphereVisibility() {
    if (!this.sceneRef.skyAtmosphere || !this.sceneRef.armillaryRoot) return;

    const distToObserver = this.camera.position.distanceTo(this.sceneRef.armillaryRoot.position);

    // Sky atmosphere should be visible in horizon view (close to observer)
    // and fade out as we zoom out to Earth view
    // Inverse of Earth visibility: opaque when close, transparent when far
    const minVal = 0.0;
    const maxVal = 1.0;
    // Use VIEW_MODE_THRESHOLD as the transition point
    const minRange = this.sceneRef.VIEW_MODE_THRESHOLD * 0.3; // Start fading at 30% of threshold
    const maxRange = this.sceneRef.VIEW_MODE_THRESHOLD * 0.8; // Fully faded at 80% of threshold

    let opacity = 1.0;
    if (distToObserver < minRange) {
      opacity = maxVal; // Fully visible when very close (horizon view)
    } else if (distToObserver > maxRange) {
      opacity = minVal; // Fully transparent when far (Earth view)
    } else {
      const t = (distToObserver - minRange) / (maxRange - minRange);
      opacity = maxVal - t * (maxVal - minVal); // Fade out as distance increases
    }

    this.sceneRef.skyAtmosphere.setOpacity(opacity);
  }

  updateHorizonElementsVisibility() {
    if (!this.sceneRef.armillaryRoot) return;

    const distToObserver = this.camera.position.distanceTo(this.sceneRef.armillaryRoot.position);

    // Horizon elements fade out as camera approaches zenith view
    const sphereRadius = this.sceneRef.SPHERE_RADIUS;

    // Start fading at 1.5x sphere radius, fully faded at 0.9x sphere radius
    const fadeStartDistance = sphereRadius * 1.5;
    const fadeEndDistance = sphereRadius * 0.9;

    let opacity = 1.0;
    if (distToObserver < fadeEndDistance) {
      opacity = 0.0; // Fully transparent (zenith view)
    } else if (distToObserver > fadeStartDistance) {
      opacity = 1.0; // Fully visible (normal view)
    } else {
      // Smooth fade between fadeEnd and fadeStart
      const t = (distToObserver - fadeEndDistance) / (fadeStartDistance - fadeEndDistance);
      opacity = t; // Linear fade from 0 to 1
    }

    // Apply opacity to horizon elements
    this.sceneRef.setHorizonElementsOpacity(opacity);
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
