// src/ui/VideoScreen.jsx
import React, { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import VideoControls from './VideoControls'

export default function VideoScreen({ cameraRef }) {
  const { socket } = usePlayer()
  const [embedSrc, setEmbedSrc] = useState(null)
  const [player,   setPlayer]   = useState(null)
  const iframeRef = useRef(null)

  // Sync state
  const [serverVideoStartTime, setServerVideoStartTime] = useState(0)
  const [clockOffset,           setClockOffset]           = useState(0)

  // 🎯 Positionnement dynamique du lecteur vidéo
  const [style, setStyle] = useState({})
  useEffect(() => {
    function updateStyle() {
      if (!cameraRef.current) return

      const scale = cameraRef.current.scale.x || 1
      const screenPos = cameraRef.current.toGlobal({ x: 1010, y: 680 })

      const videoWidth  = (1940 - 1010) * scale
      const videoHeight = (1120 - 680) * scale

      setStyle({
        position:      'absolute',
        top:           `${screenPos.y}px`,
        left:          `${screenPos.x}px`,
        width:         `${videoWidth}px`,
        height:        `${videoHeight}px`,
        zIndex:        0,
        pointerEvents: 'none',
      })
    }

    const iv = setInterval(updateStyle, 16)
    window.addEventListener('resize', updateStyle)
    window.addEventListener('pixi-ready', updateStyle)
    updateStyle()

    return () => {
      clearInterval(iv)
      window.removeEventListener('resize', updateStyle)
      window.removeEventListener('pixi-ready', updateStyle)
    }
  }, [cameraRef])

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.style.pointerEvents = 'none';
    }
  }, [style]);  

  // 📡 Socket : sync + play/clear
  useEffect(() => {
    const s = socket.current
    if (!s) return

    let syncInterval = null

    // 1) handle server response to sync
    function handleSync({ clientSendTime, serverTime, serverVideoStartTime }) {
      const t1 = Date.now()
      const rtt = t1 - clientSendTime
      const oneWay = rtt / 2
      const correctedServerTime = serverTime + oneWay

      setClockOffset(Date.now() - correctedServerTime)
      setServerVideoStartTime(serverVideoStartTime)

      // if player ready, seek
      if (player && typeof player.seekTo === 'function') {
        const seekPos = (correctedServerTime - serverVideoStartTime) / 1000
        player.seekTo(seekPos, true)
      }
    }
    s.on('video-sync-response', handleSync)

    // 2) when video starts
    const handlePlay = ({ url, startTime }) => {
      const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
      if (!match) return
      const videoId = match[1]

      // build embed URL (start param removed; we'll control via seek)
      setEmbedSrc(`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&fs=0&enablejsapi=1&origin=${window.location.origin}`)

      // immediate ping-pong
      const t0 = Date.now()
      s.emit('video-sync-request', { clientSendTime: t0 })

      // periodic re-sync
      if (syncInterval) clearInterval(syncInterval)
      syncInterval = setInterval(() => {
        const t = Date.now()
        s.emit('video-sync-request', { clientSendTime: t })
      }, 10_000)
    }

    const handleClear = () => {
      setEmbedSrc(null)
      if (syncInterval) {
        clearInterval(syncInterval)
        syncInterval = null
      }
    }

    s.emit('get-current-video')
    s.on('play-video', handlePlay)
    s.on('clear-video', handleClear)

    return () => {
      s.off('play-video', handlePlay)
      s.off('clear-video', handleClear)
      s.off('video-sync-response', handleSync)
      if (syncInterval) clearInterval(syncInterval)
    }
  }, [socket.current, player])

  // 🎬 Initialisation du lecteur YouTube & capture player
  useEffect(() => {
    if (!embedSrc || !iframeRef.current) return

    const onReady = (event) => {
      event.target.mute()
      event.target.playVideo()
      setPlayer(event.target)
    }
    const onStateChange = (e) => {
      if (e.data === window.YT.PlayerState.ENDED) {
        socket.current?.emit('skip-video')
      }
    }

    const tryInitYT = () => {
      if (window.YT && window.YT.Player) {
        new window.YT.Player(iframeRef.current, {
          events: { onReady, onStateChange }
        })
      }
    }

    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      window.onYouTubeIframeAPIReady = tryInitYT
      document.body.appendChild(tag)
    } else {
      tryInitYT()
    }
  }, [embedSrc, socket])

  return (
    <>
      {embedSrc && (
        <div style={style}>
          <iframe
            ref={iframeRef}
            width="100%"
            height="100%"
            src={embedSrc}
            title="Cinema Screen"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      <VideoControls player={player} />
    </>
  )
}
