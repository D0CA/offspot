import React from 'react'
import { GAMES } from '../constants/gamesConfig'
import './PlayerCard.css'

export default function PlayerCard({ player, onClose, onChallenge }) {
  if (!player) return null

  return (
    <div className="player-card">
      <div className="card-header">
        <img src={player.avatar} alt="Avatar" className="card-avatar" />
        <div className="card-info">
          <div className="card-username">{player.username}</div>
          <div className="card-level">Niveau {player.level}</div>
        </div>
        <button onClick={onClose} className="card-close">✕</button>
      </div>

      <div className="card-actions">
        <h3>🎮 Défis disponibles</h3>
        {Object.entries(GAMES).map(([key, game]) => (
          <button
            key={key}
            onClick={() => onChallenge(key)}
            className="game-button"
          >
            {game.icon} Défier en {game.name}
          </button>
        ))}
      </div>
    </div>
  )
}