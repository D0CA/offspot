import React, { useEffect, useRef, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import VideoControls from './VideoControls'

export default function VideoScreen({ cameraRef }) {
  const { socket } = usePlayer()
  const [videoUrl, setVideoUrl] = useState(null)
  const [startTime, setStartTime] = useState(null)
  const [embedSrc, setEmbedSrc] = useState(null)
  const [style, setStyle] = useState({})
  const [player, setPlayer] = useState(null)
  const iframeRef = useRef(null)

  // 🎯 Positionnement dynamique du lecteur vidéo
  useEffect(() => {
    function updateStyle() {
      if (!cameraRef.current) return

      const scale = cameraRef.current.scale.x || 1
      const screenPos = cameraRef.current.toGlobal({ x: 1010, y: 680 })

      const videoWidth = (1940 - 1010) * scale
      const videoHeight = (1120 - 680) * scale

      setStyle({
        position: 'absolute',
        top: `${screenPos.y}px`,
        left: `${screenPos.x}px`,
        width: `${videoWidth}px`,
        height: `${videoHeight}px`,
        zIndex: 0,
        pointerEvents: 'none',
      })
    }

    const interval = setInterval(updateStyle, 16)
    window.addEventListener('resize', updateStyle)
    window.addEventListener('pixi-ready', updateStyle)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', updateStyle)
      window.removeEventListener('pixi-ready', updateStyle)
    }
  }, [cameraRef])

  // 📡 Socket : reçoit vidéo en cours ou clear
  useEffect(() => {
    const s = socket.current
    if (!s) return

    const handlePlay = (data) => {
      const raw = data?.url
      const startTime = data?.startTime
      const rawUrl = typeof raw === 'string' ? raw : raw?.url
      if (!rawUrl || !startTime) return

      try {
        const videoIdMatch = rawUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
        const videoId = videoIdMatch ? videoIdMatch[1] : null
        if (!videoId) return

        const now = Date.now()
        const secondsOffset = Math.floor((now - startTime) / 1000)

        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${secondsOffset}&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&fs=0&enablejsapi=1&cc_load_policy=0&origin=${window.location.origin}`

        setVideoUrl(rawUrl)
        setStartTime(startTime)
        setEmbedSrc(embedUrl)
      } catch (err) {
        console.error('[❌] Erreur lors du parsing de l\'URL:', rawUrl, err)
      }
    }

    const handleClear = () => {
      setVideoUrl(null)
      setStartTime(null)
      setEmbedSrc(null)
    }

    s.emit('get-current-video')
    s.on('play-video', handlePlay)
    s.on('clear-video', handleClear)

    return () => {
      +s.off('play-video', handlePlay)
      +s.off('clear-video', handleClear)
    }
  }, [socket.current])

  // 🎬 Initialisation du lecteur YouTube
  useEffect(() => {
    if (!embedSrc || !iframeRef.current) return

    const tryInitYT = () => {
      if (window.YT && window.YT.Player) {
        const ytPlayer = new window.YT.Player(iframeRef.current, {
          events: {
            onReady: (event) => {
              console.log('[🔇 Mute]', event)
              event.target.mute()
              event.target.playVideo()
              setPlayer(event.target)
            },
            onStateChange: (e) => {
              if (e.data === window.YT.PlayerState.ENDED) {
                socket.current?.emit('skip-video')
              }

              if (e.data === window.YT.PlayerState.PLAYING) {
                const saved = localStorage.getItem('preferredVolume')
                const volume = saved ? parseInt(saved, 10) : 0

                if (volume > 0) {
                  setTimeout(() => {
                    if (e.target.getPlayerState() === window.YT.PlayerState.PLAYING) {
                      e.target.setVolume(volume)
                      e.target.unMute()
                    }
                  }, 3000)
                }
              }
            }
          }
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
  }, [embedSrc])

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