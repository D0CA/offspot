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

/**
 * Clamp the camera position to prevent showing out-of-bounds area
 * even if the map is smaller than the screen.
 */
export function clampCameraToMap(cam, mapWidth, mapHeight, screenWidth, screenHeight) {
  const scale = cam.scale.x;
  const scaledMapWidth = mapWidth * scale;
  const scaledMapHeight = mapHeight * scale;

  const maxX = 0;
  const minX = screenWidth - scaledMapWidth;
  const maxY = 0;
  const minY = screenHeight - scaledMapHeight;

  cam.x = clamp(cam.x, Math.min(minX, maxX), Math.max(minX, maxX));
  cam.y = clamp(cam.y, Math.min(minY, maxY), Math.max(minY, maxY));
} 