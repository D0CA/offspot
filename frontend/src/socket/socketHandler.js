// frontend/src/socket/socketHandler.js

import * as PIXI from 'pixi.js';
import { createOrUpdatePlayers } from '../pixi/playerManager';
import { displayChatBubble } from '../pixi/chatBubbles';
import { mapConfig } from '../constants/mapConfig';

/**
 * Configure tous les handlers Socket.IO et dispatch des événements pour le jeu.
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {PIXI.Application} params.app
 * @param {object} params.playersRef - Ref React stockant les joueurs locaux
 * @param {PIXI.Container} params.stage - correspond à cameraRef.current
 * @param {object} params.user - Infos utilisateur (username, avatar, etc.)
 * @param {function(number):void} params.setPlayerCount
 * @param {function(number):void} params.updateMyXP
 */
export function setupSocketHandlers({ socket, app, playersRef, stage, user, setPlayerCount, updateMyXP }) {
  
  let hasSpawned = false;

  function handlePlayerUpdate(serverPlayers) {
    if (!socket.id) return;
    const liveLevels = {};
    const myKey = user.username.toLowerCase();

    if (playersRef.current[myKey]) {
      liveLevels[myKey] = playersRef.current[myKey].level;
    }

    createOrUpdatePlayers(
      serverPlayers,
      playersRef.current,
      stage,
      myKey,
      liveLevels,
      app.stage.scale.x || 1
    );

    setPlayerCount(Object.keys(serverPlayers).length);

    // Zoom automatique uniquement au premier spawn
    setTimeout(() => {
      if (hasSpawned) return; // ❗ On fait rien si déjà spawn une fois

      const me = playersRef.current[myKey];
      const cam = stage; // cameraRef.current
      
      if (!me || !cam) return; // Sécurité au cas où
      
      const targetZoom = 0.7; // Le zoom cible
      const verticalOffset = window.innerHeight * 0.4; // Décalage vertical
      
      cam.scale.set(targetZoom);
      cam.x = window.innerWidth / 2 - me.container.x * targetZoom;
      cam.y = window.innerHeight / 2 - me.container.y * targetZoom + verticalOffset;

      hasSpawned = true; // ✅ Marquer que le zoom a été fait
    }, 200);
  }

  // === RECONNEXION AUTOMATIQUE ===
  socket.on('connect', () => {
    socket.emit('recover-session', { username: user.username });
  });

  socket.on('morpion-state', (data) => {
    window.dispatchEvent(new CustomEvent('morpion-state', { detail: data }));
  });
  socket.on('puissance4-state', (data) => {
    window.dispatchEvent(new CustomEvent('puissance4-state', { detail: data }));
  });

  window.addEventListener('pixi-ready', () => {
    socket.off('update-players', handlePlayerUpdate);
    socket.on('update-players', handlePlayerUpdate);

    socket.off('player-data');
    socket.on('player-data', (data) => updateMyXP(data.xp || 0));

    socket.emit('request-players');

    socket.off('chat-message');
    socket.on('chat-message', ({ username, message, totalXP, level }) => {
      const player = Object.values(playersRef.current).find(
        (p) => p.username.toLowerCase() === username.toLowerCase()
      );
      if (!player) return;
      displayChatBubble({ player, message, app });
      if (player.username.toLowerCase() === user.username.toLowerCase()) {
        updateMyXP(totalXP);
      }
      if (player.levelText) {
        player.level = level;
        player.levelText.text = `Niv ${level}`;
      }
    });

    socket.off('challenge-request');
    socket.on('challenge-request', ({ challenger, game }) => {
      window.dispatchEvent(
        new CustomEvent('challenge-request', { detail: { challenger, game } })
      );
    });

    socket.off('morpion-start');
    socket.on('morpion-start', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-start', { detail }))
    );
    socket.off('morpion-move');
    socket.on('morpion-move', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-move', { detail }))
    );
    socket.off('morpion-end');
    socket.on('morpion-end', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-end', { detail }))
    );
    socket.off('morpion-rematch-progress');
    socket.on('morpion-rematch-progress', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-rematch-progress', { detail }))
    );
    socket.off('morpion-rematch-confirmed');
    socket.on('morpion-rematch-confirmed', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-rematch-confirmed', { detail }))
    );
    socket.off('morpion-close');
    socket.on('morpion-close', (detail) =>
      window.dispatchEvent(new CustomEvent('morpion-close', { detail }))
    );

    socket.off('puissance4-start');
    socket.on('puissance4-start', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-start', { detail }))
    );
    socket.off('puissance4-move');
    socket.on('puissance4-move', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-move', { detail }))
    );
    socket.off('puissance4-end');
    socket.on('puissance4-end', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-end', { detail }))
    );
    socket.off('puissance4-rematch-progress');
    socket.on('puissance4-rematch-progress', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-rematch-progress', { detail }))
    );
    socket.off('puissance4-rematch-confirmed');
    socket.on('puissance4-rematch-confirmed', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-rematch-confirmed', { detail }))
    );
    socket.off('puissance4-close');
    socket.on('puissance4-close', (detail) =>
      window.dispatchEvent(new CustomEvent('puissance4-close', { detail }))
    );

    socket.off('typingRace-start');
    socket.on('typingRace-start', (detail) =>
      window.dispatchEvent(new CustomEvent('typingRace-start', { detail }))
    );
    socket.off('typingRace-progress');
    socket.on('typingRace-progress', (detail) =>
      window.dispatchEvent(new CustomEvent('typingRace-progress', { detail }))
    );
    socket.off('typingRace-end');
    socket.on('typingRace-end', (detail) =>
      window.dispatchEvent(new CustomEvent('typingRace-end', { detail }))
    );
    socket.off('typingRace-close');
    socket.on('typingRace-close', (detail) =>
      window.dispatchEvent(new CustomEvent('typingRace-close', { detail }))
    );
  });
}