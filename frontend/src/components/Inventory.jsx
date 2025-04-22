import React from 'react'
import { usePlayer } from '../context/PlayerContext'
import './Inventory.css'

export default function Inventory() {
  const { myUnlocks, showInventory, toggleInventory, equipped, equipItem } = usePlayer()

  if (!showInventory) return null

  // Définition des catégories dans l'ordre souhaité
  const categories = [
    { key: 'emote',      label: 'Émotes' },
    { key: 'cosmetic',   label: 'Cosmétiques' },
    { key: 'effect',     label: 'Effets de traînée' },
    { key: 'pet',        label: 'Animal de compagnie' },
    { key: 'chatBubble', label: 'Bulles de chat' }
  ]

  return (
    <div className="inventory-overlay">
      <div className="inventory-modal">
        <button className="inventory-close" onClick={toggleInventory} aria-label="Fermer l\'inventaire">×</button>
        <h2>Inventaire</h2>
        {categories.map(cat => {
          const items = myUnlocks.filter(u => u.type === cat.key)
          if (items.length === 0) return null
          return (
            <section key={cat.key} className="inventory-section">
              <h3>{cat.label}</h3>
              <div className="inventory-items">
                {items.map(item => (
                  <div key={item.id} className="inventory-item">
                    <span className="item-name">{item.id}</span>
                    <button
                      className="item-equip-btn"
                      onClick={() => equipItem(item.type, item.id)}
                      disabled={equipped[item.type] === item.id}
                    >
                      {equipped[item.type] === item.id ? 'Équipé' : 'Équiper'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
