import React from 'react'
import './LoginScreen.css'

export default function LoginScreen() {
  return (
    <div className="login-screen">
      <img src="/favicon.png" alt="OffSpot Logo" className="login-logo" />
      <h1 className="login-title">Bienvenue sur OffSpot</h1>
      <p className="login-subtitle">Rejoins le monde sous les étoiles 🌙</p>
      <a
        href="https://id.twitch.tv/oauth2/authorize?client_id=fojvopd0f2faz1c8cr5tkiutqixpv1&redirect_uri=http://localhost:4000/auth/twitch/callback&response_type=code&scope=user:read:email"
        className="login-button"
      >
        🎬 Se connecter avec Twitch
      </a>
    </div>
  )
}
