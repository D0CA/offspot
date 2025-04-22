import React, { useEffect, useState } from 'react'
import './MorpionModal.css'

export default function MorpionModal({ me, opponent, isFirstPlayer, socket, onClose }) {
  const [grid, setGrid] = useState(Array(9).fill(null))
  const [myTurn, setMyTurn] = useState(() => isFirstPlayer ?? false)
  const [winner, setWinner] = useState(undefined)
  const [gameOver, setGameOver] = useState(false)
  const [rematchRequested, setRematchRequested] = useState(false)
  const [rematchCount, setRematchCount] = useState(0)
  const [firstPlayer, setFirstPlayer] = useState(isFirstPlayer)

  const mySymbol = firstPlayer ? 'X' : 'O'
  const opponentSymbol = mySymbol === 'X' ? 'O' : 'X'

  useEffect(() => {
    socket.on('morpion-move', ({ index, symbol }) => {
      setGrid(prev => {
        const next = [...prev]
        next[index] = symbol
        return next
      })
      setMyTurn(symbol !== mySymbol)
    })

    socket.on('morpion-end', ({ winner }) => {
      setWinner(winner)
      setGameOver(true)
    })

    socket.on('morpion-rematch-request', ({ from }) => {
      if (from === opponent) {
      }
    })

    socket.on('morpion-rematch-progress', ({ count }) => {
      setRematchCount(count)
    })

    socket.on('morpion-rematch-confirmed', ({ from, starts }) => {
      setFirstPlayer(starts)
      setGrid(Array(9).fill(null))
      setWinner(undefined)
      setGameOver(false)
      setMyTurn(starts)
      setRematchRequested(false)
      setRematchCount(0)
    })

    socket.on('morpion-close', ({ from }) => {
      if (from === opponent) onClose()
    })

    return () => {
      socket.off('morpion-move')
      socket.off('morpion-end')
      socket.off('morpion-rematch-request')
      socket.off('morpion-rematch-confirmed')
      socket.off('morpion-close')
      socket.off('morpion-rematch-progress')
    }
  }, [socket, opponent, mySymbol])

  const handleClick = (index) => {
    if (!myTurn || grid[index] || winner !== undefined) return
    socket.emit('morpion-move', { index })
  }

  const renderCell = (i) => (
    <button className="cell" key={i} onClick={() => handleClick(i)}>
      {grid[i]}
    </button>
  )

  const restart = () => {
    setRematchRequested(true)
    socket.emit('morpion-rematch-request', { opponent })
  }

  return (
    <div className="morpion-modal">
      <div className="morpion-box">
        <div className="morpion-header">
          <span>{me} VS {opponent}</span>
          <button onClick={() => {
            socket.emit('morpion-close', { opponent })
            onClose()
          }}>✕</button>
        </div>
        <div className="turn-indicator">
          {winner === undefined ? (myTurn ? "👉 À toi de jouer" : "⏳ Attente de l'adversaire") : ''}
        </div>
        <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '12px' }}>
          Tu joues : <strong>{mySymbol}</strong>
        </div>
        <div className="morpion-grid">
          {grid.map((_, i) => renderCell(i))}
        </div>

        {gameOver && (
          <div className="morpion-winner">
            {winner === null
              ? 'Match nul !'
              : winner.toLowerCase() === me.toLowerCase()
                ? '🏆 Tu as gagné !'
                : winner.toLowerCase() === opponent.toLowerCase()
                  ? '😞 Tu as perdu'
                  : ''}
          </div>
        )}

        {gameOver && (
          <div className="morpion-actions">
            <button onClick={restart}>🔄 Rejouer {rematchCount}/2</button>
            <button onClick={() => {
              socket.emit('morpion-close', { opponent })
              onClose()
            }}>🚪 Quitter</button>
          </div>
        )}

      </div>
    </div>
  )
}