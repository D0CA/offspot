import * as PIXI from 'pixi.js'
import { createOrUpdatePlayers } from '../pixi/playerManager'
import { displayChatBubble } from '../pixi/chatBubbles'
import { computeLevelFromXP } from '../utils/leveling'
import { mapConfig } from '../constants/mapConfig'

export function setupSocketHandlers({ socket, app, playersRef, stage, user, setPlayerCount, updateMyXP }) {
  function handlePlayerUpdate(serverPlayers) {
    if (!socket.id) {
      console.warn('[socketHandler] ⚠️ socket.id est undefined')
      return
    }

    const liveLevels = {}
    const myKey = user.username.toLowerCase()
    if (myKey && playersRef.current[myKey]) {
      liveLevels[myKey] = playersRef.current[myKey].level
    }

    const bgSprite = app.stage.children.find(c =>
      c instanceof PIXI.Sprite && c.texture?.baseTexture?.resource?.url === mapConfig.backgroundUrl)
    const scale = (bgSprite?.scale?.x > 0) ? bgSprite.scale.x : 1

    createOrUpdatePlayers(serverPlayers, playersRef.current, stage, user.username.toLowerCase(), liveLevels, scale)
    setPlayerCount(Object.keys(serverPlayers).length)
  }

  // Attente de pixi prêt
  window.addEventListener('pixi-ready', () => {
    console.log('[SOCKET HANDLER] Socket listeners being attached after pixi-ready')

    socket.off('update-players', handlePlayerUpdate)
    socket.on('update-players', handlePlayerUpdate)

    socket.on('player-data', (data) => {
      updateMyXP(data.xp || 0)
    })

    socket.on('chat-message', ({ socketId, username, message, xpGained, level, totalXP, currentXP, requiredXP }) => {
      const player = Object.values(playersRef.current).find(p => p.username?.toLowerCase() === username?.toLowerCase())
      if (!player) {
        console.warn('[chat-message] Aucun joueur trouvé pour', username)
        return
      }

      displayChatBubble({ player, message, app })

      if (player.username.toLowerCase() === user.username.toLowerCase()) {
        updateMyXP(totalXP)
      }

      if (player.levelText) {
        player.level = level
        player.levelText.text = `Niv ${level}`
      }
    })

    // === EVENTS GÉNÉRIQUES POUR LES JEUX ===
    socket.on('morpion-start', ({ opponent, isFirstPlayer }) => {
      console.log('[SOCKET] morpion-start reçu')
      window.dispatchEvent(new CustomEvent('morpion-start', {
        detail: { opponent, isFirstPlayer }
      }))
    })

    socket.on('morpion-move', ({ index, symbol }) => {
      window.dispatchEvent(new CustomEvent('morpion-move', {
        detail: { index, symbol }
      }))
    })

    socket.on('morpion-end', ({ winner }) => {
      console.log('[SOCKET] morpion-end reçu')
      window.dispatchEvent(new CustomEvent('morpion-end', {
        detail: { winner }
      }))
    })

    socket.on('challenge-request', ({ challenger, game }) => {
      console.log('[SOCKET HANDLER] challenge-request reçu', challenger, game)
      window.dispatchEvent(new CustomEvent('challenge-request', {
        detail: { challenger, game }
      }))
    })

    // Ajoute ici des handlers futurs pour puissance4, pfc, etc.
  })
}
