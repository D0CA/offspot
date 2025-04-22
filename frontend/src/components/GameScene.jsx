import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import GameUI from '../ui/GameUI';
import VideoScreen from '../ui/VideoScreen';
import LoadingScreen from '../ui/LoadingScreen';
import { usePlayer } from '../context/PlayerContext';
import Inventory from '../components/Inventory'
import { usePixiGame } from '../hooks/usePixiGame';
import { mapConfig } from '../constants/mapConfig';
import { SPEED } from '../constants/gamesConfig';
import PlayerCard from '../ui/PlayerCard';
import MorpionModal from '../games/morpion/MorpionModal';
import Puissance4Modal from '../games/puissance4/Puissance4Modal';
import ChallengePrompt from '../ui/ChallengePrompt';

export default function GameScene() {
  const [playerCount, setPlayerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  // On ajoute showInventory
  const { user, myXP, myLevel, logout, updateMyXP, socket, playersRef, showInventory } = usePlayer();
  const { pixiContainer, cameraRef } = usePixiGame(
    mapConfig,
    SPEED,
    user,
    socket,
    playersRef,
    setPlayerCount,
    updateMyXP
  );
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [challengePrompt, setChallengePrompt] = useState(null);

  useEffect(() => {
    const handleShowCard = (e) => setSelectedPlayer(e.detail);
    const handleStartMorpion = (e) => {
      const { opponent, isFirstPlayer } = e.detail ?? {};
      setActiveGame({ game: 'morpion', opponent, isFirstPlayer });
    };
    const handleStartPuissance4 = (e) => {
      const { opponent, isFirstPlayer } = e.detail ?? {};
      setActiveGame({ game: 'puissance4', opponent, isFirstPlayer });
    };

    window.addEventListener('show-player-card', handleShowCard);
    window.addEventListener('morpion-start', handleStartMorpion);
    window.addEventListener('puissance4-start', handleStartPuissance4);

    return () => {
      window.removeEventListener('show-player-card', handleShowCard);
      window.removeEventListener('morpion-start', handleStartMorpion);
      window.removeEventListener('puissance4-start', handleStartPuissance4);
    };
  }, []);

  useEffect(() => {
    const handleChallengeRequest = (e) => {
      const { challenger, game } = e.detail;
      setChallengePrompt({ challenger, game });
    };
    window.addEventListener('challenge-request', handleChallengeRequest);
    return () => window.removeEventListener('challenge-request', handleChallengeRequest);
  }, []);

  useEffect(() => {
    const onReady = () => setLoading(false);
    window.addEventListener('pixi-ready', onReady);
    return () => window.removeEventListener('pixi-ready', onReady);
  }, []);

  if (!user) return null;

  return (
    <>
      {challengePrompt &&
        createPortal(
          <ChallengePrompt
            challenger={challengePrompt.challenger}
            game={challengePrompt.game}
            onAccept={() => {
              socket.current.emit('challenge-accept', {
                challenger: challengePrompt.challenger,
                game: challengePrompt.game,
              });
              setChallengePrompt(null);
            }}
            onDecline={() => setChallengePrompt(null)}
          />, document.getElementById('ui-overlay') || document.body
        )}

      {showInventory && <Inventory />}
      
      <LoadingScreen loading={loading} />

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

      <GameUI
        key={`ui-${myXP}-${myLevel}`}
        avatar={user.avatar}
        username={user.username}
        playerCount={playerCount}
        onLogout={logout}
      />

      <VideoScreen cameraRef={cameraRef} />

      {selectedPlayer && (
        <PlayerCard
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
          onChallenge={(type) => {
            socket.current.emit('start-challenge', {
              type,
              targetUsername: selectedPlayer.username,
            });
            setSelectedPlayer(null);
          }}
        />
      )}

      {activeGame?.game === 'morpion' && (
        <MorpionModal
          me={user.username}
          opponent={activeGame.opponent}
          socket={socket.current}
          isFirstPlayer={activeGame.isFirstPlayer}
          onClose={() => setActiveGame(null)}
        />
      )}

      {activeGame?.game === 'puissance4' && (
        <Puissance4Modal
          me={user.username}
          opponent={activeGame.opponent}
          isFirstPlayer={activeGame.isFirstPlayer}
          socket={socket.current}
          onClose={() => setActiveGame(null)}
        />
      )}
    </>
  );
}