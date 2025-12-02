// config.js - Scene constants and configuration

/**
 * Scene Configuration
 * Centralized constants for the armillary sphere visualization
 */
export class SceneConfig {
  constructor() {
    // ===================================================================
    // Astronomical Constants
    // ===================================================================
    this.obliquity = 23.44 * Math.PI / 180; // Will be recalculated precisely
    this.planetZoomFactor = 1.0; // 0 = accurate, 1.0 = max zoom (default)
    this.targetCameraDistance = null; // When set, updateSphere will enforce this distance

    // ===================================================================
    // Physical Scale Constants
    // ===================================================================
    // Real radii: Earth 6371km, Moon 1737km, Sun 696000km
    // Real distances: Moon ~384400km from Earth, Earth 1 AU from Sun
    this.EARTH_RADIUS_KM = 6371;
    this.MOON_RADIUS_KM = 1737;
    this.SUN_RADIUS_KM = 696000;
    this.MOON_DISTANCE_KM = 384400;

    // ===================================================================
    // Visualization Scale Constants
    // ===================================================================
    this.PLANET_RADIUS_SCALE = 0.05; // Scale factor to make all bodies visible but not overwhelming
    this.EARTH_RADIUS = 100.0 * this.PLANET_RADIUS_SCALE; // Earth's radius scaled consistently with other planets
    this.CE_RADIUS = this.EARTH_RADIUS * 0.02; // Celestial sphere radius (local horizon visualization scale, 2% of Earth radius)
    this.SPHERE_RADIUS = this.CE_RADIUS * 1.6; // Radius of horizon circle and sky dome
    this.PLANET_DISTANCE_SCALE = 2000; // Scale factor for planet orbital distances (1 AU = 2000 units)
    this.STAR_FIELD_RADIUS = this.PLANET_DISTANCE_SCALE * 200; // Star field radius (encompassing solar system)

    // ===================================================================
    // View Mode Constants
    // ===================================================================
    // View mode threshold: distance at which we switch from Horizon View to Earth View
    // Threshold: 50 units (Earth radius is 5.0, Horizon view camera is ~15 units away)
    this.VIEW_MODE_THRESHOLD = 50.0;

    // ===================================================================
    // Calculated Radii
    // ===================================================================
    // Calculate proportional radii (scaled down for visibility)
    this.SUN_RADIUS = this.EARTH_RADIUS * (this.SUN_RADIUS_KM / this.EARTH_RADIUS_KM) * 0.05; // ~109x Earth, scaled
    this.MOON_RADIUS = this.EARTH_RADIUS * (this.MOON_RADIUS_KM / this.EARTH_RADIUS_KM); // ~27.3% Earth
    this.MOON_DISTANCE = 300; // Moon distance from Earth (scaled for visibility, not to scale with radii)

    // ===================================================================
    // Texture Paths
    // ===================================================================
    this.EARTH_TEXTURE_PATH = '/armillary/images/earth_texture.jpg';
    this.EARTH_NIGHT_TEXTURE_PATH = '/armillary/images/earth_texture_night.jpg';
    this.SUN_TEXTURE_PATH = '/armillary/images/sun_texture.jpg';
    this.REALISTIC_SUN_TEXTURE_PATH = '/armillary/images/sun_texture_orange.jpg';
    this.MOON_TEXTURE_PATH = '/armillary/images/moon_texture.jpg';
    this.MOON_BUMP_TEXTURE_PATH = '/armillary/images/moon_texture_bump.jpg';
    this.MERCURY_TEXTURE_PATH = '/armillary/images/mercury_texture.jpg';
    this.VENUS_TEXTURE_PATH = '/armillary/images/venus_texture.jpg';
    this.MARS_TEXTURE_PATH = '/armillary/images/mars_texture.jpg';
    this.JUPITER_TEXTURE_PATH = '/armillary/images/jupiter_texture.jpg';
    this.SATURN_TEXTURE_PATH = '/armillary/images/saturn_texture.jpg';
    this.SATURN_RINGS_TEXTURE_PATH = '/armillary/images/saturn_ring_color.jpg';
    this.SATURN_RINGS_ALPHA_PATH = '/armillary/images/saturn_ring_alpha.gif';
    this.URANUS_TEXTURE_PATH = '/armillary/images/uranus_texture.jpg';
    this.NEPTUNE_TEXTURE_PATH = '/armillary/images/neptune_texture.jpg';
    this.PLUTO_TEXTURE_PATH = '/armillary/images/pluto_texture.jpg';

    // ===================================================================
    // Camera Configuration
    // ===================================================================
    this.CAMERA_FOV = 60;
    this.CAMERA_NEAR = 0.1;
    this.CAMERA_FAR = 500000;
  }

  /**
   * Get all constants needed for CelestialObjects module
   */
  getCelestialConstants() {
    return {
      CE_RADIUS: this.CE_RADIUS,
      EARTH_RADIUS: this.EARTH_RADIUS,
      SUN_RADIUS: this.SUN_RADIUS,
      MOON_RADIUS: this.MOON_RADIUS,
      MOON_DISTANCE: this.MOON_DISTANCE,
      STAR_FIELD_RADIUS: this.STAR_FIELD_RADIUS,
      PLANET_RADIUS_SCALE: this.PLANET_RADIUS_SCALE,
      PLANET_DISTANCE_SCALE: this.PLANET_DISTANCE_SCALE
    };
  }

  /**
   * Get all texture paths
   */
  getTexturePaths() {
    return {
      EARTH_TEXTURE_PATH: this.EARTH_TEXTURE_PATH,
      EARTH_NIGHT_TEXTURE_PATH: this.EARTH_NIGHT_TEXTURE_PATH,
      SUN_TEXTURE_PATH: this.SUN_TEXTURE_PATH,
      REALISTIC_SUN_TEXTURE_PATH: this.REALISTIC_SUN_TEXTURE_PATH,
      MOON_TEXTURE_PATH: this.MOON_TEXTURE_PATH,
      MOON_BUMP_TEXTURE_PATH: this.MOON_BUMP_TEXTURE_PATH,
      MERCURY_TEXTURE_PATH: this.MERCURY_TEXTURE_PATH,
      VENUS_TEXTURE_PATH: this.VENUS_TEXTURE_PATH,
      MARS_TEXTURE_PATH: this.MARS_TEXTURE_PATH,
      JUPITER_TEXTURE_PATH: this.JUPITER_TEXTURE_PATH,
      SATURN_TEXTURE_PATH: this.SATURN_TEXTURE_PATH,
      SATURN_RINGS_TEXTURE_PATH: this.SATURN_RINGS_TEXTURE_PATH,
      SATURN_RINGS_ALPHA_PATH: this.SATURN_RINGS_ALPHA_PATH,
      URANUS_TEXTURE_PATH: this.URANUS_TEXTURE_PATH,
      NEPTUNE_TEXTURE_PATH: this.NEPTUNE_TEXTURE_PATH,
      PLUTO_TEXTURE_PATH: this.PLUTO_TEXTURE_PATH
    };
  }
}

export default SceneConfig;
