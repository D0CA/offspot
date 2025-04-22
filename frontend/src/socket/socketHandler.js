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
      window.dispatchEvent(new CustomEvent('morpion-end', {
        detail: { winner }
      }))
    })

    socket.on('challenge-request', ({ challenger, game }) => {
      window.dispatchEvent(new CustomEvent('challenge-request', {
        detail: { challenger, game }
      }))
    })

    socket.on('puissance4-start', ({ opponent, isFirstPlayer }) => {
      console.log('[SOCKET] puissance4-start reçu')
      window.dispatchEvent(new CustomEvent('puissance4-start', {
        detail: { opponent, isFirstPlayer }
      }))
    })
    
    socket.on('puissance4-move', ({ column, row, symbol }) => {
      setGrid(prev => {
        const updated = prev.map(r => [...r])
        updated[row][column] = symbol
        return updated
      })
    
      if (symbol !== myColor) {
        setMyTurn(true)
      } else {
        setMyTurn(false) // 👈 important pour désactiver ton tour si c'est pas à toi
      }
    })

    socket.on('puissance4-end', ({ winner }) => {
      setWinner(winner)
      setMyTurn(false)
    })
    
  })
}
