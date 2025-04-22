function checkWinner(grid, symbol) {
    const rows = 6
    const cols = 7
  
    // Horizontal
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (grid[r][c] === symbol && grid[r][c+1] === symbol && grid[r][c+2] === symbol && grid[r][c+3] === symbol) {
          return true
        }
      }
    }
  
    // Vertical
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r <= rows - 4; r++) {
        if (grid[r][c] === symbol && grid[r+1][c] === symbol && grid[r+2][c] === symbol && grid[r+3][c] === symbol) {
          return true
        }
      }
    }
  
    // Diagonal ↓→
    for (let r = 0; r <= rows - 4; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (grid[r][c] === symbol && grid[r+1][c+1] === symbol && grid[r+2][c+2] === symbol && grid[r+3][c+3] === symbol) {
          return true
        }
      }
    }
  
    // Diagonal ↑→
    for (let r = 3; r < rows; r++) {
      for (let c = 0; c <= cols - 4; c++) {
        if (grid[r][c] === symbol && grid[r-1][c+1] === symbol && grid[r-2][c+2] === symbol && grid[r-3][c+3] === symbol) {
          return true
        }
      }
    }
  
    return false
  }
  
  function handlePuissance4Sockets(io, activeGames, socketIdToUsername, usernameToSocketId) {
    const rematchQueue = new Map()
  
    io.on('connection', (socket) => {
      socket.on('challenge-accept', ({ challenger, game }) => {
        if (game !== 'puissance4') return
  
        const challenged = socketIdToUsername[socket.id]
        const challengerSocketId = usernameToSocketId[challenger.toLowerCase()]
        const challengedSocketId = socket.id
        const gameKey = [challengerSocketId, challengedSocketId].sort().join(':')
  
        const firstStarts = Math.random() < 0.5
        const sockets = [challengerSocketId, challengedSocketId]
        const players = {
          [challengerSocketId]: firstStarts ? 'red' : 'yellow',
          [challengedSocketId]: firstStarts ? 'yellow' : 'red'
        }
  
        const grid = Array(6).fill(null).map(() => Array(7).fill(null))
  
        activeGames.set(gameKey, {
          sockets,
          players,
          grid,
          moves: 0,
          turn: firstStarts ? challengerSocketId : challengedSocketId
        })
  
        io.to(challengerSocketId).emit('puissance4-start', {
          opponent: challenged,
          isFirstPlayer: firstStarts
        })
        io.to(challengedSocketId).emit('puissance4-start', {
          opponent: challenger,
          isFirstPlayer: !firstStarts
        })
      })
  
      socket.on('puissance4-move', ({ column, symbol }) => {
        const player = socket.id
        const opponent = Object.keys(socketIdToUsername).find(
          sid => sid !== player && activeGames.has([sid, player].sort().join(':'))
        )
        if (!opponent) return
  
        const key = [player, opponent].sort().join(':')
        const game = activeGames.get(key)
        if (!game || game.turn !== player) return
  
        let row = -1
        for (let r = 5; r >= 0; r--) {
          if (!game.grid[r][column]) {
            row = r
            break
          }
        }
        if (row === -1) return
  
        game.grid[row][column] = symbol
        game.moves++
  
        game.sockets.forEach(sid => {
          io.to(sid).emit('puissance4-move', { column, row, symbol })
        })
  
        if (checkWinner(game.grid, symbol)) {
          const winnerSocketId = player
          const winnerName = socketIdToUsername[winnerSocketId]
          game.sockets.forEach(sid => {
            io.to(sid).emit('puissance4-end', { winner: winnerName })
          })
          activeGames.delete(key)
        } else if (game.moves === 42) {
          game.sockets.forEach(sid => {
            io.to(sid).emit('puissance4-end', { winner: null })
          })
          activeGames.delete(key)
        } else {
          game.turn = opponent
        }
      })
  
      socket.on('puissance4-close', ({ opponent }) => {
        const toSocketId = usernameToSocketId[opponent.toLowerCase()]
        if (toSocketId) {
          io.to(toSocketId).emit('puissance4-close', { from: socketIdToUsername[socket.id] })
        }
      })
  
      socket.on('puissance4-rematch-request', ({ opponent }) => {
        const from = socketIdToUsername[socket.id]
        const toSocketId = usernameToSocketId[opponent.toLowerCase()]
        const key = [from, opponent.toLowerCase()].sort().join(':')
  
        if (!rematchQueue.has(key)) {
          rematchQueue.set(key, [from])
        } else {
          const current = rematchQueue.get(key)
          if (!current.includes(from)) {
            rematchQueue.set(key, [...current, from])
          }
        }
  
        const current = rematchQueue.get(key)
        const users = [from, opponent.toLowerCase()]
        users.forEach(u => {
          const sid = usernameToSocketId[u]
          if (sid) io.to(sid).emit('puissance4-rematch-progress', { count: current.length })
        })
  
        if (current.length === 2) {
          rematchQueue.delete(key)
  
          const challengerSocket = usernameToSocketId[current[0]]
          const opponentSocket = usernameToSocketId[current[1]]
          const gameKey = [challengerSocket, opponentSocket].sort().join(':')
          const firstStarts = Math.random() < 0.5
  
          const sockets = [challengerSocket, opponentSocket]
          const players = {
            [challengerSocket]: firstStarts ? 'red' : 'yellow',
            [opponentSocket]: firstStarts ? 'yellow' : 'red'
          }
          const grid = Array(6).fill(null).map(() => Array(7).fill(null))
  
          activeGames.set(gameKey, {
            sockets,
            players,
            grid,
            moves: 0,
            turn: firstStarts ? challengerSocket : opponentSocket
          })
  
          io.to(challengerSocket).emit('puissance4-rematch-confirmed', {
            from: current[1],
            starts: firstStarts
          })
  
          io.to(opponentSocket).emit('puissance4-rematch-confirmed', {
            from: current[0],
            starts: !firstStarts
          })
  
          io.to(challengerSocket).emit('puissance4-start', {
            opponent: current[1],
            isFirstPlayer: firstStarts
          })
  
          io.to(opponentSocket).emit('puissance4-start', {
            opponent: current[0],
            isFirstPlayer: !firstStarts
          })
        }
      })
    })
  }
  
  module.exports = { handlePuissance4Sockets }