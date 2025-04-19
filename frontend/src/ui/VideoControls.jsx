import React, { useState, useEffect } from 'react'
import { usePlayer } from '../context/PlayerContext'

const isValidYouTubeUrl = (url) => {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/
  return regex.test(url)
}

export default function VideoControls({ player }) {
  const { socket, user } = usePlayer()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('preferredVolume')
    return saved ? parseInt(saved, 10) : 0
  })
  const [queue, setQueue] = useState([])

  useEffect(() => {
    const s = socket.current
    if (!s) return

    s.on('video-queue', setQueue)
    s.emit('get-video-queue')

    return () => s.off('video-queue')
  }, [socket.current])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url || !socket.current) return

    if (!isValidYouTubeUrl(url)) {
      setError("URL invalide. Assure-toi qu'elle vient bien de YouTube.")
      return
    }

    socket.current.emit('submit-video', {
      url,
      username: user?.username || 'Inconnu'
    })

    setSubmitted(true)
    setError(null)
    setUrl('')
    setTimeout(() => setSubmitted(false), 3000)
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value, 10)
    setVolume(newVolume)
    localStorage.setItem('preferredVolume', newVolume)
    if (player) {
      player.unMute()
      player.setVolume(newVolume)
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: '30px',
      right: '30px',
      background: 'rgba(20, 15, 25, 0.85)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 0 12px rgba(0, 0, 0, 0.3)',
      borderRadius: '12px',
      padding: '10px',
      color: '#fff',
      fontFamily: "'Poppins', sans-serif",
      width: open ? '380px' : '60px',
      transition: 'width 0.3s ease',
      overflow: 'hidden',
      zIndex: 9999
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'linear-gradient(45deg, #ffdc73, #ffa94d)',
          color: '#1a1a1a',
          border: 'none',
          borderRadius: '8px',
          width: '100%',
          padding: '10px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          marginBottom: open ? '14px' : '0',
          transition: 'all 0.3s ease'
        }}
      >
        {open ? '🎬 Fermer' : '🎬'}
      </button>

      {open && (
        <>
          <div style={{ marginBottom: '12px' }}>
            🔊 Volume
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={() => socket.current?.emit('skip-video')}
            style={{
              width: '100%',
              background: 'linear-gradient(45deg, #ff6f61, #e74c3c)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              fontWeight: 'bold',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              marginBottom: '12px'
            }}
          >
            ⏭ Skip
          </button>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL YouTube..."
              style={{
                padding: '6px',
                borderRadius: '6px',
                border: '1px solid #888',
                background: '#1d1b20',
                color: '#fff'
              }}
            />
            <button
              type="submit"
              style={{
                background: 'linear-gradient(45deg, #ffc857, #ffb347)',
                border: 'none',
                borderRadius: '6px',
                padding: '6px',
                fontWeight: 'bold',
              }}
            >
              ➕ Ajouter
            </button>
            {submitted && <span style={{ color: '#0f0' }}>✔️ Ajoutée !</span>}
            {error && <span style={{ color: 'red' }}>{error}</span>}
          </form>

          <div>
            <h4 style={{ color: '#ffd166', marginBottom: '10px' }}>
              🎥 Playlist <span style={{ fontWeight: 'normal', color: '#aaa' }}>({queue.length})</span>
            </h4>

            {queue.length === 0 && <p style={{ color: '#888' }}>Aucune vidéo en attente.</p>}

            <ul style={{
              paddingLeft: '18px',
              fontSize: '13px',
              lineHeight: '1.4',
              maxHeight: '180px',
              overflowY: 'auto'
            }}>
              {queue.map((item, i) => (
                <li key={i} style={{ marginBottom: '10px' }}>
                  <span style={{ color: '#ffcc00' }}>{item.username}</span><br />
                  <span style={{ color: '#fff' }}>{item.url}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
