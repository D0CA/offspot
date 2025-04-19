// src/utils/leveling.js

export function computeLevelFromXP(totalXP) {
    let level = 1
    let required = 100
    let xp = totalXP
  
    while (xp >= required) {
      xp -= required
      level++
      required = 100 + (level - 1) * 20
    }
  
    return {
      level,
      currentLevelXP: xp,
      xpRequired: required,
      percent: (xp / required) * 100,
    }
  }
  