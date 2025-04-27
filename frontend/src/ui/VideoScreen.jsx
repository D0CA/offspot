// src/ui/VideoScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import VideoControls from './VideoControls';

export default function VideoScreen({ cameraRef }) {
  const { socket } = usePlayer();
  const [embedSrc, setEmbedSrc] = useState(null);
  const [player, setPlayer] = useState(null);
  const iframeRef = useRef(null);

  const [serverVideoStartTime, setServerVideoStartTime] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [style, setStyle] = useState({});

  // Mise à jour dynamique de la position de l'iframe
  useEffect(() => {
    let frame;
    const updateStyle = () => {
      if (!cameraRef.current) return;
      const scale = cameraRef.current.scale.x || 1;
      const screenPos = cameraRef.current.toGlobal({ x: 1315, y: 700 });
      const videoWidth = (2200 - 1315) * scale;
      const videoHeight = (1350 - 910) * scale;
      const nextStyle = {
        position: 'absolute',
        top: `${screenPos.y}px`,
        left: `${screenPos.x}px`,
        width: `${videoWidth}px`,
        height: `${videoHeight}px`,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        willChange: 'transform',
      };
      setStyle(prev => JSON.stringify(prev) === JSON.stringify(nextStyle) ? prev : nextStyle);
      frame = requestAnimationFrame(updateStyle);
    };

    frame = requestAnimationFrame(updateStyle);
    window.addEventListener('resize', updateStyle);
    window.addEventListener('pixi-ready', updateStyle);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateStyle);
      window.removeEventListener('pixi-ready', updateStyle);
    };
  }, [cameraRef]);

  // Force pointer-events: none sur iframe YouTube
  useEffect(() => {
    const forceIframePassive = () => {
      if (iframeRef.current) {
        iframeRef.current.style.pointerEvents = 'none';
      }
    };
    forceIframePassive();
    const interval = setInterval(forceIframePassive, 1000);
    return () => clearInterval(interval);
  }, []);

  // Synchronisation vidéo socket
  useEffect(() => {
    const s = socket.current;
    if (!s) return;
    let syncInterval = null;

    function handleSync({ clientSendTime, serverTime, serverVideoStartTime }) {
      const t1 = Date.now();
      const rtt = t1 - clientSendTime;
      const oneWay = rtt / 2;
      const correctedServerTime = serverTime + oneWay;
      setClockOffset(Date.now() - correctedServerTime);
      setServerVideoStartTime(serverVideoStartTime);
      if (player && typeof player.seekTo === 'function') {
        const expected = (correctedServerTime - serverVideoStartTime) / 1000;
        const actual = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
        const drift = Math.abs(actual - expected);
        if (drift > 0.8) {
          player.seekTo(expected, true);
        }
      }
    }

    s.on('video-sync-response', handleSync);

    const handlePlay = ({ url }) => {
      const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
      if (!match) return;
      const videoId = match[1];
      setEmbedSrc(`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&playsinline=1&rel=0&disablekb=1&fs=0&enablejsapi=1&origin=${window.location.origin}`);
      const t0 = Date.now();
      s.emit('video-sync-request', { clientSendTime: t0 });
      if (syncInterval) clearInterval(syncInterval);
      syncInterval = setInterval(() => {
        if (!document.hidden) {
          const t = Date.now();
          s.emit('video-sync-request', { clientSendTime: t });
        }
      }, 30000);
    };

    const handleClear = () => {
      setEmbedSrc(null);
      if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
      }
    };

    s.emit('get-current-video');
    s.on('play-video', handlePlay);
    s.on('clear-video', handleClear);

    return () => {
      s.off('play-video', handlePlay);
      s.off('clear-video', handleClear);
      s.off('video-sync-response', handleSync);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [socket.current, player]);

  // Gestion retour d'onglet
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && player) {
        player.unMute();
        const savedVolume = parseInt(localStorage.getItem('preferredVolume'), 10) || 50;
        player.setVolume(savedVolume);
      }      
      socket.current?.emit('get-current-video');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [socket, player]);

  // Chargement et création du player YouTube
  useEffect(() => {
    if (!embedSrc || !iframeRef.current) return;

    const onReady = (event) => {
      event.target.mute();
      event.target.playVideo();
      setPlayer(event.target);

      const tryUnmute = () => {
        event.target.unMute();
        const savedVolume = parseInt(localStorage.getItem('preferredVolume'), 10) || 50;
        event.target.setVolume(savedVolume);
        window.removeEventListener('click', tryUnmute);
        window.removeEventListener('keydown', tryUnmute);
        window.removeEventListener('touchstart', tryUnmute);
      };   

      if (document.visibilityState === 'visible') {
        window.addEventListener('click', tryUnmute, { once: true });
        window.addEventListener('keydown', tryUnmute, { once: true });
        window.addEventListener('touchstart', tryUnmute, { once: true });
      }
    };

    const onStateChange = (e) => {
      if (e.data === window.YT.PlayerState.ENDED) {
        socket.current?.emit('skip-video');
      }
    };

    const tryInitYT = () => {
      if (window.YT && window.YT.Player) {
        new window.YT.Player(iframeRef.current, {
          events: { onReady, onStateChange }
        });
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      window.onYouTubeIframeAPIReady = tryInitYT;
      document.body.appendChild(tag);
    } else {
      tryInitYT();
    }
  }, [embedSrc, socket]);

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
  );
}
