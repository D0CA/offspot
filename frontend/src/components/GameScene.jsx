// src/components/GameScene.jsx
import React, { useState, useEffect } from 'react';
import GameUI from '../ui/GameUI';
import VideoScreen from '../ui/VideoScreen';
import LoadingScreen from '../ui/LoadingScreen';
import { usePlayer } from '../context/PlayerContext';
import { usePixiGame } from '../hooks/usePixiGame';
import { mapConfig } from '../constants/mapConfig';
import { SPEED } from '../constants/gameConstants';

export default function GameScene() {
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user, myXP, myLevel, logout, updateMyXP, socket, playersRef } = usePlayer();
  const { pixiContainer, cameraRef } = usePixiGame(
    mapConfig,
    SPEED,
    user,
    socket,
    playersRef,
    setPlayerCount,
    updateMyXP
  );

  // Dès que PIXI a fini de charger les assets (map, background, emotes…), on masque le loader
  useEffect(() => {
    const onReady = () => setLoading(false);
    window.addEventListener('pixi-ready', onReady);
    return () => window.removeEventListener('pixi-ready', onReady);
  }, []);

  if (!user) return null;

  return (
    <>
      {/* on passe loading au loader, il disparaîtra en fondu */}
      <LoadingScreen loading={loading} />

      {/* PIXI Canvas */}
      <div
        ref={pixiContainer}
        style={{
          width: '100vw',
          height: '100vh',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
        }}
      />

      {/* Interface React */}
      <GameUI
        key={`ui-${myXP}-${myLevel}`}
        avatar={user.avatar}
        username={user.username}
        playerCount={playerCount}
        onLogout={logout}
      />

      {/* Vidéo (derrière le canvas) */}
      <VideoScreen cameraRef={cameraRef} />
    </>
  );
}
