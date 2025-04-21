// src/utils/mathUtils.js
/**
 * Clamp a value between min and max.
 */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  
  /**
   * Compute local coordinates within the game world.
   */
  export function computeLocalCoords(globalX, globalY, cameraX, cameraY, scale) {
    return {
      x: (globalX - cameraX) / scale,
      y: (globalY - cameraY) / scale,
    };
  }