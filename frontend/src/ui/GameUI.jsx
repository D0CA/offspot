import React, { useEffect, useRef, useState } from 'react';
import './GameUI.css';
import { usePlayer } from '../context/PlayerContext';

// ➔ Petite fonction pour afficher un toast
function showToast(message) {
  const tag = document.createElement('div');
  tag.className = 'player-join-toast';
  tag.innerText = message;
  document.body.appendChild(tag);
  setTimeout(() => tag.remove(), 3000);
}

export default function GameUI({ avatar, username, playerCount, onLogout }) {
  const {
    myXP, myLevel, currentXP, xpRequired, playerVersion,
    toggleInventory
  } = usePlayer();

  const xpBarRef = useRef(null);
  const xpFillRef = useRef(null);
  const [previousLevel, setPreviousLevel] = useState(myLevel);

  useEffect(() => {
    if (previousLevel !== null && myLevel > previousLevel) {
      if (xpBarRef.current) {
        xpBarRef.current.classList.remove('flash');
        void xpBarRef.current.offsetWidth;
        xpBarRef.current.classList.add('flash');
      }

      if (xpFillRef.current) {
        xpFillRef.current.classList.remove('rainbow');
        void xpFillRef.current.offsetWidth;
        xpFillRef.current.classList.add('rainbow');
      }

      const tag = document.createElement('div');
      tag.className = 'level-up-popup';
      tag.innerText = `Niveau ${myLevel} !`;
      document.body.appendChild(tag);
      setTimeout(() => tag.remove(), 1500);
    }
    setPreviousLevel(myLevel);
  }, [myLevel]);

  useEffect(() => {
    if (xpFillRef.current) {
      xpFillRef.current.style.transition = 'width 0.5s ease, transform 0.4s ease';
      xpFillRef.current.style.width = `${(currentXP / xpRequired) * 100}%`;

      xpFillRef.current.classList.remove('xp-glow');
      void xpFillRef.current.offsetWidth;
      xpFillRef.current.classList.add('xp-glow');
    }
  }, [currentXP, xpRequired, playerVersion]);

  // ➔ Ecoute quand un joueur rejoint pour afficher un toast
  useEffect(() => {
    const handlePlayerJoin = (e) => {
      const { username } = e.detail;
      if (username) {
        showToast(`👋 ${username} a rejoint la partie !`);
      }
    };

    window.addEventListener('player-join-toast', handlePlayerJoin);

    return () => {
      window.removeEventListener('player-join-toast', handlePlayerJoin);
    };
  }, []);

  return (
    <div className="game-ui">
      <div className="user-info">
        <img src={avatar} alt="Avatar de l'utilisateur" className="avatar" />
        <div className="username-block">
          <div className="username">{username}</div>
          <div className="level" aria-live="polite">
            Niveau {myLevel}
          </div>
          <div className="xp-bar-container">
            <div className="xp-bar" ref={xpBarRef}>
              <div className="xp-fill" ref={xpFillRef} />
            </div>
            <div className="xp-labels">
              <span
                aria-label={`Progression de l'expérience : ${currentXP} sur ${xpRequired} XP`}
              >
                {currentXP} / {xpRequired} XP
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="spacer" />

      <div className="stats">
        <span className="player-count" aria-live="polite">
          {playerCount} <span className="circle">●</span>
        </span>
        <div className="controls">
          <div className="button-group">
            <button
              className="logout-button"
              onClick={onLogout}
              aria-label="Se déconnecter"
            >
              <img src="/ui/logout.png" alt="" className="btn-icon" />
            </button>
            <button
              className="reload-button"
              onClick={() => window.location.reload()}
              aria-label="Recharger la scène"
            >
              <img src="/ui/reload.png" alt="" className="btn-icon" />
            </button>
          </div>
          <button
            className="inventory-button"
            onClick={toggleInventory}
            aria-label="Ouvrir l’inventaire"
          >
            <img src="/ui/inventory.png" alt="" className="btn-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
