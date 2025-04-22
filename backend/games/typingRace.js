// backend/games/typingRace.js

const SAMPLE_TEXTS = [
    "Sous un ciel étoilé, les lucioles dansent au milieu de la prairie, égrainant de minuscules lueurs qui semblaient composer une symphonie silencieuse et magique.",
    "Une vague turquoise s'écrase doucement sur des galets polis, tandis qu'au loin les mouettes crient leur mélodie, saluant le retour éternel de l'océan.",
    "L'horloge du grand hall résonne chaque heure, faisant vibrer les toiles anciennes et réveillant les souvenirs enfouis dans les couloirs silencieux du château.",
    "La forêt enneigée craquait sous mes pas ; chaque flocon brillant au soleil créait un monde immaculé, où seuls les chuchotements du vent troublaient la quiétude.",
    "Au sommet de la montagne, le panorama s'ouvrait sur une mer de nuages dorés, baignés par les premiers rayons du soleil, promesse d'une journée nouvelle.",
    "Le chat tigré somnolait sur le rebord de la fenêtre, ses moustaches frémissant légèrement au rythme des passants que le crépuscule colorait d'ombres allongées.",
    "À la lueur vacillante des bougies, la vieille bibliothèque dévoilait ses secrets : reliures usées, parchemins oubliés et pages jaunies racontant des histoires millénaires.",
    "Une pluie légère tombait sur la ville silencieuse ; les pavés miroitaient comme un miroir d'étoiles, guidant les rares passants vers un café chaleureux et fumant.",
    "Le parfum des fleurs de cerisier flottait dans l'air printanier, évoquant l'éphémère beauté de la vie et invitant chaque cœur à savourer l'instant présent.",
    "Une mélodie de piano s'échappait de l'appartement voisin, emplissant le couloir d'accords mélancoliques qui semblaient raconter les rêves et les peines d'une âme solitaire.",
    "Clu3tiK, capitaine intrépide du collectif Chat Off, voguait sur l'océan virtuel, brandissant son drapeau aux couleurs de One Piece, rêvant d'îles fantastiques et de trésors légendaires."
];
  
// Retourne un texte aléatoire depuis SAMPLE_TEXTS et normalise les espaces
function pickText() {
  const idx = Math.floor(Math.random() * SAMPLE_TEXTS.length);
  return SAMPLE_TEXTS[idx];
}
  
function handleTypingRaceSockets(io, socket, activeGames, socketIdToUsername, usernameToSocketId) {
  socket.on('challenge-accept', ({ challenger, game }) => {
    if (game !== 'typingRace') return;
    const me = socketIdToUsername[socket.id];
    const challengerSid = usernameToSocketId[challenger.toLowerCase()];
    if (!challengerSid || !me) return;
  
    const key = [challengerSid, socket.id].sort().join(':');
    const rawText = pickText();
    // Remplace les espaces insécables par des espaces normaux
    const text = rawText.replace(/\u00A0/g, ' ');
    
    const gameObj = {
      sockets: [challengerSid, socket.id],
      text,
      progress: { [challengerSid]: 0, [socket.id]: 0 },
      startTime: Date.now(),
      type: 'typingRace'
    };
    activeGames.set(key, gameObj);
  
    // Démarrage avec texte normalisé
    io.to(challengerSid).emit('typingRace-start', { text, opponent: me });
    io.to(socket.id).emit('typingRace-start', { text, opponent: challenger });
  });
  
  // MàJ du typed
  socket.on('typingRace-progress', ({ typed }) => {
    const sid = socket.id;
    const key = [...activeGames.keys()].find(k => k.includes(sid));
    if (!key) return;
  
    const game = activeGames.get(key);
    // Compare le typed au texte normalisé
    const normalizedText = game.text;
    const correctCount = Array.from(typed).reduce((count, c, i) => (
      normalizedText[i] === c ? count + 1 : count
    ), 0);
    game.progress[sid] = correctCount;
  
    // broadcast progress
    const username = socketIdToUsername[sid];
    io.to(game.sockets[0]).emit('typingRace-progress', { username, correctCount });
    io.to(game.sockets[1]).emit('typingRace-progress', { username, correctCount });
  
    // si fini
    if (correctCount === normalizedText.length) {
      const duration = Date.now() - game.startTime;
      const winner = username;
      io.to(game.sockets[0]).emit('typingRace-end', { winner, time: duration });
      io.to(game.sockets[1]).emit('typingRace-end', { winner, time: duration });
      activeGames.delete(key);
    }
  });
  
  // Abandon
  socket.on('typingRace-close', ({ opponent }) => {
    const to = usernameToSocketId[opponent.toLowerCase()];
    if (to) io.to(to).emit('typingRace-close', { from: socketIdToUsername[socket.id] });
    const key = [...activeGames.keys()].find(k => k.includes(socket.id));
    if (key) activeGames.delete(key);
  });
}
  
module.exports = { handleTypingRaceSockets };
