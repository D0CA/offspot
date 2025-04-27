import React, { useState, useEffect } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { extractVideoId, isValidYouTubeUrl } from '../utils/youtube';
import './VideoControls.css';

export default function VideoControls({ player }) {
  const { socket, user } = usePlayer();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('preferredVolume');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [queue, setQueue] = useState([]);
  const [isCooldown, setIsCooldown] = useState(false);
  const [skipUsed, setSkipUsed] = useState(false); // 🆕 nouvel état pour empêcher spam skip

  // Récupère la playlist
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    const handleQueue = (q) => {
      setQueue(q);
      setSkipUsed(false); // 🆕 reset skip à la nouvelle vidéo
    };
    s.on('video-queue', handleQueue);
    s.emit('get-video-queue');
    return () => s.off('video-queue', handleQueue);
  }, [socket.current]);

  // Applique le volume dès que le player est prêt
  useEffect(() => {
    if (player && typeof player.setVolume === 'function') {
      const saved = localStorage.getItem('preferredVolume');
      const vol = saved ? parseInt(saved, 10) : 0;
      if (vol > 0) {
        player.unMute();
        player.setVolume(vol);
      }
    }
  }, [player]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url || !socket.current || isCooldown) return;

    if (!isValidYouTubeUrl(url)) {
      setError("URL invalide. Assure-toi qu'elle vient bien de YouTube.");
      return;
    }

    socket.current.emit('submit-video', {
      url,
      username: user?.username || 'Inconnu',
    });

    setSubmitted(true);
    setError(null);
    setUrl('');
    setIsCooldown(true);

    setTimeout(() => {
      setSubmitted(false);
      setIsCooldown(false);
    }, 3000);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseInt(e.target.value, 10);
    setVolume(newVol);
    localStorage.setItem('preferredVolume', newVol);
    if (player) {
      player.unMute();
      player.setVolume(newVol);
    }
  };

  const handleSkip = () => {
    if (!socket.current || skipUsed) return;
    socket.current.emit('skip-video');
    setSkipUsed(true); // 🆕 désactive le bouton après skip
  };

  return (
    <div className={`video-controls ${open ? 'open' : 'closed'}`}>
      <button
        className="toggle-btn"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Fermer les contrôles vidéo' : 'Ouvrir les contrôles vidéo'}
      >
        {open ? '🎬 Fermer' : '🎬'}
      </button>

      {open && (
        <>
          {/* Volume */}
          <div style={{ marginBottom: '12px' }}>
            <label htmlFor="volume-slider">🔊 Volume</label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              disabled={!player}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={volume}
              aria-label="Régler le volume"
              style={{ width: '100%' }}
            />
          </div>

          {/* Skip */}
          <button
            className="skip-btn"
            onClick={handleSkip}
            disabled={!player || skipUsed}
          >
            ⏭ Skip
          </button>

          {/* Ajouter une vidéo */}
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL YouTube..."
              aria-label="Entrer une URL YouTube"
            />
            <button className="add-btn" type="submit" disabled={isCooldown}>
              ➕ Ajouter
            </button>
            {submitted && <span style={{ color: '#0f0' }}>✔️ Ajoutée !</span>}
            {error && <span style={{ color: 'red' }}>{error}</span>}
          </form>

          {/* Playlist */}
          <div className="playlist">
            <h4 id="playlist-title">
              🎥 Playlist <span style={{ fontWeight: 'normal', color: '#aaa' }}>({queue.length})</span>
            </h4>
            {queue.length === 0 ? (
              <p>Aucune vidéo en attente.</p>
            ) : (
              <ul aria-labelledby="playlist-title">
                {queue.map((item) => {
                  const id = extractVideoId(item.url) || item.url;
                  return (
                    <li key={id}>
                      <span className="username">{item.username}</span><br />
                      <span className="url">{item.url}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
