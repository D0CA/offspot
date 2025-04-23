import React, { useState } from 'react'
import './SecurityInfo.css'

export default function SecurityInfo() {
  const [open, setOpen] = useState(false)

  return (
    <div className="security-info-container">
      <button onClick={() => setOpen(!open)} className="security-toggle">
        {open ? '🔒 Quelles données sont récupérées ? ▼' : '🔒 Quelles données sont récupérées ? ►'}
      </button>
      {open && (
        <div className="security-details">
          <h3>Quelles données sont récupérées ?</h3>
          <ul>
            <li>✅ votre <strong>pseudo Twitch</strong></li>
            <li>✅ votre <strong>avatar public</strong></li>
            <li>✅ un <strong>identifiant interne Twitch (ID utilisateur)</strong><br />
            <span className="security-subnote">
            — un simple numéro attribué par Twitch, utilisé uniquement pour votre progression dans le jeu.<br />
            🔒 Cet identifiant ne donne aucun accès à votre compte.
            </span></li>
          </ul>
          <p>Ces données sont utilisées uniquement pour vous afficher dans le jeu et suivre votre progression (XP, niveau, etc.).</p>

          <h3>Quelles données ne sont pas récupérées ?</h3>
          <ul>
            <li>❌ votre mot de passe</li>
            <li>❌ votre email</li>
            <li>❌ vos abonnements, streams ou messages privés</li>
            <li>❌ aucune permission pour agir en votre nom</li>
          </ul>

          <h3>Comment ça marche ?</h3>
          <p>
            OffSpot utilise l’authentification officielle de Twitch (OAuth 2.0). Vous êtes redirigé vers Twitch pour vous connecter,
            et jamais vos identifiants ne passent par nos serveurs.
          </p>
          <p>🔐 Vous pouvez révoquer cet accès à tout moment depuis vos <a href="https://www.twitch.tv/settings/connections" target="_blank" rel="noreferrer">paramètres Twitch</a>.</p>
        </div>
      )}
    </div>
  )
}
