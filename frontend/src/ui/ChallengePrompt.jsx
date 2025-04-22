import React from 'react'
import './ChallengePrompt.css'

export default function ChallengePrompt({ challenger, game, onAccept, onDecline }) {
  console.log('[RENDER] ChallengePrompt', challenger, game)

  if (!challenger || !game) {
    console.warn('[BLOCKED] ChallengePrompt non monté :', challenger, game)
    return null
  }

  return (
    <div className="challenge-prompt">
      <div className="challenge-box">
        <p><strong>{challenger}</strong> te défie au jeu <strong>{game}</strong></p>
        <p style={{ color: 'red', fontWeight: 'bold' }}>✅ Je suis visible</p>
        <div className="challenge-buttons">
          <button className="accept" onClick={onAccept}>✔</button>
          <button className="decline" onClick={onDecline}>✖</button>
        </div>
      </div>
    </div>
  )
}