import React from 'react'
import './LoginScreen.css'
import { getBackendURL } from '../utils/env'

const twitchClientId = import.meta.env.VITE_TWITCH_CLIENT_ID
const backendURL = getBackendURL()

const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${twitchClientId}&redirect_uri=${encodeURIComponent(
  `${backendURL}/auth/twitch/callback`
)}&response_type=code&scope=chat:read+chat:edit&force_verify=true`

console.log('backendURL (detected):', backendURL)

export default function LoginScreen() {
  return (
    <div className="login-screen">
      <img src="/favicon.png" alt="OffSpot Logo" className="login-logo" />
      <h1 className="login-title">Bienvenue sur OffSpot</h1>
      <p className="login-subtitle">Rejoins le monde sous les étoiles 🌙</p>
      <a href={twitchAuthUrl} className="login-button">
        🎬 Se connecter avec Twitch
      </a>
    </div>
  )
}
