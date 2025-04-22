// backend/utils/leveling.js
function computeLevel(xp) {
    let level = 1
    let requiredXP = 100
    let remainingXP = xp
  
    while (remainingXP >= requiredXP) {
      remainingXP -= requiredXP
      level++
      requiredXP = 100 + (level - 1) * 20
    }
  
    return { level, requiredXP, currentXP: remainingXP }
  }
  
  module.exports = { computeLevel }
  