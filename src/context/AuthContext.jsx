import { createContext, useContext, useMemo } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage('xbox_auth_user', null)
  const [accounts, setAccounts] = useLocalStorage('xbox_accounts', {})
  const [favoritesByUser, setFavoritesByUser] = useLocalStorage('xbox_favorites', {})
  const [alertsByUser, setAlertsByUser] = useLocalStorage('xbox_price_alerts', {})

  const auth = useMemo(() => {
    const username = user?.username
    const favorites = username ? favoritesByUser[username] || [] : []
    const alerts = username ? alertsByUser[username] || [] : []
    const requireUser = () => {
      if (!username) throw new Error('Log in to save favorites and price alerts.')
    }

    return {
      user,
      favorites,
      alerts,
      async login(usernameToFind, password) {
        const account = accounts[usernameToFind.trim().toLowerCase()]
        if (!account || account.password !== password) throw new Error('Invalid username or password.')
        const { password: _, ...safeUser } = account
        setUser(safeUser)
        return safeUser
      },
      async register(usernameToCreate, password, email) {
        const normalizedUsername = usernameToCreate.trim().toLowerCase()
        if (!/^[a-z0-9_-]{3,24}$/.test(normalizedUsername)) {
          throw new Error('Username must be 3–24 characters using letters, numbers, _ or -.')
        }
        if (password.length < 6) throw new Error('Password must be at least 6 characters.')
        if (accounts[normalizedUsername]) throw new Error('That username is already taken.')
        const account = { username: normalizedUsername, name: normalizedUsername, email, password }
        setAccounts((current) => ({ ...current, [normalizedUsername]: account }))
        const { password: _, ...safeUser } = account
        setUser(safeUser)
        return safeUser
      },
      logout() {
        setUser(null)
      },
      isFavorite(gameId) {
        return favorites.some((favorite) => favorite.id === gameId)
      },
      toggleFavorite(game) {
        requireUser()
        setFavoritesByUser((current) => {
          const existing = current[username] || []
          const next = existing.some((favorite) => favorite.id === game.id)
            ? existing.filter((favorite) => favorite.id !== game.id)
            : [...existing, { id: game.id, title: game.title, icon: game.icon || null }]
          return { ...current, [username]: next }
        })
      },
      saveAlert(alert) {
        requireUser()
        setAlertsByUser((current) => {
          const existing = current[username] || []
          const withoutGame = existing.filter((item) => item.gameId !== alert.gameId)
          return { ...current, [username]: [...withoutGame, { ...alert, id: crypto.randomUUID() }] }
        })
      },
      removeAlert(alertId) {
        requireUser()
        setAlertsByUser((current) => ({
          ...current,
          [username]: (current[username] || []).filter((alert) => alert.id !== alertId),
        }))
      },
    }
  }, [accounts, alertsByUser, favoritesByUser, setAccounts, setAlertsByUser, setFavoritesByUser, setUser, user])

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
