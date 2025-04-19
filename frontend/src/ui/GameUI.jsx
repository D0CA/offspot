import React, { useEffect, useRef, useState } from 'react'
import { computeLevelFromXP } from '../utils/leveling'
import './GameUI.css'
import { usePlayer } from '../context/PlayerContext'

export default function GameUI({
  avatar,
  username,
  playerCount,
  onLogout
}) {
  const { myXP, myLevel, currentXP, xpRequired } = usePlayer()

  const level = myLevel
  const currentLevelXP = currentXP
  const xpRequiredFinal = xpRequired  

  const xpBarRef = useRef(null)
  const xpFillRef = useRef(null)
  const [previousLevel, setPreviousLevel] = useState(level)

  useEffect(() => {
    if (previousLevel !== null && level > previousLevel) {
      if (xpBarRef.current) {
        xpBarRef.current.classList.remove('flash')
        void xpBarRef.current.offsetWidth // force reflow
        xpBarRef.current.classList.add('flash')
      }

      if (xpFillRef.current) {
        xpFillRef.current.classList.remove('rainbow')
        void xpFillRef.current.offsetWidth // force reflow
        xpFillRef.current.classList.add('rainbow')
      }

      const tag = document.createElement('div')
      tag.className = 'level-up-popup'
      tag.innerText = `Niveau ${level} !`
      document.body.appendChild(tag)
      setTimeout(() => tag.remove(), 1500)
    }
    setPreviousLevel(level)
  }, [level])

  useEffect(() => {
    if (xpFillRef.current) {
      xpFillRef.current.style.transition = 'width 0.5s ease'
      xpFillRef.current.style.width = `${(currentLevelXP / xpRequiredFinal) * 100}%`
    }
  }, [currentLevelXP, xpRequiredFinal])

  return (
    <div className="game-ui">
      <div className="user-info">
        <img src={avatar} alt="avatar" className="avatar" />
        <div className="username-block">
          <div className="username">{username}</div>
          <div className="level">Niveau {level}</div>
          <div className="xp-bar-container">
            <div className="xp-bar" ref={xpBarRef}>
              <div className="xp-fill" ref={xpFillRef} />
            </div>
            <div className="xp-labels">
              <span>{currentLevelXP} / {xpRequiredFinal} XP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="spacer" />

      <div className="stats">
        <span className="player-count">{playerCount} en ligne</span>
        <button className="logout-button" onClick={onLogout}>
          Déconnexion
        </button>
      </div>
    </div>
  )
}
