// backend/games/morpion.js

function handleMorpionSockets(io, activeGames, rematchQueue, socketIdToUsername, usernameToSocketId, socket) {
    socket.on('challenge-accept', ({ challenger, game }) => {
      if (game !== 'morpion') return
  
      const challenged = socketIdToUsername[socket.id]
      const challengerSocketId = usernameToSocketId[challenger.toLowerCase()]
      const challengedSocketId = socket.id
  
      if (!challengerSocketId || !challenged) return
  
      const key = [challengerSocketId, challengedSocketId].sort().join(':')
      const firstStarts = Math.random() < 0.5
  
      activeGames.set(key, {
        sockets: [challengerSocketId, challengedSocketId],
        players: {
          [challengerSocketId]: firstStarts ? 'X' : 'O',
          [challengedSocketId]: firstStarts ? 'O' : 'X'
        },
        grid: Array(9).fill(null),
        moves: 0
      })
  
      io.to(challengerSocketId).emit('morpion-start', {
        opponent: challenged,
        isFirstPlayer: firstStarts
      })
  
      io.to(challengedSocketId).emit('morpion-start', {
        opponent: challenger,
        isFirstPlayer: !firstStarts
      })
    })
  
    socket.on('morpion-move', ({ index }) => {
      const player = socket.id
      const opponent = Object.keys(socketIdToUsername).find(sid => sid !== player && activeGames.has([sid, player].sort().join(':')))
      if (!opponent) return
  
      const key = [player, opponent].sort().join(':')
      const game = activeGames.get(key)
      if (!game || game.grid[index]) return
  
      const symbol = game.players[player]
      game.grid[index] = symbol
      game.moves++
  
      game.sockets.forEach(sid => {
        io.to(sid).emit('morpion-move', { index, symbol })
      })
  
      const g = game.grid
      const winningCombos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
      let winnerSymbol = null
  
      for (const [a, b, c] of winningCombos) {
        if (g[a] && g[a] === g[b] && g[a] === g[c]) {
          winnerSymbol = g[a]
          break
        }
      }
  
      const isDraw = !winnerSymbol && game.grid.every(cell => cell !== null)
  
      if (winnerSymbol || isDraw) {
        let winnerSocketId = null
        if (winnerSymbol) {
          winnerSocketId = Object.entries(game.players).find(([sid, sym]) => sym === winnerSymbol)?.[0]
        }
  
        const winnerName = winnerSymbol ? socketIdToUsername[winnerSocketId] : null
  
        game.sockets.forEach(sid => {
          io.to(sid).emit('morpion-end', { winner: winnerSymbol ? winnerName : null })
        })
  
        activeGames.delete(key)
      }
    })
  
    socket.on('morpion-rematch-request', ({ opponent }) => {
      const from = socketIdToUsername[socket.id]
      const toSocketId = usernameToSocketId[opponent.toLowerCase()]
      const rematchKey = [from, opponent.toLowerCase()].sort().join(':')
  
      if (!rematchQueue.has(rematchKey)) {
        rematchQueue.set(rematchKey, [from])
      } else {
        const existing = rematchQueue.get(rematchKey)
        if (!existing.includes(from)) {
          rematchQueue.set(rematchKey, [...existing, from])
        }
      }
  
      const current = rematchQueue.get(rematchKey)
  
      ;[from, opponent.toLowerCase()].forEach(username => {
        const sid = usernameToSocketId[username]
        if (sid) {
          io.to(sid).emit('morpion-rematch-progress', { count: current.length })
        }
      })
  
      if (current.length === 2) {
        rematchQueue.delete(rematchKey)
  
        const challengerSocket = usernameToSocketId[current[0].toLowerCase()]
        const opponentSocket = usernameToSocketId[current[1].toLowerCase()]
        const gameKey = [challengerSocket, opponentSocket].sort().join(':')
        const firstStarts = Math.random() < 0.5
  
        activeGames.set(gameKey, {
          sockets: [challengerSocket, opponentSocket],
          players: {
            [challengerSocket]: firstStarts ? 'X' : 'O',
            [opponentSocket]: firstStarts ? 'O' : 'X'
          },
          grid: Array(9).fill(null),
          moves: 0
        })
  
        io.to(challengerSocket).emit('morpion-rematch-confirmed', {
          from: current[1],
          starts: firstStarts
        })
  
        io.to(opponentSocket).emit('morpion-rematch-confirmed', {
          from: current[0],
          starts: !firstStarts
        })
  
        io.to(challengerSocket).emit('morpion-start', {
          opponent: current[1],
          isFirstPlayer: firstStarts
        })
  
        io.to(opponentSocket).emit('morpion-start', {
          opponent: current[0],
          isFirstPlayer: !firstStarts
        })
      }
    })
  
    socket.on('morpion-close', ({ opponent }) => {
      const toSocketId = usernameToSocketId[opponent.toLowerCase()]
      if (toSocketId) {
        io.to(toSocketId).emit('morpion-close', { from: socketIdToUsername[socket.id] })
      }
    })
  }
  
  module.exports = { handleMorpionSockets }
  