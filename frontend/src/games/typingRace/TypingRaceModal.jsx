import React, { useEffect, useState } from 'react';
import './TypingRaceModal.css';

export default function TypingRaceModal({ socket, me, opponent, text: initialText, onClose }) {
  const meKey = me.toLowerCase();
  const oppKey = opponent.toLowerCase();

  const [text, setText] = useState(initialText || '');
  const [input, setInput] = useState('');
  const [progress, setProgress] = useState({ [meKey]: 0, [oppKey]: 0 });
  const [ended, setEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [time, setTime] = useState(0);
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    const onStart = ({ detail }) => {
      setText(detail.text);
      setStartTime(Date.now());
    };
    const onProgress = ({ detail }) => {
      setProgress((prev) => ({ ...prev, [detail.username.toLowerCase()]: detail.correctCount }));
    };
    const onEnd = ({ detail }) => {
      setEnded(true);
      setWinner(detail.winner);
      setTime(detail.time);
    };
    const onCloseEvt = ({ detail }) => detail.from.toLowerCase() === opponent.toLowerCase() && onClose();

    window.addEventListener('typingRace-start', onStart);
    window.addEventListener('typingRace-progress', onProgress);
    window.addEventListener('typingRace-end', onEnd);
    window.addEventListener('typingRace-close', onCloseEvt);

    return () => {
      window.removeEventListener('typingRace-start', onStart);
      window.removeEventListener('typingRace-progress', onProgress);
      window.removeEventListener('typingRace-end', onEnd);
      window.removeEventListener('typingRace-close', onCloseEvt);
    };
  }, [opponent, onClose]);

  const handleChange = (e) => {
    const val = e.target.value;
    setInput(val);
    socket.emit('typingRace-progress', { typed: val });
  };

  // Affichage final avec calcul de CPM
  if (ended) {
    const durationSec = Math.round(time / 1000);
    const cpm = time > 0 ? Math.round((text.length * 60000) / time) : 0;
    return (
      <div className="tr-modal">
        <div className="tr-box">
          <h2>🏁 {winner} a gagné en {durationSec}s !</h2>
          <p>Vitesse : {cpm} caractères par minute</p>
          <button onClick={onClose}>OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tr-modal">
      <div className="tr-box">
        <h3>Tapez ce texte le plus vite possible :</h3>
        <p
        className="tr-text"
        onContextMenu={(e) => e.preventDefault()}
        style={{ userSelect: 'none' }}
        >
        {text.split('').map((char, index) => {
            const isIncorrect = input.length > index && input[index] !== char;
            return (
            <span
                key={index}
                className={isIncorrect ? 'tr-char-incorrect' : ''}
            >
                {char}
            </span>
            );
        })}
        </p>
        <textarea
          value={input}
          onChange={handleChange}
          onPaste={(e) => e.preventDefault()}
          disabled={ended}
          className="tr-input"
          rows={4}
        />
        <div className="tr-progress">
          <span>
            {me}: {progress[meKey]}/{text.length}
          </span>
          <span>
            {opponent}: {progress[oppKey]}/{text.length}
          </span>
        </div>
        <button
          onClick={() => {
            socket.emit('typingRace-close', { opponent });
            onClose();
          }}
        >
          Abandon
        </button>
      </div>
    </div>
  );
}