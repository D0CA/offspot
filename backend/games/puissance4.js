// backend/games/puissance4.js

/**
 * Vérifie si la grille contient 4 jetons alignés pour un symbole donné.
 * @param {Array<Array<string|null>>} grid - Grille 6x7 du jeu.
 * @param {string} symbol - Symbole à vérifier ('red' ou 'yellow').
 * @returns {boolean} - true si le symbole gagne, sinon false.
 */
function checkWinner(grid, symbol) {
  const rows = 6;
  const cols = 7;

  // Horizontal
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      if (
        grid[r][c] === symbol &&
        grid[r][c + 1] === symbol &&
        grid[r][c + 2] === symbol &&
        grid[r][c + 3] === symbol
      ) {
        return true;
      }
    }
  }

  // Vertical
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r <= rows - 4; r++) {
      if (
        grid[r][c] === symbol &&
        grid[r + 1][c] === symbol &&
        grid[r + 2][c] === symbol &&
        grid[r + 3][c] === symbol
      ) {
        return true;
      }
    }
  }

  // Diagonale ↘
  for (let r = 0; r <= rows - 4; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      if (
        grid[r][c] === symbol &&
        grid[r + 1][c + 1] === symbol &&
        grid[r + 2][c + 2] === symbol &&
        grid[r + 3][c + 3] === symbol
      ) {
        return true;
      }
    }
  }

  // Diagonale ↗
  for (let r = 3; r < rows; r++) {
    for (let c = 0; c <= cols - 4; c++) {
      if (
        grid[r][c] === symbol &&
        grid[r - 1][c + 1] === symbol &&
        grid[r - 2][c + 2] === symbol &&
        grid[r - 3][c + 3] === symbol
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Attache tous les handlers Socket.IO pour le jeu Puissance 4.
 * @param {import('socket.io').Server} io - Instance Socket.IO serveur.
 * @param {import('socket.io').Socket} socket - Socket du client.
 * @param {Map<string, any>} activeGames - Parties actives.
 * @param {Object} socketIdToUsername - socket.id → username.
 * @param {Object} usernameToSocketId - username → socket.id.
 * @param {Map<string, string[]>} rematchQueue - File des rematchs.
 */
function handlePuissance4Sockets(
  io,
  socket,
  activeGames,
  socketIdToUsername,
  usernameToSocketId,
  rematchQueue
) {
  socket.on('challenge-accept', ({ challenger, game }) => {
    if (game !== 'puissance4') return;
    const challenged = socketIdToUsername[socket.id];
    const challengerSocketId = usernameToSocketId[challenger.toLowerCase()];
    if (!challenged || !challengerSocketId) return;

    const gameKey = [challengerSocketId, socket.id].sort().join(':');
    const firstStarts = Math.random() < 0.5;
    const sockets = [challengerSocketId, socket.id];
    const players = {
      [challengerSocketId]: firstStarts ? 'red' : 'yellow',
      [socket.id]: firstStarts ? 'yellow' : 'red'
    };
    const grid = Array(6).fill(null).map(() => Array(7).fill(null));

    activeGames.set(gameKey, { sockets, players, grid, moves: 0, turn: firstStarts ? challengerSocketId : socket.id });
    io.to(challengerSocketId).emit('puissance4-start', { opponent: challenged, isFirstPlayer: firstStarts });
    io.to(socket.id).emit('puissance4-start', { opponent: challenger, isFirstPlayer: !firstStarts });
  });

  socket.on('puissance4-move', ({ column, symbol }) => {
    const player = socket.id;
    const gameKey = [...activeGames.keys()].find(k => k.includes(player));
    if (!gameKey) return;
    const game = activeGames.get(gameKey);
    if (game.turn !== player) return;

    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (!game.grid[r][column]) { row = r; break; }
    }
    if (row < 0) return;

    game.grid[row][column] = symbol;
    game.moves++;
    game.sockets.forEach(sid => io.to(sid).emit('puissance4-move', { column, row, symbol }));

    if (checkWinner(game.grid, symbol)) {
      const winnerName = socketIdToUsername[player];
      game.sockets.forEach(sid => io.to(sid).emit('puissance4-end', { winner: winnerName }));
      activeGames.delete(gameKey);
    } else if (game.moves === 42) {
      game.sockets.forEach(sid => io.to(sid).emit('puissance4-end', { winner: null }));
      activeGames.delete(gameKey);
    } else {
      game.turn = game.sockets.find(sid => sid !== player);
    }
  });

  // Mise à jour du rematch pour les DEUX joueurs
  socket.on('puissance4-rematch-request', ({ opponent }) => {
    const from = socketIdToUsername[socket.id];
    const key = [from, opponent.toLowerCase()].sort().join(':');
    const arr = rematchQueue.get(key) || [];
    if (!arr.includes(from)) rematchQueue.set(key, [...arr, from]);

    const current = rematchQueue.get(key);
    // On notifie toujours les deux participants
    [from, opponent.toLowerCase()].forEach(u => {
      const sid = usernameToSocketId[u];
      if (sid) io.to(sid).emit('puissance4-rematch-progress', { count: current.length });
    });

    if (current.length === 2) {
      rematchQueue.delete(key);
      const [u1, u2] = current;
      const s1 = usernameToSocketId[u1], s2 = usernameToSocketId[u2];
      const gk = [s1, s2].sort().join(':');
      const firstStarts = Math.random() < 0.5;
      const sockets = [s1, s2];
      const players = {
        [s1]: firstStarts ? 'red' : 'yellow',
        [s2]: firstStarts ? 'yellow' : 'red'
      };
      const grid = Array(6).fill(null).map(() => Array(7).fill(null));
      activeGames.set(gk, { sockets, players, grid, moves: 0, turn: firstStarts ? s1 : s2 });

      io.to(s1).emit('puissance4-rematch-confirmed', { from: u2, starts: firstStarts });
      io.to(s2).emit('puissance4-rematch-confirmed', { from: u1, starts: !firstStarts });
      io.to(s1).emit('puissance4-start', { opponent: u2, isFirstPlayer: firstStarts });
      io.to(s2).emit('puissance4-start', { opponent: u1, isFirstPlayer: !firstStarts });
    }
  });

  socket.on('puissance4-close', ({ opponent }) => {
    const to = usernameToSocketId[opponent.toLowerCase()];
    if (to) io.to(to).emit('puissance4-close', { from: socketIdToUsername[socket.id] });
  });
}

module.exports = { handlePuissance4Sockets };