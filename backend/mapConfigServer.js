module.exports = {
    walkableArea: {
      minX: 10,
      maxX: 3062,
      minY: 1300,
      maxY: 1720,
    },
    get spawn() {
      const { minX, maxX, minY, maxY } = this.walkableArea
      return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
      }
    }
  }
  