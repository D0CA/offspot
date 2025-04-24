export const mapConfig = {
  backgroundUrl: '/maps/background-hole.png',
    width: 3640,
    height: 2048,
  
    walkableArea: {
      minX: 300,
      maxX: 3350,
      minY: 1300,
      maxY: 1720,
    },
  
    get spawn() {
      const { minX, maxX, minY, maxY } = this.walkableArea
      return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      }
    },
  
    SHOW_DEBUG: false // ← active/désactive les overlays de debug
  }
  