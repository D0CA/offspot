import React, { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import GameUI from '../ui/GameUI'
import { load7TVEmotes } from '../utils/7tv'
import { usePlayer } from '../context/PlayerContext'
import { useSocket } from '../hooks/useSocket'
import { mapConfig } from '../constants/mapConfig'
import VideoScreen from '../ui/VideoScreen'
import { setupSocketHandlers } from '../socket/socketHandler'

const SPEED = 3

export default function GameScene() {
  const pixiContainer = useRef(null)
  const app = useRef(null)
  const cameraContainer = useRef(null)
  const stageContainer = useRef(null)
  const localRef = useRef({})
  window.playersRef = localRef
  const backgroundRef = useRef(null)
  const [playerCount, setPlayerCount] = useState(0)

  const {
    user,
    socket,
    myXP,
    myLevel,
    currentXP,
    xpRequired,
    updateMyXP,
    setMyLevel,
    setCurrentXP,
    setXPRequired,
    playersRef,
    logout
  } = usePlayer()

  useEffect(() => {
    const syncPlayersRef = () => {
      playersRef.current = localRef.current
      requestAnimationFrame(syncPlayersRef)
    }
    syncPlayersRef()
    return () => cancelAnimationFrame(syncPlayersRef)
  }, [])

  useEffect(() => {
    if (!pixiContainer.current) return

    app.current = new PIXI.Application({
      backgroundAlpha: 0,
      transparent: true,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      resizeTo: window,
    })

    pixiContainer.current.innerHTML = ''
    pixiContainer.current.appendChild(app.current.view)

    stageContainer.current = new PIXI.Container()
    stageContainer.current.sortableChildren = true
    app.current.stage.addChild(stageContainer.current)

    cameraContainer.current = new PIXI.Container()
    stageContainer.current.addChild(cameraContainer.current)

    const scaleRef = { current: 1 }
    const dragging = { current: false }
    const dragged = { current: false }
    const lastPos = { current: { x: 0, y: 0 } }

    function clampCamera() {
      const scale = cameraContainer.current.scale.x
      const screenW = window.innerWidth
      const screenH = window.innerHeight
      const mapW = mapConfig.width * scale
      const mapH = mapConfig.height * scale
      const minX = screenW - mapW
      const minY = screenH - mapH
      cameraContainer.current.x = Math.min(0, Math.max(minX, cameraContainer.current.x))
      cameraContainer.current.y = Math.min(0, Math.max(minY, cameraContainer.current.y))
    }

    function resizeBackground(bg) {
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const baseScaleX = screenWidth / mapConfig.width
      const baseScaleY = screenHeight / mapConfig.height
      const baseScale = Math.min(baseScaleX, baseScaleY)
      const finalScale = baseScale * 1.2
      scaleRef.current = finalScale

      cameraContainer.current.scale.set(finalScale)

      Object.values(localRef.current).forEach(p => {
        if (!p.container || p.tileX == null || p.tileY == null) return
        p.container.x = p.tileX
        p.container.y = p.tileY
        p.container.zIndex = 1000 + p.container.y
      })

      app.current.renderer.resize(window.innerWidth, window.innerHeight)
      clampCamera()
    }

    PIXI.Assets.load(mapConfig.backgroundUrl).then((bgTexture) => {
      const bg = new PIXI.Sprite(bgTexture)
      bg.anchor.set(0)
      bg.x = 0
      bg.y = 0
      bg.zIndex = -20
      backgroundRef.current = bg
      cameraContainer.current.addChild(bg)

      window.addEventListener('resize', () => resizeBackground(bg))
      resizeBackground(bg)

      window.dispatchEvent(new Event('pixi-ready'))
    }).catch((e) => {
      console.error('[PIXI] ❌ Erreur chargement background.png', e)
    })

    app.current.stage.eventMode = 'static'
    app.current.stage.hitArea = app.current.screen

    app.current.stage.on('pointerup', (event) => {
      if (dragged.current) {
        dragged.current = false
        dragging.current = false
        document.body.classList.remove('dragging')
        return
      }

      const { x, y } = event.data.global
      const me = localRef.current[user?.username?.toLowerCase()]
      if (!me || !backgroundRef.current) return

      if (me.blockInputUntil && Date.now() < me.blockInputUntil) {
        console.log('⏳ Mouvement bloqué pendant le spawn')
        return
      }

      const scale = cameraContainer.current.scale.x
      const localX = (x - cameraContainer.current.x) / scale
      const localY = (y - cameraContainer.current.y) / scale

      const { minX, maxX, minY, maxY } = mapConfig.walkableArea
      const targetX = Math.max(minX, Math.min(maxX, localX))
      const targetY = Math.max(minY, Math.min(maxY, localY))

      me.targetX = targetX
      me.targetY = targetY
      me.tileX = targetX
      me.tileY = targetY
      socket.current?.emit('move', { x: targetX, y: targetY })
    })

    app.current.view.addEventListener('pointerdown', (e) => {
      dragging.current = true
      dragged.current = false
      lastPos.current = { x: e.clientX, y: e.clientY }
      document.body.classList.add('dragging')
    })

    app.current.view.addEventListener('pointermove', (e) => {
      if (!dragging.current) return
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragged.current = true
      cameraContainer.current.x += dx
      cameraContainer.current.y += dy
      clampCamera()
      lastPos.current = { x: e.clientX, y: e.clientY }
    })

    app.current.view.addEventListener('pointerup', () => {
      dragging.current = false
      document.body.classList.remove('dragging')
    })

    app.current.view.addEventListener('pointerleave', () => {
      dragging.current = false
      document.body.classList.remove('dragging')
    })

    app.current.view.addEventListener('wheel', (e) => {
      e.preventDefault()
      const oldScale = cameraContainer.current.scale.x
      const dir = e.deltaY > 0 ? -1 : 1
      let newScale = oldScale + dir * 0.1
      newScale = Math.min(2, Math.max(0.5, newScale))

      const rect = app.current.view.getBoundingClientRect()
      const localX = (e.clientX - rect.left - cameraContainer.current.x) / oldScale
      const localY = (e.clientY - rect.top - cameraContainer.current.y) / oldScale

      cameraContainer.current.scale.set(newScale)
      cameraContainer.current.x = e.clientX - localX * newScale
      cameraContainer.current.y = e.clientY - localY * newScale
      clampCamera()
    }, { passive: false })

    app.current.ticker.add(() => {
      const scale = cameraContainer.current.scale.x || 1
      for (const id in localRef.current) {
        const p = localRef.current[id]
        if (!p || !p.container || !p.anims) return

        const targetX = p.targetX
        const targetY = p.targetY
        const dx = targetX - p.container.x
        const dy = targetY - p.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (p.isSpawning) continue

        if (p.justSpawned) {
          p.container.x = targetX
          p.container.y = targetY
          p.justSpawned = false
        } else if (dist > SPEED) {
          p.container.x += (dx / dist) * SPEED
          p.container.y += (dy / dist) * SPEED
        } else {
          p.container.x = targetX
          p.container.y = targetY
        }

        const isMoving = dist > 1
        let newDirection = p.currentDirection

        if (isMoving) {
          newDirection = Math.abs(dx) > Math.abs(dy)
            ? (dx > 0 ? 'Left' : 'Right')
            : (dy > 0 ? 'Front' : 'Back')
          p.currentDirection = newDirection
        }

        const newAnim = isMoving ? 'WalkAnim' : 'IdleAnim'

        for (const dir of ['Front', 'Back', 'Left', 'Right']) {
          if (p.anims[dir]) p.anims[dir].visible = dir === p.currentDirection
        }

        const animDisplay = p.anims[p.currentDirection]
        const armature = animDisplay?.animation

        if (armature && armature.hasAnimation(newAnim)) {
          const lastPlayed = armature.lastAnimationState?.name
          const shouldPlay = lastPlayed !== newAnim
          if (shouldPlay) armature.fadeIn(newAnim, 0, 0)
        }

        p.currentAnim = newAnim
      }
    })

    return () => app.current.destroy(true, { children: true })
  }, [])

  useEffect(() => {
    if (!socket.current || !app.current || !cameraContainer.current || !user) return
    setupSocketHandlers({
      socket: socket.current,
      app: app.current,
      playersRef: localRef,
      stage: cameraContainer.current,
      user,
      setPlayerCount,
      updateMyXP,
    })
  }, [socket.current, app.current, cameraContainer.current, user])

  useEffect(() => {
    load7TVEmotes()
  }, [])

  if (!user) return null

  return (
    <>
      <div ref={pixiContainer} style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 10 }} />
      <GameUI
        key={`ui-${myXP}-${myLevel}`}
        avatar={user.avatar}
        username={user.username}
        playerCount={playerCount}
        onLogout={logout}
      />
    <VideoScreen cameraRef={cameraContainer} />
    </>
  )
}
