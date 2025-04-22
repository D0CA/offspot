// backend/utils/leveling.js

// Table des déblocages par palier de niveau
const unlocksByLevel = {
  5:  [{ type: 'emote',       id: 'dance'           }],
  10: [{ type: 'cosmetic',    id: 'skin_champetre'  }],
  15: [{ type: 'effect',      id: 'trail_poussiere' }],
  20: [{ type: 'pet',         id: 'animal_chien'    }],
  25: [{ type: 'chatBubble',  id: 'bulle_personnalisee' }],
};

/**
 * Calcule le niveau à partir de l'XP total
 * @param {number} xp - XP cumulée du joueur
 * @returns {{ level: number, currentXP: number, requiredXP: number }}
 */
function computeLevel(xp) {
  let level = 1;
  let requiredXP = 100;
  let remainingXP = xp;

  while (remainingXP >= requiredXP) {
    remainingXP -= requiredXP;
    level++;
    requiredXP = 100 + (level - 1) * 20;
  }

  return { level, currentXP: remainingXP, requiredXP };
}

/**
 * Récupère la liste des déblocages pour un niveau donné
 * @param {number} level - niveau atteint
 * @returns {Array} - tableau de déblocages (type et id)
 */
function getUnlocksForLevel(level) {
  return unlocksByLevel[level] || [];
}

module.exports = { computeLevel, getUnlocksForLevel };
