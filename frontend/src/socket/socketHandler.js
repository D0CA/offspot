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
 * @param {PIXI.Container} params.stage
 * @param {object} params.user - Infos utilisateur (username, avatar, etc.)
 * @param {function(number):void} params.setPlayerCount
 * @param {function(number):void} params.updateMyXP
 */
export function setupSocketHandlers({ socket, app, playersRef, stage, user, setPlayerCount, updateMyXP }) {
  // Handler mise à jour des joueurs PIXI
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
  }

  // === RECONNEXION AUTOMATIQUE ===
  // Lorsque socket.io reconnecte
  socket.on('connect', () => {
    socket.emit('recover-session', { username: user.username });
  });
  // Réception de l'état Morpion
  socket.on('morpion-state', (data) => {
    window.dispatchEvent(new CustomEvent('morpion-state', { detail: data }));
  });
  // Réception de l'état Puissance4
  socket.on('puissance4-state', (data) => {
    window.dispatchEvent(new CustomEvent('puissance4-state', { detail: data }));
  });

  // On attend que PIXI soit prêt avant d'attacher les autres handlers
  window.addEventListener('pixi-ready', () => {
    // === SYNC JOUEURS ===
    socket.off('update-players', handlePlayerUpdate);
    socket.on('update-players', handlePlayerUpdate);

    socket.off('player-data');
    socket.on('player-data', data => updateMyXP(data.xp || 0));

    socket.off('chat-message');
    socket.on('chat-message', ({ username, message, xpGained, level, totalXP }) => {
      const player = Object.values(playersRef.current).find(
        p => p.username.toLowerCase() === username.toLowerCase()
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

    // === EVENTS DE JEU ===
    socket.off('challenge-request');
    socket.on('challenge-request', ({ challenger, game }) => {
      window.dispatchEvent(
        new CustomEvent('challenge-request', { detail: { challenger, game } })
      );
    });

    // Morpion
    socket.off('morpion-start');
    socket.on('morpion-start', ({ opponent, isFirstPlayer }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-start', { detail: { opponent, isFirstPlayer } })
      );
    });
    socket.off('morpion-move');
    socket.on('morpion-move', ({ index, symbol }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-move', { detail: { index, symbol } })
      );
    });
    socket.off('morpion-end');
    socket.on('morpion-end', ({ winner }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-end', { detail: { winner } })
      );
    });
    socket.off('morpion-rematch-progress');
    socket.on('morpion-rematch-progress', ({ count }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-rematch-progress', { detail: { count } })
      );
    });
    socket.off('morpion-rematch-confirmed');
    socket.on('morpion-rematch-confirmed', ({ from, starts }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-rematch-confirmed', { detail: { from, starts } })
      );
    });
    socket.off('morpion-close');
    socket.on('morpion-close', ({ from }) => {
      window.dispatchEvent(
        new CustomEvent('morpion-close', { detail: { from } })
      );
    });

    // Puissance4
    socket.off('puissance4-start');
    socket.on('puissance4-start', ({ opponent, isFirstPlayer }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-start', { detail: { opponent, isFirstPlayer } })
      );
    });
    socket.off('puissance4-move');
    socket.on('puissance4-move', ({ column, row, symbol }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-move', { detail: { column, row, symbol } })
      );
    });
    socket.off('puissance4-end');
    socket.on('puissance4-end', ({ winner }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-end', { detail: { winner } })
      );
    });
    socket.off('puissance4-rematch-progress');
    socket.on('puissance4-rematch-progress', ({ count }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-rematch-progress', { detail: { count } })
      );
    });
    socket.off('puissance4-rematch-confirmed');
    socket.on('puissance4-rematch-confirmed', ({ from, starts }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-rematch-confirmed', { detail: { from, starts } })
      );
    });
    socket.off('puissance4-close');
    socket.on('puissance4-close', ({ from }) => {
      window.dispatchEvent(
        new CustomEvent('puissance4-close', { detail: { from } })
      );
    });
  });
}
