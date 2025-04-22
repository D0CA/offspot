// frontend/src/games/puissance4/Puissance4Modal.jsx
import React, { useEffect, useState } from 'react';
import './Puissance4Modal.css';

export default function Puissance4Modal({ me, opponent, isFirstPlayer, onClose, socket }) {
  const emptyGrid = Array(6).fill(null).map(() => Array(7).fill(null));
  const [grid, setGrid] = useState(emptyGrid);
  const [winner, setWinner] = useState(undefined);
  const [rematchCount, setRematchCount] = useState(0);
  const [firstPlayer, setFirstPlayer] = useState(isFirstPlayer);
  const [myTurn, setMyTurn] = useState(isFirstPlayer);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const myColor = firstPlayer ? 'red' : 'yellow';

  useEffect(() => {
    const onStart = ({ detail: { isFirstPlayer } }) => {
      setFirstPlayer(isFirstPlayer);
      setMyTurn(isFirstPlayer);
      setGrid(emptyGrid);
      setWinner(undefined);
      setRematchCount(0);
      setOpponentLeft(false);
    };
    const onMove = ({ detail: { column, row, symbol } }) => {
      setGrid(prev => prev.map((r, ri) => r.map((c, ci) => (ri === row && ci === column ? symbol : c))));
      setMyTurn(symbol !== myColor);
    };
    const onEnd = ({ detail: { winner } }) => { setWinner(winner); setMyTurn(false); };
    const onRematchProgress = ({ detail: { count } }) => setRematchCount(count);
    const onRematchConfirmed = ({ detail: { starts } }) => {
      setFirstPlayer(starts);
      setMyTurn(starts);
      setGrid(emptyGrid);
      setWinner(undefined);
      setRematchCount(0);
      setOpponentLeft(false);
    };
    const onCloseEvt = ({ detail: { from } }) => { if (from === opponent) setOpponentLeft(true); };

    window.addEventListener('puissance4-start', onStart);
    window.addEventListener('puissance4-move', onMove);
    window.addEventListener('puissance4-end', onEnd);
    window.addEventListener('puissance4-rematch-progress', onRematchProgress);
    window.addEventListener('puissance4-rematch-confirmed', onRematchConfirmed);
    window.addEventListener('puissance4-close', onCloseEvt);

    return () => {
      window.removeEventListener('puissance4-start', onStart);
      window.removeEventListener('puissance4-move', onMove);
      window.removeEventListener('puissance4-end', onEnd);
      window.removeEventListener('puissance4-rematch-progress', onRematchProgress);
      window.removeEventListener('puissance4-rematch-confirmed', onRematchConfirmed);
      window.removeEventListener('puissance4-close', onCloseEvt);
    };
  }, [myColor, opponent, onClose]);

  const handleColumnClick = colIdx => {
    if (winner !== undefined || !myTurn || opponentLeft) return;
    socket.emit('puissance4-move', { column: colIdx, symbol: myColor });
    setMyTurn(false);
  };

  if (opponentLeft) {
    return (
      <div className="p4-modal">
        <div className="p4-box">
          <div className="p4-header">
            <span>Partie terminée</span>
            <button onClick={onClose}>✕</button>
          </div>
          <div className="p4-turn">Votre adversaire a quitté la partie</div>
          <div className="p4-actions">
            <button onClick={onClose}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p4-modal">
      <div className="p4-box">
        <div className="p4-header">
          <span>{me} VS {opponent}</span>
          <button onClick={() => { socket.emit('puissance4-close', { opponent }); onClose(); }}>✕</button>
        </div>
        <div className="p4-turn">
          {! (winner !== undefined) && (myTurn ? '👉 À toi de jouer' : '⏳ Attente de l’adversaire')}
          {winner !== undefined && (winner === null ? 'Match nul !' : winner.toLowerCase() === me.toLowerCase() ? '🏆 Tu as gagné !' : '😞 Tu as perdu')}
        </div>
        <div className="p4-grid">
          {grid.map((row, ri) => (
            <div className="p4-row" key={ri}>
              {row.map((cell, ci) => (
                <div
                  key={ci}
                  className={`p4-cell ${cell || ''}`}
                  onClick={() => handleColumnClick(ci)}
                />
              ))}
            </div>
          ))}
        </div>
        {winner !== undefined && (
          <div className="p4-actions">
            <button onClick={() => socket.emit('puissance4-rematch-request', { opponent })}>
              🔄 Rejouer {rematchCount}/2
            </button>
            <button onClick={onClose}>🚪 Quitter</button>
          </div>
        )}
      </div>
    </div>
  );
}
