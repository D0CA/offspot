// frontend/src/constants/gamesConfig.js

export const SPEED = 3;

// Clés de jeux doivent correspondre aux types de challenge côté serveur
export const GAMES = {
  morpion: {
    name: 'Morpion',
    icon: '✖️⭕',
    component: 'MorpionModal'
  },
  puissance4: {
    name: 'Puissance 4',
    icon: '🔴🟡',
    component: 'Puissance4Modal'
  },
  typingRace: {
    name: 'Typing Race',
    icon: '⌨️🏎️',
    component: 'TypingRaceModal'
  }
};
