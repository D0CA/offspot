import React, { useEffect, useState } from 'react'
import './Puissance4Modal.css'

export default function Puissance4Modal({ me, opponent, isFirstPlayer, socket, onClose }) {
  const emptyGrid = Array(6).fill(null).map(() => Array(7).fill(null)) // 6 rows, 7 columns
  const [grid, setGrid] = useState(emptyGrid)
  const [myTurn, setMyTurn] = useState(isFirstPlayer ?? false)
  const [winner, setWinner] = useState(undefined)
  const [rematchRequested, setRematchRequested] = useState(false)
  const [rematchCount, setRematchCount] = useState(0)
  const [hoverCol, setHoverCol] = useState(null)

  const myColor = isFirstPlayer ? 'red' : 'yellow'
  const opponentColor = myColor === 'red' ? 'yellow' : 'red'

  useEffect(() => {
    socket.on('puissance4-move', ({ column, row, symbol }) => {
      setGrid(prev => {
        const updated = prev.map(r => [...r])
        updated[row][column] = symbol
        return updated
      })
      if (symbol !== myColor) {
        setMyTurn(true)
      } else {
        setMyTurn(false)
      }
    })

    socket.on('puissance4-end', ({ winner }) => {
      setWinner(winner)
      setMyTurn(false)
    })

    socket.on('puissance4-close', ({ from }) => {
      if (from === opponent) onClose()
    })

    socket.on('puissance4-rematch-progress', ({ count }) => {
      setRematchCount(count)
    })

    socket.on('puissance4-rematch-confirmed', ({ from, starts }) => {
      setGrid(emptyGrid)
      setWinner(undefined)
      setRematchRequested(false)
      setRematchCount(0)
      setMyTurn(starts)
    })

    return () => {
      socket.off('puissance4-move')
      socket.off('puissance4-end')
      socket.off('puissance4-close')
      socket.off('puissance4-rematch-progress')
      socket.off('puissance4-rematch-confirmed')
    }
  }, [socket])

  const handleColumnClick = (colIdx) => {
    if (!myTurn || winner) return
    const rowIdx = findAvailableRow(colIdx)
    if (rowIdx === -1) return

    const updated = grid.map(r => [...r])
    updated[rowIdx][colIdx] = myColor
    setGrid(updated)
    setMyTurn(false)
    socket.emit('puissance4-move', { column: colIdx, symbol: myColor })
  }

  const findAvailableRow = (colIdx) => {
    for (let row = 5; row >= 0; row--) {
      if (!grid[row][colIdx]) return row
    }
    return -1
  }

  const restart = () => {
    setRematchRequested(true)
    socket.emit('puissance4-rematch-request', { opponent })
  }

  return (
    <div className="p4-modal">
      <div className="p4-box">
        <div className="p4-header">
          <span>{me} VS {opponent}</span>
          <button onClick={() => {
            socket.emit('puissance4-close', { opponent })
            onClose()
          }}>✕</button>
        </div>
        <div className="p4-turn">
          {winner
            ? (winner?.toLowerCase() === me.toLowerCase()
              ? '🏆 Tu as gagné !'
              : winner?.toLowerCase() === opponent.toLowerCase()
                ? '😞 Tu as perdu'
                : 'Match nul !')
            : myTurn
              ? '👉 À toi de jouer'
              : '⏳ Attente de l\'adversaire'}
        </div>
        <div className="p4-grid">
          {grid.map((row, rowIndex) => (
            <div className="p4-row" key={rowIndex}>
              {row.map((cell, colIndex) => {
                const isPreview = myTurn && !winner && hoverCol === colIndex && findAvailableRow(colIndex) === rowIndex
                return (
                  <div
                    key={colIndex}
                    className={`p4-cell ${cell || ''} ${isPreview ? 'preview' : ''}`}
                    onClick={() => handleColumnClick(colIndex)}
                    onMouseEnter={() => setHoverCol(colIndex)}
                    onMouseLeave={() => setHoverCol(null)}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {winner !== undefined && (
          <div className="morpion-actions">
            <button onClick={restart} disabled={rematchRequested}>
              🔄 Rejouer {rematchCount}/2
            </button>
            <button onClick={() => {
              socket.emit('puissance4-close', { opponent })
              onClose()
            }}>
              🚪 Quitter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
