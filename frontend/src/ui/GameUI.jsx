import React, { useEffect, useRef, useState } from 'react'
import './GameUI.css'
import { usePlayer } from '../context/PlayerContext'

export default function GameUI({ avatar, username, playerCount, onLogout }) {
  const {
    myXP,
    myLevel,
    currentXP,
    xpRequired,
    playerVersion
  } = usePlayer()

  const xpBarRef = useRef(null)
  const xpFillRef = useRef(null)
  const [previousLevel, setPreviousLevel] = useState(myLevel)

  useEffect(() => {
    if (previousLevel !== null && myLevel > previousLevel) {
      if (xpBarRef.current) {
        xpBarRef.current.classList.remove('flash')
        void xpBarRef.current.offsetWidth
        xpBarRef.current.classList.add('flash')
      }

      if (xpFillRef.current) {
        xpFillRef.current.classList.remove('rainbow')
        void xpFillRef.current.offsetWidth
        xpFillRef.current.classList.add('rainbow')
      }

      const tag = document.createElement('div')
      tag.className = 'level-up-popup'
      tag.innerText = `Niveau ${myLevel} !`
      document.body.appendChild(tag)
      setTimeout(() => tag.remove(), 1500)
    }
    setPreviousLevel(myLevel)
  }, [myLevel])

  useEffect(() => {
    if (xpFillRef.current) {
      xpFillRef.current.style.transition = 'width 0.5s ease, transform 0.4s ease'
      xpFillRef.current.style.width = `${(currentXP / xpRequired) * 100}%`

      xpFillRef.current.classList.remove('xp-glow')
      void xpFillRef.current.offsetWidth
      xpFillRef.current.classList.add('xp-glow')
    }
  }, [currentXP, xpRequired, playerVersion])

  return (
    <div className="game-ui">
      <div className="user-info">
        <img src={avatar} alt="avatar" className="avatar" />
        <div className="username-block">
          <div className="username">{username}</div>
          <div className="level">Niveau {myLevel}</div>
          <div className="xp-bar-container">
            <div className="xp-bar" ref={xpBarRef}>
              <div className="xp-fill" ref={xpFillRef} />
            </div>
            <div className="xp-labels">
              <span>{currentXP} / {xpRequired} XP</span>
            </div>
          </div>
        </div>
      </div>

      <div className="spacer" />

      <div className="stats">
        <span className="player-count">{playerCount} en ligne</span>
        <button className="logout-button" onClick={onLogout}>Déconnexion</button>
      </div>
    </div>
  )
}
