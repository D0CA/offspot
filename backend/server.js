// backend/server.js
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { Server } = require('socket.io')
const http = require('http')
const tmi = require('tmi.js')
const { doc, setDoc, getDoc, updateDoc, arrayUnion } = require('firebase/firestore')
const { db } = require('./firebase')
const mapConfig = require('./mapConfigServer')
const { computeLevel, getUnlocksForLevel } = require('./utils/leveling')
const { handlePuissance4Sockets } = require('./games/puissance4')
const { handleMorpionSockets } = require('./games/morpion')
const { handleTypingRaceSockets } = require('./games/typingRace');

const app = express()
app.use(cors())
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

let players = {}
let socketIdToUsername = {}
let usernameToSocketId = {}
let messageHistory = {}
let videoQueue = []
let currentVideo = null
let videoStartTime = null
const rematchQueue = new Map()
const activeGames = new Map()

const CLIENT_ID = process.env.TWITCH_CLIENT_ID
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET
const REDIRECT_URI = process.env.TWITCH_REDIRECT_URI
const TWITCH_CHANNEL = process.env.TWITCH_CHANNEL
const BOT_USERNAME = process.env.BOT_USERNAME
const BOT_OAUTH = process.env.BOT_OAUTH

// === TWITCH AUTH ===
app.get('/auth/twitch', (req, res) => {
  const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=user:read:email`
  res.redirect(twitchAuthUrl)
})

app.get('/auth/twitch/callback', async (req, res) => {
  const { code } = req.query

  try {
    const tokenRes = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      }
    })

    const access_token = tokenRes.data.access_token

    const userRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Client-Id': CLIENT_ID
      }
    })

    const user = userRes.data.data[0]

    res.redirect(`${process.env.FRONTEND_URL}/auth-success?username=${user.display_name}&avatar=${encodeURIComponent(user.profile_image_url)}&id=${user.id}`)
  } catch (err) {
    console.error(err)
    res.status(500).send('Erreur lors de l’authentification Twitch')
  }
})

// === SOCKET.IO ===
function playNextVideo() {
  if (videoQueue.length === 0) {
    currentVideo = null
    videoStartTime = null
    io.emit('clear-video')
    io.emit('video-queue', videoQueue)
    return
  }

  currentVideo = videoQueue.shift()
  videoStartTime = Date.now()

  io.emit('play-video', { url: currentVideo.url, startTime: videoStartTime })
  io.emit('video-queue', videoQueue)
}

io.on('connection', (socket) => {
  console.log('✅ Connecté:', socket.id)
  socket.on('recover-session', ({ username }) => {
    const key = username.toLowerCase();
    // Mettre à jour les mappages
    socketIdToUsername[socket.id] = key;
    usernameToSocketId[key] = socket.id;

    // Pour chaque partie active, remplacer l’ancien socket.id par le nouveau
    for (const [gameKey, game] of activeGames.entries()) {
      const idx = game.sockets.findIndex(oldSid => socketIdToUsername[oldSid] === key);
      if (idx !== -1) {
        const oldSid = game.sockets[idx];
        game.sockets[idx] = socket.id;
        game.players[socket.id] = game.players[oldSid];
        delete game.players[oldSid];
      }
      if (game.sockets.includes(socket.id)) {
        const otherSid = game.sockets.find(sid => sid !== socket.id);
        const opponent = socketIdToUsername[otherSid];
        // On renvoie l'état en fonction du type
        if (game.type === 'morpion') {
          socket.emit('morpion-state', {
            opponent,
            grid: game.grid,
            players: {
              [username]: game.players[socket.id],
              [opponent]: game.players[otherSid]
            },
            isMyTurn: game.turn === socket.id
          });
        } else if (game.type === 'puissance4') {
          socket.emit('puissance4-state', {
            opponent,
            grid: game.grid,
            players: {
              [username]: game.players[socket.id],
              [opponent]: game.players[otherSid]
            },
            isMyTurn: game.turn === socket.id
          });
        }
      }
    }
  });

  socket.on('new-player', async (data) => {
    const { username, avatar, id } = data

    const isValidUsername = typeof username === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(username)
    const isValidAvatar = typeof avatar === 'string' && avatar.startsWith('https://')
    const isValidId = typeof id === 'string' && id.length > 2

    if (!isValidUsername || !isValidAvatar || !isValidId) {
      console.warn('[🚨] Données utilisateur invalides reçues de', socket.id, data)
      socket.disconnect()
      return
    }

    const key = username.toLowerCase()
    const userRef = doc(db, 'players', key)
    const docSnap = await getDoc(userRef)

    let xp = 0
    if (docSnap.exists()) {
      xp = docSnap.data().xp || 0
    } else {
      await setDoc(userRef, { xp: 0, avatar, username: key })
    }

    // Récupère les unlocks déjà débloqués en base
    const existingUnlocks = docSnap.exists() ? docSnap.data().unlocks || [] : []

    const { level, requiredXP, currentXP } = computeLevel(xp)

    const playerData = {
      x: mapConfig.spawn.x,
      y: mapConfig.spawn.y,
      avatar,
      username,
      id,
      xp,
      level,
      requiredXP,
      unlocks: existingUnlocks
    }

    players[key] = playerData
    socketIdToUsername[socket.id] = key
    usernameToSocketId[key] = socket.id

    socket.emit('player-data', playerData)

    setTimeout(() => {
      socket.emit('update-players', players)
      socket.broadcast.emit('update-players', players)
    }, 100)

    console.log(`[✅] Connexion de ${username} (${id})`)
  })

  socket.on('move', ({ x, y }) => {
    const key = socketIdToUsername[socket.id]
    if (players[key]) {
      players[key].x = x
      players[key].y = y
      socket.broadcast.emit('update-players', players)
    }
  })

  socket.on('submit-video', ({ url, username }) => {
    const isValidYouTubeUrl = (url) => {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/)
      return !!match && match[1].length === 11
    }

    if (!url || typeof url !== 'string') return
    if (!isValidYouTubeUrl(url)) return

    const videoData = { url, username: username || 'Anonyme' }
    if (videoQueue.some(v => v.url === url)) return
    videoQueue.push(videoData)
    io.emit('video-queue', videoQueue)

    if (!currentVideo) playNextVideo()
  })

  socket.on('get-video-queue', () => {
    socket.emit('video-queue', videoQueue)
  })

  socket.on('skip-video', () => {
    playNextVideo()
  })

  socket.on('get-current-video', () => {
    if (currentVideo && videoStartTime) {
      socket.emit('play-video', {
        url: currentVideo.url,
        startTime: videoStartTime
      })
    }
  })

  socket.on('video-sync-request', ({ clientSendTime }) => {
    socket.emit('video-sync-response', {
      clientSendTime,
      serverTime: Date.now(),
      serverVideoStartTime: videoStartTime
    })
  })

  socket.on('start-challenge', ({ type, targetUsername }) => {
    const challenger = socketIdToUsername[socket.id];
    const to = usernameToSocketId[targetUsername.toLowerCase()];
    if (challenger && to) io.to(to).emit('challenge-request', { challenger, game: type });
  });

  handleMorpionSockets(io, activeGames, rematchQueue, socketIdToUsername, usernameToSocketId, socket);
  handlePuissance4Sockets(io, socket, activeGames, socketIdToUsername, usernameToSocketId, rematchQueue);
  handleTypingRaceSockets(io, socket, activeGames, socketIdToUsername, usernameToSocketId);

  socket.on('puissance4-close', ({ opponent }) => {
    const toSocketId = usernameToSocketId[opponent.toLowerCase()]
    if (toSocketId) {
      io.to(toSocketId).emit('puissance4-close', { from: socketIdToUsername[socket.id] })
    }
  })

  socket.on('disconnect', () => {
    // 1) On prévient l’adversaire que le joueur a quitté
    for (const [gameKey, game] of activeGames.entries()) {
      if (game.sockets.includes(socket.id)) {
        const otherSid = game.sockets.find(sid => sid !== socket.id);
        if (otherSid) {
          // type vaut 'morpion' ou 'puissance4' selon le jeu
          const type = game.type || 'morpion';
          io.to(otherSid).emit(`${type}-close`, {
            from: socketIdToUsername[socket.id]
          });
        }
        // on supprime la partie
        activeGames.delete(gameKey);
      }
    }
  
    // 2) On nettoie le joueur de la liste générale
    const key = socketIdToUsername[socket.id];
    delete players[key];
    delete socketIdToUsername[socket.id];
    io.emit('update-players', players);
  });
  

  socket.on('remove-player', () => {
    const key = socketIdToUsername[socket.id]
    delete players[key]
    delete socketIdToUsername[socket.id]
    io.emit('update-players', players)
  })
})

// === TWITCH CHAT LISTENER ===
const twitchClient = new tmi.Client({
  options: { debug: true },
  identity: { username: BOT_USERNAME, password: BOT_OAUTH },
  channels: [TWITCH_CHANNEL]
})

twitchClient.connect()

twitchClient.on('message', async (channel, tags, message, self) => {
  if (self) return

  const username = tags['display-name']
  const key = username.toLowerCase()
  const userID = tags['user-id']

  if (!players[key]) return

  if (!messageHistory[userID]) messageHistory[userID] = []
  const history = messageHistory[userID]
  const isOriginal = !history.includes(message)

  messageHistory[userID].push(message)
  if (messageHistory[userID].length > 2) messageHistory[userID].shift()

  const userRef = doc(db, 'players', key)
  let xpGained = 0
  let totalXP = 0
  let previousLevel = players[key].level || 1

  const docSnap = await getDoc(userRef)
  if (isOriginal) {
    xpGained = 10
    if (docSnap.exists()) {
      const existingXP = docSnap.data().xp || 0
      totalXP = existingXP + xpGained
      await updateDoc(userRef, { xp: totalXP })
    } else {
      totalXP = xpGained
      await setDoc(userRef, { xp: totalXP })
    }
  } else {
    if (docSnap.exists()) totalXP = docSnap.data().xp || 0
  }

  const { level, requiredXP: xpForCurrentLevel, currentXP: currentLevelXP } = computeLevel(totalXP)

  if (level > previousLevel) {
    const unlocks = getUnlocksForLevel(level)
    const sid = usernameToSocketId[key]
    if (sid && unlocks.length) {
      // 1) Enregistre en base les nouveaux unlocks (sans doublons)
      await updateDoc(userRef, { unlocks: arrayUnion(...unlocks) })
      // 2) Notifie le client
      io.to(sid).emit('levelUpUnlock', { level, unlocks })
    }
  }  

  if (players[key]) {
    players[key].xp = totalXP
    players[key].level = level
    players[key].requiredXP = xpForCurrentLevel
  }

  io.emit('chat-message', {
    username,
    message,
    xpGained,
    level,
    currentXP: currentLevelXP,
    requiredXP: xpForCurrentLevel,
    totalXP,
    socketId: usernameToSocketId[key] || null
  })
})

server.listen(4000, () => {
  console.log('✅ Server running at http://localhost:4000')
})