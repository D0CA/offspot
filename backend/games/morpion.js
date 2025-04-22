// backend/games/morpion.js

/**
 * Attache tous les handlers Socket.IO pour le jeu Morpion,
 * en gardant trace du tour et du type de partie pour la reconnexion.
 */
function handleMorpionSockets(io, activeGames, rematchQueue, socketIdToUsername, usernameToSocketId, socket) {
  // Challenger accepte
  socket.on('challenge-accept', ({ challenger, game }) => {
    if (game !== 'morpion') return;
    const challenged = socketIdToUsername[socket.id];
    const challengerSocketId = usernameToSocketId[challenger.toLowerCase()];
    if (!challengerSocketId || !challenged) return;

    const key = [challengerSocketId, socket.id].sort().join(':');
    const firstStarts = Math.random() < 0.5;

    // On stocke turn et type
    activeGames.set(key, {
      sockets: [challengerSocketId, socket.id],
      players: {
        [challengerSocketId]: firstStarts ? 'X' : 'O',
        [socket.id]:           firstStarts ? 'O' : 'X',
      },
      grid: Array(9).fill(null),
      moves: 0,
      turn: firstStarts ? challengerSocketId : socket.id,
      type: 'morpion'
    });

    io.to(challengerSocketId).emit('morpion-start', {
      opponent: challenged,
      isFirstPlayer: firstStarts
    });
    io.to(socket.id).emit('morpion-start', {
      opponent: challenger,
      isFirstPlayer: !firstStarts
    });
  });

  // Coup joué
  socket.on('morpion-move', ({ index }) => {
    const player = socket.id;
    const opponent = Object.keys(socketIdToUsername)
      .find(sid => sid !== player && activeGames.has([sid, player].sort().join(':')));
    if (!opponent) return;

    const key = [player, opponent].sort().join(':');
    const game = activeGames.get(key);
    if (!game || game.grid[index]) return;

    const symbol = game.players[player];
    game.grid[index] = symbol;
    game.moves++;

    game.sockets.forEach(sid => io.to(sid).emit('morpion-move', { index, symbol }));

    // Vérification de victoire ou match nul
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winnerSymbol = null;
    for (const [a,b,c] of combos) {
      if (game.grid[a] && game.grid[a] === game.grid[b] && game.grid[a] === game.grid[c]) {
        winnerSymbol = game.grid[a];
        break;
      }
    }
    const isDraw = !winnerSymbol && game.grid.every(c => c !== null);

    if (winnerSymbol || isDraw) {
      const winnerName = winnerSymbol
        ? socketIdToUsername[ Object.entries(game.players).find(([sid,sym]) => sym===winnerSymbol)[0] ]
        : null;
      game.sockets.forEach(sid => io.to(sid).emit('morpion-end', { winner: winnerName }));
      activeGames.delete(key);
    }
  });

  // Rematch
  socket.on('morpion-rematch-request', ({ opponent }) => {
    const from = socketIdToUsername[socket.id];
    const rematchKey = [from, opponent.toLowerCase()].sort().join(':');
    const arr = rematchQueue.get(rematchKey) || [];
    if (!arr.includes(from)) arr.push(from);
    rematchQueue.set(rematchKey, arr);

    // Notifier les 2 joueurs
    [from, opponent.toLowerCase()].forEach(u => {
      const sid = usernameToSocketId[u];
      if (sid) io.to(sid).emit('morpion-rematch-progress', { count: arr.length });
    });

    if (arr.length === 2) {
      rematchQueue.delete(rematchKey);
      const [u1,u2] = arr;
      const s1 = usernameToSocketId[u1], s2 = usernameToSocketId[u2];
      const firstStarts = Math.random() < 0.5;
      const newKey = [s1,s2].sort().join(':');

      activeGames.set(newKey, {
        sockets: [s1,s2],
        players: {
          [s1]: firstStarts ? 'X' : 'O',
          [s2]: firstStarts ? 'O' : 'X'
        },
        grid: Array(9).fill(null),
        moves: 0,
        turn: firstStarts ? s1 : s2,
        type: 'morpion'
      });

      io.to(s1).emit('morpion-rematch-confirmed', { from: u2, starts: firstStarts });
      io.to(s2).emit('morpion-rematch-confirmed', { from: u1, starts: !firstStarts });
      io.to(s1).emit('morpion-start', { opponent: u2, isFirstPlayer: firstStarts });
      io.to(s2).emit('morpion-start', { opponent: u1, isFirstPlayer: !firstStarts });
    }
  });

  // Close
  socket.on('morpion-close', ({ opponent }) => {
    const to = usernameToSocketId[opponent.toLowerCase()];
    if (to) io.to(to).emit('morpion-close', { from: socketIdToUsername[socket.id] });
  });
}

module.exports = { handleMorpionSockets };