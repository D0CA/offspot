
import React, { useEffect, useState } from 'react'
import { usePlayer } from '../context/PlayerContext'
import './UnlocksPopup.css'

export default function UnlocksPopup() {
  const { myUnlocks } = usePlayer()
  const [visibleUnlocks, setVisibleUnlocks] = useState([])

  // Quand myUnlocks change, on les affiche puis on les fait disparaître
  useEffect(() => {
    if (myUnlocks.length === 0) return

    setVisibleUnlocks(myUnlocks)

    const timeout = setTimeout(() => {
      setVisibleUnlocks([])
    }, 5000) // 5s d’affichage

    return () => clearTimeout(timeout)
  }, [myUnlocks])

  if (visibleUnlocks.length === 0) return null

  return (
    <div className="unlocks-popup">
      {visibleUnlocks.map((u, i) => (
        <div key={`${u.type}-${u.id}-${i}`} className={`unlock-item unlock-${u.type}`}>
          {/* Ici tu peux remplacer par une icône ou une image selon u.type et u.id */}
          Nouveau {u.type} débloqué : <strong>{u.id}</strong>
        </div>
      ))}
    </div>
  )
}
