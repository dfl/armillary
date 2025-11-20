// interactions.js - User interaction handling (hover, double-click, context menu)

import * as THREE from 'three';

/**
 * InteractionManager class handles all user interactions with the 3D scene.
 *
 * This includes:
 * - Star hover tooltips
 * - Planet double-click zoom
 * - Context menu for zoom targets
 * - Tooltip positioning
 */
export default class InteractionManager {
  constructor(camera, leftCamera, rightCamera, renderer, sceneRef) {
    this.camera = camera;
    this.leftCamera = leftCamera;
    this.rightCamera = rightCamera;
    this.renderer = renderer;
    this.sceneRef = sceneRef;

    // Setup all interactions
    this.setupStarHover();
    this.setupPlanetDoubleClick();
    this.setupContextMenu();
  }

  setupStarHover() {
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0.05; // Make line detection more precise
    const mouse = new THREE.Vector2();

    const onStarHover = (event) => {
      let camera, mouseX, mouseY;

      if (this.sceneRef.cameraController && this.sceneRef.cameraController.stereoEnabled) {
        // In stereo mode, determine which viewport (left or right) the mouse is in
        const halfWidth = window.innerWidth / 2;
        if (event.clientX < halfWidth) {
          // Left viewport
          camera = this.rightCamera; // Swapped for cross-eyed
          mouseX = (event.clientX / halfWidth) * 2 - 1;
        } else {
          // Right viewport
          camera = this.leftCamera; // Swapped for cross-eyed
          mouseX = ((event.clientX - halfWidth) / halfWidth) * 2 - 1;
        }
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      } else {
        // Normal single viewport
        camera = this.camera;
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      }

      mouse.x = mouseX;
      mouse.y = mouseY;

      raycaster.setFromCamera(mouse, camera);

      // Build a list of all potential targets to raycast against
      // We'll collect ALL objects and then intersect them all at once to get proper depth sorting
      const allTargets = [];

      // Add all celestial objects with their metadata
      // Stars
      this.sceneRef.starGroup.children.forEach(star => {
        allTargets.push({ obj: star, type: 'star', meta: star });
      });

      // Ecliptic Sun
      this.sceneRef.eclipticSunGroup.children.forEach(child => {
        allTargets.push({ obj: child, type: 'sun', meta: null });
      });

      // Realistic Sun
      this.sceneRef.realisticSunGroup.children.forEach(child => {
        allTargets.push({ obj: child, type: 'sun', meta: null });
      });

      // Ecliptic Moon
      this.sceneRef.eclipticMoonGroup.children.forEach(child => {
        allTargets.push({ obj: child, type: 'moon', meta: null });
      });

      // Realistic Moon
      this.sceneRef.realisticMoonGroup.children.forEach(child => {
        allTargets.push({ obj: child, type: 'moon', meta: null });
      });

      // Earth
      if (this.sceneRef.earthGroup) {
        this.sceneRef.earthGroup.children.forEach(child => {
          allTargets.push({ obj: child, type: 'earth', meta: null });
        });
      }

      // Ecliptic planets
      if (this.sceneRef.eclipticPlanetGroups) {
        Object.entries(this.sceneRef.eclipticPlanetGroups).forEach(([name, planetData]) => {
          planetData.group.children.forEach(child => {
            allTargets.push({ obj: child, type: 'ecliptic-planet', meta: name });
          });
        });
      }

      // Heliocentric planets
      Object.entries(this.sceneRef.planetGroups).forEach(([name, planetData]) => {
        planetData.group.children.forEach(child => {
          allTargets.push({ obj: child, type: 'heliocentric-planet', meta: name });
        });
      });

      // Angles
      [
        this.sceneRef.spheres?.MC,
        this.sceneRef.spheres?.IC,
        this.sceneRef.spheres?.ASC,
        this.sceneRef.spheres?.DSC,
        this.sceneRef.spheres?.VTX,
        this.sceneRef.spheres?.AVX,
        this.sceneRef.angleLabels?.MC,
        this.sceneRef.angleLabels?.IC,
        this.sceneRef.angleLabels?.ASC,
        this.sceneRef.angleLabels?.DSC,
        this.sceneRef.angleLabels?.VTX,
        this.sceneRef.angleLabels?.AVX
      ].forEach(obj => {
        if (obj) allTargets.push({ obj, type: 'angle', meta: obj });
      });

      // Reference circles
      [
        this.sceneRef.horizonOutline,
        this.sceneRef.meridianOutline,
        this.sceneRef.primeVerticalOutline,
        this.sceneRef.celestialEquatorOutline,
        this.sceneRef.outerEclipticLine
      ].forEach(obj => {
        if (obj) allTargets.push({ obj, type: 'circle', meta: obj });
      });

      // Poles
      [
        this.sceneRef.poleLabels?.NP,
        this.sceneRef.poleLabels?.SP
      ].forEach(obj => {
        if (obj) allTargets.push({ obj, type: 'pole', meta: obj });
      });

      // Perform single raycast against all objects
      const allIntersects = raycaster.intersectObjects(allTargets.map(t => t.obj), false);

      // Create a map from object to target info for fast lookup
      const objToTarget = new Map();
      allTargets.forEach(target => {
        objToTarget.set(target.obj, target);
      });

      const starInfoElement = document.getElementById('starInfo');

      if (!starInfoElement) {
        console.error('starInfo element not found!');
        return;
      }

      // Check if Earth is visible enough to show tooltip
      const earthOpacity = this.sceneRef.earthMesh?.material?.uniforms?.opacity?.value || 0;

      // Size hierarchy (smaller = higher priority when overlapping)
      const objectSizes = {
        'ecliptic-planet': 1,  // Smallest: 0.06 * CE_RADIUS
        'moon': 2,             // Medium: 0.09 * CE_RADIUS
        'sun': 3,              // Largest: 0.12 * CE_RADIUS
        'earth': 2,            // Similar to moon
        'heliocentric-planet': 1, // Same as ecliptic planets
        'angle': 0.5,          // Even smaller
        'circle': 0,           // Lines
        'pole': 0.5,           // Small
        'star': 0.1            // Very small
      };

      // Process all intersections and build candidates
      const candidates = [];

      allIntersects.forEach(intersection => {
        const target = objToTarget.get(intersection.object);
        if (!target) return;

        const { type, meta } = target;

        // Skip earth if not visible enough
        if (type === 'earth' && earthOpacity <= 0.1) return;

        // Skip stars without proper metadata
        if (type === 'star' && (!meta.userData.name || !meta.userData.constellation)) return;

        const candidate = {
          type,
          distance: intersection.distance,
          size: objectSizes[type] || 1,
          object: intersection.object
        };

        // Add type-specific metadata
        if (type === 'ecliptic-planet' || type === 'heliocentric-planet') {
          candidate.name = meta;
        } else if (type === 'star') {
          candidate.starData = meta.userData;
        } else if (type === 'angle' || type === 'circle' || type === 'pole') {
          candidate.objectData = meta;
        }

        candidates.push(candidate);
      });

      // Sort by size first (smaller = higher priority), then by distance
      // This ensures smaller objects inside larger ones are detected
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          // If distance difference is very small (within 20% of CE_RADIUS), prioritize smaller object
          const distanceDiff = Math.abs(a.distance - b.distance);
          const overlapThreshold = this.sceneRef.CE_RADIUS * 0.2;

          if (distanceDiff < overlapThreshold) {
            // Objects are close/overlapping - prefer smaller object
            return a.size - b.size;
          }
          // Objects are well separated - prefer closer object
          return a.distance - b.distance;
        });
        const closest = candidates[0];

        const planetSymbols = {
          mercury: '☿', venus: '♀', mars: '♂', jupiter: '♃',
          saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇'
        };
        const planetFullNames = {
          mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter',
          saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto'
        };

        if (closest.type === 'sun') {
          document.getElementById('starName').textContent = `☉ Sun ${this.sceneRef.sunZodiacPosition}`;
          document.getElementById('constellationName').textContent = `Star`;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'moon') {
          document.getElementById('starName').textContent = `☽ Moon ${this.sceneRef.moonZodiacPosition}`;
          document.getElementById('constellationName').textContent = `${this.sceneRef.lunarPhase.phase} (${this.sceneRef.lunarPhase.illumination}% lit)`;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'earth') {
          document.getElementById('starName').textContent = `⊕ Earth`;
          document.getElementById('constellationName').textContent = `Planet`;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'ecliptic-planet') {
          const symbol = planetSymbols[closest.name] || closest.name;
          const fullName = planetFullNames[closest.name] || closest.name;
          const position = this.sceneRef.planetZodiacPositions[closest.name] || '';
          document.getElementById('starName').textContent = `${symbol} ${fullName} ${position}`;
          document.getElementById('constellationName').textContent = `Planet`;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'heliocentric-planet') {
          const symbol = planetSymbols[closest.name] || closest.name;
          const fullName = planetFullNames[closest.name] || closest.name;
          const position = this.sceneRef.planetZodiacPositions[closest.name] || '';
          document.getElementById('starName').textContent = `${symbol} ${fullName} ${position}`;
          document.getElementById('constellationName').textContent = `Planet`;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'angle') {
          const angleName = closest.objectData.userData.angleName;
          const fullNames = {
            MC: "Midheaven", IC: "Imum Coeli", ASC: "Ascendant",
            DSC: "Descendant", VTX: "Vertex", AVX: "Antivertex"
          };
          document.getElementById('starName').textContent = `${angleName} ${this.sceneRef.anglePositions[angleName]}`;
          document.getElementById('constellationName').textContent = fullNames[angleName];
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'circle') {
          const circleName = closest.objectData.userData.circleName;
          const descriptions = {
            "Horizon": "Observer's local horizon plane",
            "Meridian": "North-South great circle through zenith",
            "Prime Vertical": "East-West great circle through zenith",
            "Celestial Equator": "Projection of Earth's equator onto celestial sphere",
            "Ecliptic": "Path of the Sun through the zodiac constellations"
          };
          document.getElementById('starName').textContent = circleName;
          document.getElementById('constellationName').textContent = descriptions[circleName];
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'pole') {
          const poleName = closest.objectData.userData.poleName;
          const descriptions = { "NP": "North Celestial Pole", "SP": "South Celestial Pole" };
          document.getElementById('starName').textContent = poleName;
          document.getElementById('constellationName').textContent = descriptions[poleName];
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        else if (closest.type === 'star') {
          document.getElementById('starName').textContent = closest.starData.name;
          document.getElementById('constellationName').textContent = closest.starData.constellation;
          this.positionTooltip(starInfoElement, event);
          this.renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        starInfoElement.classList.remove('visible');
        this.renderer.domElement.style.cursor = 'default';
      }
    };

    this.renderer.domElement.addEventListener('mousemove', onStarHover);
  }

  setupPlanetDoubleClick() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onDoubleClick = (event) => {
      let camera, mouseX, mouseY;

      if (this.sceneRef.cameraController && this.sceneRef.cameraController.stereoEnabled) {
        const halfWidth = window.innerWidth / 2;
        if (event.clientX < halfWidth) {
          camera = this.rightCamera;
          mouseX = (event.clientX / halfWidth) * 2 - 1;
        } else {
          camera = this.leftCamera;
          mouseX = ((event.clientX - halfWidth) / halfWidth) * 2 - 1;
        }
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      } else {
        camera = this.camera;
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
      }

      mouse.x = mouseX;
      mouse.y = mouseY;

      raycaster.setFromCamera(mouse, camera);

      // Check all planet groups
      const planetIntersects = [];
      Object.entries(this.sceneRef.planetGroups).forEach(([name, planetData]) => {
        const intersects = raycaster.intersectObjects(planetData.group.children, false);
        if (intersects.length > 0) {
          planetIntersects.push({ name, planetData, intersects });
        }
      });

      // Check realistic sun
      const sunIntersects = raycaster.intersectObjects(this.sceneRef.realisticSunGroup.children, false);

      // Check realistic moon
      const moonIntersects = raycaster.intersectObjects(this.sceneRef.realisticMoonGroup.children, false);

      // Check Earth
      const earthIntersects = this.sceneRef.earthGroup ? raycaster.intersectObjects(this.sceneRef.earthGroup.children, false) : [];

      // Check horizon plane
      const horizonIntersects = this.sceneRef.horizonPlane ? raycaster.intersectObject(this.sceneRef.horizonPlane, false) : [];

      let targetObject = null;
      let targetRadius = null;
      let targetWorldPos = new THREE.Vector3();

      if (horizonIntersects.length > 0) {
        this.sceneRef.armillaryRoot.getWorldPosition(targetWorldPos);
        targetRadius = this.sceneRef.CE_RADIUS;
        targetObject = 'horizon';
      } else if (planetIntersects.length > 0) {
        const planet = planetIntersects[0];
        planet.planetData.group.getWorldPosition(targetWorldPos);
        // Account for planet scale when calculating zoom distance
        const geometryRadius = planet.planetData.mesh.geometry.parameters.radius;
        const currentScale = planet.planetData.group.scale.x;
        targetRadius = geometryRadius * currentScale;
        targetObject = 'planet';
      } else if (sunIntersects.length > 0) {
        this.sceneRef.realisticSunGroup.getWorldPosition(targetWorldPos);
        targetRadius = this.sceneRef.realisticSunMesh.geometry.parameters.radius;
        targetObject = 'sun';
      } else if (earthIntersects.length > 0) {
        this.sceneRef.earthGroup.getWorldPosition(targetWorldPos);
        targetRadius = this.sceneRef.EARTH_RADIUS;
        targetObject = 'earth';
      } else if (moonIntersects.length > 0) {
        this.sceneRef.realisticMoonGroup.getWorldPosition(targetWorldPos);
        targetRadius = this.sceneRef.realisticMoonMesh.geometry.parameters.radius;
        targetObject = 'moon';
      }

      if (targetObject) {
        // Calculate camera position (offset from target)
        let newCameraPos;
        let newUp = new THREE.Vector3(0, 1, 0); // Default to world up

        if (targetObject === 'horizon') {
          // Orient facing North (Local +Z) from South (Local -Z)
          // Position camera at South (-Z) and slightly Up (+Y)
          const localOffset = new THREE.Vector3(0, targetRadius * 2.0, -targetRadius * 6.0);

          // Transform to world space
          const worldOffset = localOffset.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
          newCameraPos = targetWorldPos.clone().add(worldOffset);

          // Align camera up with local up
          const localUp = new THREE.Vector3(0, 1, 0);
          newUp = localUp.applyQuaternion(this.sceneRef.armillaryRoot.quaternion);
        } else {
          // Use a smaller multiplier for better planet viewing (fills ~1/2 screen)
          const zoomDistance = targetRadius * 4; // Distance from surface

          // Get direction from target to current camera
          const direction = camera.position.clone().sub(targetWorldPos).normalize();

          // Calculate new camera position
          newCameraPos = targetWorldPos.clone().add(direction.multiplyScalar(zoomDistance));
        }

        // Smoothly animate camera
        const startPos = camera.position.clone();
        const startTarget = this.sceneRef.controls.target.clone();
        const startUp = camera.up.clone();
        const duration = 1000; // 1 second
        const startTime = performance.now();

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
          this.sceneRef.controls.target.lerpVectors(startTarget, targetWorldPos, eased);

          // Interpolate up vector
          camera.up.lerpVectors(startUp, newUp, eased).normalize();

          // Ensure camera looks at target during transition
          camera.lookAt(this.sceneRef.controls.target);

          if (progress < 1) {
            requestAnimationFrame(animateCamera);
          }
        };

        animateCamera();
      }
    };

    this.renderer.domElement.addEventListener('dblclick', onDoubleClick);
  }

  setupContextMenu() {
    const contextMenu = document.getElementById('contextMenu');

    // Add Horizon and Earth options if they don't exist
    if (!contextMenu.querySelector('[data-target="horizon"]')) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.setAttribute('data-target', 'horizon');
      item.textContent = 'Zoom to Horizon';
      contextMenu.insertBefore(item, contextMenu.firstChild);
    }
    if (!contextMenu.querySelector('[data-target="earth"]')) {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.setAttribute('data-target', 'earth');
      item.textContent = 'Zoom to Earth';
      contextMenu.insertBefore(item, contextMenu.firstChild);
    }

    const menuItems = contextMenu.querySelectorAll('.context-menu-item');

    // Function to update menu items visibility based on planets toggle
    const updateMenuVisibility = () => {
      const planetsToggle = document.getElementById('planetsToggle');
      const planetsVisible = planetsToggle ? planetsToggle.checked : true;

      // List of planet-related targets (sun, moon, and planets)
      const planetTargets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ecliptic-north'];

      menuItems.forEach(item => {
        const target = item.getAttribute('data-target');
        if (planetTargets.includes(target)) {
          item.style.display = planetsVisible ? 'block' : 'none';
        }
      });
    };

    // Listen for planets toggle changes
    const planetsToggle = document.getElementById('planetsToggle');
    if (planetsToggle) {
      planetsToggle.addEventListener('change', updateMenuVisibility);
    }

    // Show context menu on right-click
    this.renderer.domElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation(); // Prevent browser extensions from interfering

      // Update menu visibility before showing
      updateMenuVisibility();

      // Position menu at mouse location with boundary checking
      contextMenu.classList.add('visible');
      const rect = contextMenu.getBoundingClientRect();

      let left = event.clientX;
      let top = event.clientY;

      // Check right boundary
      if (left + rect.width > window.innerWidth) {
        left = window.innerWidth - rect.width - 5;
      }

      // Check bottom boundary
      if (top + rect.height > window.innerHeight) {
        top = window.innerHeight - rect.height - 5;
      }

      // Ensure menu doesn't go off left edge
      if (left < 5) {
        left = 5;
      }

      // Ensure menu doesn't go off top edge
      if (top < 5) {
        top = 5;
      }

      contextMenu.style.left = left + 'px';
      contextMenu.style.top = top + 'px';
    }, true); // Use capture phase to intercept before extensions

    // Hide context menu on click outside
    document.addEventListener('click', (event) => {
      if (!contextMenu.contains(event.target)) {
        contextMenu.classList.remove('visible');
      }
    });

    // Handle menu item clicks
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        // Call zoomToTarget method on sceneRef
        if (this.sceneRef.zoomToTarget) {
          this.sceneRef.zoomToTarget(target);
        }
        contextMenu.classList.remove('visible');
      });
    });

    // Hide context menu on escape key
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        contextMenu.classList.remove('visible');
      }
    });
  }

  positionTooltip(tooltipElement, event) {
    // Position tooltip near mouse with boundary checking
    const offset = 15; // Distance from cursor
    const padding = 10; // Padding from screen edges

    // Get tooltip dimensions (need to make it visible first to measure)
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.classList.add('visible');
    const rect = tooltipElement.getBoundingClientRect();
    tooltipElement.style.visibility = '';

    let left = event.clientX + offset;
    let top = event.clientY + offset;

    // Check right boundary
    if (left + rect.width > window.innerWidth - padding) {
      left = event.clientX - rect.width - offset;
    }

    // Check bottom boundary
    if (top + rect.height > window.innerHeight - padding) {
      top = event.clientY - rect.height - offset;
    }

    // Check left boundary
    if (left < padding) {
      left = padding;
    }

    // Check top boundary
    if (top < padding) {
      top = padding;
    }

    tooltipElement.style.left = left + 'px';
    tooltipElement.style.top = top + 'px';
  }
}
