import React from 'react'
import './ChallengePrompt.css'

export default function ChallengePrompt({ challenger, game, onAccept, onDecline }) {

  if (!challenger || !game) {
    console.warn('[BLOCKED] ChallengePrompt non monté :', challenger, game)
    return null
  }

  return (
    <div className="challenge-prompt">
      <div className="challenge-box">
        <p><strong>{challenger}</strong> te défie au jeu <strong>{game}</strong></p>
        <div className="challenge-buttons">
          <button className="accept" onClick={onAccept}>✔</button>
          <button className="decline" onClick={onDecline}>✖</button>
        </div>
      </div>
    </div>
  )
}