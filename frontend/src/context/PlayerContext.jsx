import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import { computeLevelFromXP } from '../utils/leveling'
import { io } from 'socket.io-client'
import { mapConfig } from '../constants/mapConfig'

const PlayerContext = createContext(null)

export function PlayerProvider({ children, user }) {
  const backendURL = import.meta.env.VITE_BACKEND_URL
  const socket = useRef(null)
  const playersRef = useRef({})
  const [socketId, setSocketId] = useState(null)

  const [myXP, setMyXP] = useState(0)
  const [myLevel, setMyLevel] = useState(1)
  const [currentXP, setCurrentXP] = useState(0)
  const [xpRequired, setXPRequired] = useState(120)

  // 🔁 pour forcer un re-render React sur update de niveau
  const [playerVersion, setPlayerVersion] = useState(0)

  const updateMyXP = (totalXP) => {
    const { level, currentLevelXP, xpRequired } = computeLevelFromXP(totalXP)

    setMyXP(totalXP)
    setMyLevel(level)
    setXPRequired(xpRequired)
    setCurrentXP(currentLevelXP)

    const key = user.username.toLowerCase()
    const player = playersRef.current[key]

    if (player) {
      player.level = level
      if (player.levelText) {
        player.levelText.text = `Niv ${level}`
      }
    }

    // 🔄 déclencher un re-render de l'UI React
    setPlayerVersion((v) => v + 1)
  }

  useEffect(() => {
    socket.current = io(backendURL)    

    socket.current.on('connect', () => {
      setSocketId(socket.current.id)

      socket.current.emit('new-player', {
        avatar: user.avatar,
        username: user.username,
        id: user.id,
        x: mapConfig.spawn.x,
        y: mapConfig.spawn.y,
      })
    })

    socket.current.on('player-data', (data) => {
      const xp = data.xp || 0
      const { level, currentLevelXP, xpRequired } = computeLevelFromXP(xp)

      setMyXP(xp)
      setMyLevel(level)
      setXPRequired(xpRequired)
      setCurrentXP(currentLevelXP)
    })

    return () => {
      socket.current.disconnect()
    }
  }, [user])

  const logout = () => {
    if (socket.current?.connected) {
      socket.current.emit('remove-player')
    }
    localStorage.removeItem('offspot-user')
    window.location.reload()
  }

  return (
    <PlayerContext.Provider
      value={{
        user,
        socket,
        socketId,
        playersRef,
        myXP,
        myLevel,
        currentXP,
        xpRequired,
        setMyXP,
        setMyLevel,
        setCurrentXP,
        setXPRequired,
        updateMyXP,
        logout,
        playerVersion, // 👈 facultatif, si tu veux observer les updates
        isMe: (id) => id === socketId,
        getMyKey: () => user.username.toLowerCase()
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
