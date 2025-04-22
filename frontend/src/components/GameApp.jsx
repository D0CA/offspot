import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { PlayerProvider } from '../context/PlayerContext'
import GameScene from './GameScene'
import LoginScreen from './LoginScreen'
import UnlocksPopup from './UnlocksPopup'

export default function GameApp() {
  const { user } = useAuth()

  return user ? (
    <PlayerProvider user={user}>
      <>
        <GameScene />
        <UnlocksPopup />
      </>
    </PlayerProvider>
  ) : (
    <LoginScreen />
  )
}
