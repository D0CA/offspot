// frontend/src/games/morpion/MorpionModal.jsx
import React, { useEffect, useState } from 'react';
import './MorpionModal.css';

export default function MorpionModal({ me, opponent, isFirstPlayer, onClose, socket }) {
  const [grid, setGrid] = useState(Array(9).fill(null));
  const [myTurn, setMyTurn] = useState(isFirstPlayer);
  const [winner, setWinner] = useState(undefined);
  const [gameOver, setGameOver] = useState(false);
  const [rematchCount, setRematchCount] = useState(0);
  const [firstPlayer, setFirstPlayer] = useState(isFirstPlayer);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const mySymbol = firstPlayer ? 'X' : 'O';

  useEffect(() => {
    const onMove = ({ detail: { index, symbol } }) => {
      setGrid(prev => { const next = [...prev]; next[index] = symbol; return next; });
      setMyTurn(symbol !== mySymbol);
    };
    const onEnd = ({ detail: { winner } }) => {
      setWinner(winner);
      setGameOver(true);
    };
    const onRematchProgress = ({ detail: { count } }) => setRematchCount(count);
    const onRematchConfirmed = ({ detail: { starts } }) => {
      setFirstPlayer(starts);
      setGrid(Array(9).fill(null));
      setWinner(undefined);
      setGameOver(false);
      setMyTurn(starts);
      setRematchCount(0);
      setOpponentLeft(false);
    };
    const onCloseEvt = ({ detail: { from } }) => {
      if (from === opponent) setOpponentLeft(true);
    };

    window.addEventListener('morpion-move', onMove);
    window.addEventListener('morpion-end', onEnd);
    window.addEventListener('morpion-rematch-progress', onRematchProgress);
    window.addEventListener('morpion-rematch-confirmed', onRematchConfirmed);
    window.addEventListener('morpion-close', onCloseEvt);

    return () => {
      window.removeEventListener('morpion-move', onMove);
      window.removeEventListener('morpion-end', onEnd);
      window.removeEventListener('morpion-rematch-progress', onRematchProgress);
      window.removeEventListener('morpion-rematch-confirmed', onRematchConfirmed);
      window.removeEventListener('morpion-close', onCloseEvt);
    };
  }, [mySymbol, opponent, onClose]);

  const handleClick = index => {
    if (!myTurn || grid[index] || gameOver || opponentLeft) return;
    socket.emit('morpion-move', { index });
  };

  if (opponentLeft) {
    return (
      <div className="morpion-modal">
        <div className="morpion-box">
          <div className="morpion-header">
            <span>Partie terminée</span>
            <button onClick={onClose}>✕</button>
          </div>
          <div className="morpion-winner">Votre adversaire a quitté la partie</div>
          <div className="morpion-actions">
            <button onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="morpion-modal">
      <div className="morpion-box">
        <div className="morpion-header">
          <span>{me} VS {opponent}</span>
          <button onClick={() => { socket.emit('morpion-close', { opponent }); onClose(); }}>✕</button>
        </div>

        <div className="turn-indicator">
          {!gameOver && (myTurn ? '👉 À toi de jouer' : '⏳ Attente de l’adversaire')}
        </div>

        <div className="morpion-grid">
          {grid.map((cell, i) => (
            <button key={i} className="cell" onClick={() => handleClick(i)}>
              {cell}
            </button>
          ))}
        </div>

        {gameOver && (
          <>
            <div className="morpion-winner">
              {winner === null
                ? 'Match nul !'
                : winner.toLowerCase() === me.toLowerCase()
                  ? '🏆 Tu as gagné !'
                  : '😞 Tu as perdu'}
            </div>
            <div className="morpion-actions">
              <button onClick={() => socket.emit('morpion-rematch-request', { opponent })}>
                🔄 Rejouer {rematchCount}/2
              </button>
              <button onClick={() => { socket.emit('morpion-close', { opponent }); onClose(); }}>
                🚪 Quitter
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}