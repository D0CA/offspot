import { useState, useEffect } from 'react'

export function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('offspot-user'))
      return stored?.username ? stored : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const url = new URL(window.location.href)
    const username = url.searchParams.get('username')
    const avatar = url.searchParams.get('avatar')
    const id = url.searchParams.get('id')

    const isValidUsername = typeof username === 'string' && /^[a-zA-Z0-9_]{3,20}$/.test(username)
    const isValidAvatar = typeof avatar === 'string' && avatar.startsWith('https://')
    const isValidId = typeof id === 'string' && id.length > 2

    if (isValidUsername && isValidAvatar && isValidId) {
      const userData = { username, avatar, id }
      localStorage.setItem('offspot-user', JSON.stringify(userData))
      setUser(userData)

      // nettoie l’URL une fois les données stockées
      setTimeout(() => {
        window.history.replaceState({}, '', '/')
      }, 50)
    } else {
      console.warn('[🔐 useAuth] Paramètres d’auth invalides ignorés dans l’URL.', { username, avatar, id })
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('offspot-user')
    setUser(null)
  }

  return { user, setUser, logout }
}
