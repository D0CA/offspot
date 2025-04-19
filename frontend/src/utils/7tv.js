let emoteMap = new Map()

export async function load7TVEmotes() {
  const setId = '01GE7XNJG0000DAPZVWX8BAQ90' // ✅ Emote set de Kamet0
  const res = await fetch(`https://7tv.io/v3/emote-sets/${setId}`)
  const data = await res.json()

  for (const emote of data.emotes) {
    const url = `https://cdn.7tv.app/emote/${emote.id}/3x.webp`
    emoteMap.set(emote.name, url)
  }
}

export function getEmoteUrl(name) {
  return emoteMap.get(name)
}
