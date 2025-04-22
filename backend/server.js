require('dotenv').config()
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { Server } = require('socket.io')
const http = require('http')
const tmi = require('tmi.js')
const { doc, setDoc, getDoc, updateDoc } = require('firebase/firestore')
const { db } = require('./firebase')
const mapConfig = require('./mapConfigServer')

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

    let level = 1
    let requiredXP = 100
    let remainingXP = xp

    while (remainingXP >= requiredXP) {
      remainingXP -= requiredXP
      level++
      requiredXP = 100 + (level - 1) * 20
    }

    const playerData = {
      x: mapConfig.spawn.x,
      y: mapConfig.spawn.y,
      avatar,
      username,
      id,
      xp,
      level,
      requiredXP
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
  
    // 🔁 éviter les doublons
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

  // Ping‑pong pour synchronisation vidéo
  socket.on('video-sync-request', ({ clientSendTime }) => {
    socket.emit('video-sync-response', {
      clientSendTime,                      // renvoyé tel quel au client
      serverTime:       Date.now(),        // l’heure serveur à l’instant de la requête
      serverVideoStartTime: videoStartTime // la même valeur que dans play-video
    });
  });  

  socket.on('challenge-accept', ({ challenger, game }) => {
    const challenged = socketIdToUsername[socket.id]
    const challengerSocketId = usernameToSocketId[challenger.toLowerCase()]
    const challengedSocketId = socket.id
  
    if (!challengerSocketId || !challenged) return
  
    const key = [challengerSocketId, challengedSocketId].sort().join(':')
  
    if (game === 'morpion') {
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
    }
  })
  

  socket.on('start-challenge', ({ type, targetUsername }) => {
    const challenger = socketIdToUsername[socket.id] // déjà lowerCase côté serveur
    const targetSocketId = usernameToSocketId[targetUsername.toLowerCase()]
  
    console.log('[SERVER] start-challenge from', challenger, 'to', targetUsername)
    console.log('[DEBUG] usernameToSocketId =', usernameToSocketId)
    console.log('[DEBUG] targetUsername.toLowerCase() =', targetUsername.toLowerCase())
    console.log('[DEBUG] targetSocketId =', targetSocketId)
  
    if (!challenger || !targetSocketId || type !== 'morpion') return
  
    io.to(targetSocketId).emit('challenge-request', {
      challenger,
      game: type
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
    game.moves = (game.moves || 0) + 1
  
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
        winnerSocketId = Object.entries(game.players).find(([sid, sym]) => sym === winnerSymbol)?.[0] || null
      }
  
      const winnerName = winnerSymbol ? socketIdToUsername[winnerSocketId] : null
  
      game.sockets.forEach(sid => {
        io.to(sid).emit('morpion-end', { winner: winnerSymbol ? winnerName : null })
      })
  
      activeGames.delete(key)
    }
  })
  

const rematchStatus = new Map()

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

  // Notify both players with the updated count
  const involvedUsernames = [from, opponent.toLowerCase()]
  involvedUsernames.forEach(username => {
    const sid = usernameToSocketId[username]
    if (sid) {
      io.to(sid).emit('morpion-rematch-progress', { count: current.length })
    }
  })

  if (current.length === 2) {
    rematchQueue.delete(rematchKey)

    const challenger = current[0]
    const challenged = current[1]

    const challengerSocket = usernameToSocketId[challenger.toLowerCase()]
    const opponentSocket = usernameToSocketId[challenged.toLowerCase()]
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
      from: challenged,
      starts: firstStarts
    })

    io.to(opponentSocket).emit('morpion-rematch-confirmed', {
      from: challenger,
      starts: !firstStarts
    })

    io.to(challengerSocket).emit('morpion-start', {
      opponent: challenged,
      isFirstPlayer: firstStarts
    })

    io.to(opponentSocket).emit('morpion-start', {
      opponent: challenger,
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
  
  socket.on('disconnect', () => {
    const key = socketIdToUsername[socket.id]
    delete players[key]
    delete socketIdToUsername[socket.id]
    io.emit('update-players', players)
  })

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

  if (!players[key]) {
    return
  }

  if (!messageHistory[userID]) messageHistory[userID] = []
  const history = messageHistory[userID]
  const isOriginal = !history.includes(message)

  messageHistory[userID].push(message)
  if (messageHistory[userID].length > 2) messageHistory[userID].shift()

  const userRef = doc(db, 'players', key)
  let xpGained = 0
  let totalXP = 0

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

  let level = 1
  let xpToNextLevel = 100
  let xpForCurrentLevel = xpToNextLevel
  let remaining = totalXP

  while (remaining >= xpToNextLevel) {
    remaining -= xpToNextLevel
    level++
    xpToNextLevel = 100 + (level - 1) * 20
    xpForCurrentLevel = xpToNextLevel
  }

  const currentLevelXP = remaining

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
