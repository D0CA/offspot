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
      const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}/
      return regex.test(url)
    }

    if (!url || typeof url !== 'string') return
    if (!isValidYouTubeUrl(url)) return

    const videoData = { url, username: username || 'Anonyme' }
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
    console.log(`[⛔] Message ignoré de ${username} (non connecté - ID: ${userID})`)
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
    totalXP
  })
})

server.listen(4000, () => {
  console.log('✅ Server running at http://localhost:4000')
})
