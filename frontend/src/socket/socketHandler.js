import * as PIXI from 'pixi.js'
import { createOrUpdatePlayers } from '../pixi/playerManager'
import { displayChatBubble } from '../pixi/chatBubbles'
import { computeLevelFromXP } from '../utils/leveling'
import { mapConfig } from '../constants/mapConfig'

window.addEventListener('rescale-players', () => {
  const bgSprite = app.stage.children.find(c => c instanceof PIXI.Sprite && c.texture?.baseTexture?.resource?.url === mapConfig.backgroundUrl)
  const scale = (bgSprite?.scale?.x > 0) ? bgSprite.scale.x : 1

  Object.values(playersRef.current).forEach(p => {
    if (!p.container || !p.tileX || !p.tileY) return
    p.container.x = p.tileX * scale
    p.container.y = p.tileY * scale
    p.container.zIndex = 1000 + p.container.y

    if (p.chatBubble) p.chatBubble.scale.set(scale)
    if (p.nameText) p.nameText.scale.set(scale)
    if (p.levelText) p.levelText.scale.set(scale)
  })
})


export function setupSocketHandlers({
  socket,
  app,
  playersRef,
  stage,
  user,
  setPlayerCount,
  updateMyXP
}) {
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
    

    const bgSprite = app.stage.children.find(c => c instanceof PIXI.Sprite && c.texture?.baseTexture?.resource?.url === mapConfig.backgroundUrl)
    const scale = (bgSprite?.scale?.x > 0) ? bgSprite.scale.x : 1


    createOrUpdatePlayers(serverPlayers, playersRef.current, stage, user.username.toLowerCase(), liveLevels, scale)
    setPlayerCount(Object.keys(serverPlayers).length)
  }

  // Attente du fond avant d’écouter
  window.addEventListener('pixi-ready', () => {
    socket.on('update-players', handlePlayerUpdate)
  })  

  socket.on('player-data', (data) => {
    updateMyXP(data.xp || 0)
  })

  socket.on('chat-message', ({ socketId, username, message, xpGained, level, totalXP, currentXP, requiredXP }) => {
    const player = Object.values(playersRef.current).find(p => p.username?.toLowerCase() === username?.toLowerCase())

    if (!player) {
      console.warn('[chat-message] Aucun joueur trouvé pour', username, 'parmi', Object.values(playersRef.current).map(p => p.username))
      return
    }

    displayChatBubble({ player, message, app })  

    if (socketId === socket.id) {
      updateMyXP(totalXP)
    
      // 🔁 aussi mettre à jour ton propre affichage sous le perso
      if (player.levelText) {
        player.level = level
        player.levelText.text = `Niv ${level}`
      }
    } else {
      // 🔁 mise à jour pour les autres
      if (player.levelText) {
        player.level = level
        player.levelText.text = `Niv ${level}`
      }
    }         
  })
}
