
import * as PIXI from 'pixi.js'
import { Assets } from 'pixi.js'
import { getEmoteUrl } from '../utils/7tv'

const BUBBLE_SCALE = 2 // ajuste indépendamment si tu veux

const EMOTE_SIZE = 28
const MAX_LINE_WIDTH = 280
const LINE_HEIGHT = 36
const BUBBLE_PATH = '/ui/speech_bubble_organic.svg'
const H_PADDING = 40
const V_PADDING = 36

let cachedTexture = null

export async function displayChatBubble({ player, message, app }) {
  if (!player || !message) return

  if (player.chatBubble?.parent) {
    player.chatBubble.parent.removeChild(player.chatBubble)
    player.chatBubble.destroy({ children: true })
    player.chatBubble = null
  }

  if (!cachedTexture) {
    try {
      cachedTexture = await Assets.load(BUBBLE_PATH)
    } catch (err) {
      console.warn('❌ Failed to load SVG texture:', err)
      return
    }
  }

  renderBubble({ player, message, app, texture: cachedTexture })
}

function renderBubble({ player, message, app, texture }) {
  const bubble = new PIXI.Container()
  const textContainer = new PIXI.Container()
  const content = new PIXI.Container()

  const style = new PIXI.TextStyle({
    fontFamily: 'Comic Sans MS',
    fontSize: 16,
    fill: 0x2c2c2c,
  })

  const words = message.split(/(\s+)/) // preserve spaces
  let line = new PIXI.Container()
  let lineWidth = 0
  let lineY = 0
  let maxLineWidth = 0
  const lines = []

  lines.push(line)
  content.addChild(line)

  for (let word of words) {
    const clean = word.trim().replace(/[.,!?;:]+$/, '')
    const emoteUrl = getEmoteUrl(clean)
    let segments = []

    if (emoteUrl) {
      segments.push({ type: 'emote', text: clean, url: emoteUrl })
    } else {
      if (word.length > 25) {
        for (let i = 0; i < word.length; i += 10) {
          segments.push({ type: 'text', text: word.slice(i, i + 10) })
        }
      } else {
        segments.push({ type: 'text', text: word })
      }
    }

    for (let seg of segments) {
      let displayObject
      if (seg.type === 'emote') {
        try {
          const tex = PIXI.Texture.from(seg.url)
          const sprite = new PIXI.Sprite(tex)
          sprite.width = sprite.height = EMOTE_SIZE
          displayObject = sprite
        } catch {
          displayObject = new PIXI.Text(seg.text + ' ', style)
        }
      } else {
        displayObject = new PIXI.Text(seg.text, style)
      }

      const objWidth = displayObject.width + 4
      if (lineWidth + objWidth > MAX_LINE_WIDTH) {
        lineY += LINE_HEIGHT
        line = new PIXI.Container()
        lines.push(line)
        content.addChild(line)
        line.y = lineY
        lineWidth = 0
      }

      displayObject.x = lineWidth
      line.addChild(displayObject)
      lineWidth += objWidth
      maxLineWidth = Math.max(maxLineWidth, lineWidth)
    }
  }

  lines.forEach(line => {
    const lw = line.width
    line.x = (maxLineWidth - lw) / 2
  })

  const totalTextHeight = content.height
  const bubbleWidth = maxLineWidth + H_PADDING * 2 + 20
  const bubbleHeight = totalTextHeight + V_PADDING * 2 + 10

  const bubbleSprite = new PIXI.Sprite(texture)
  bubbleSprite.width = bubbleWidth
  bubbleSprite.height = bubbleHeight
  bubbleSprite.anchor.set(0.5, 1)

  content.x = -maxLineWidth / 2
  content.y = -totalTextHeight / 2

  textContainer.addChild(content)
  textContainer.x = 0
  textContainer.y = -bubbleHeight / 2

  bubble.addChild(bubbleSprite)
  bubble.addChild(textContainer)

  bubble.y = -140
  bubble.alpha = 0
  bubble.scale.set(0.85 * BUBBLE_SCALE)
  bubble.zIndex = 999

  player.container.sortableChildren = true
  player.container.addChild(bubble)
  player.chatBubble = bubble

  let t = 0
  const bounceIn = delta => {
    t += delta
    bubble.alpha = Math.min(1, bubble.alpha + 0.1)
    bubble.scale.x = 1 + 0.05 * Math.sin(t * 0.3)
    bubble.scale.y = 1 + 0.05 * Math.sin(t * 0.3)
    if (t > 10) {
      bubble.scale.set(1 * BUBBLE_SCALE)
      app.ticker.remove(bounceIn)
    }
  }
  app.ticker.add(bounceIn)

  const duration = Math.min(6000, 2000 + message.length * 50)
  setTimeout(() => {
    let frame = 0
    app.ticker.add(function fadeOut() {
      if (!bubble.parent) return app.ticker.remove(fadeOut)
      frame++
      bubble.alpha -= 0.05
      bubble.scale.x *= 0.96
      bubble.scale.y *= 0.96
      if (frame > 20 || bubble.alpha <= 0) {
        player.container.removeChild(bubble)
        bubble.destroy({ children: true })
        player.chatBubble = null
        app.ticker.remove(fadeOut)
      }
    })
  }, duration)
}
