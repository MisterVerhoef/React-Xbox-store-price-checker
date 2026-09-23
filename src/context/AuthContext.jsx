import { createContext, useContext, useMemo } from 'react'
import useLocalStorage from '../hooks/useLocalStorage'

const AuthContext = createContext(null)

/** Provide browser-stored account, favorites, and price alerts to descendants. */
export function AuthProvider({ children }) {
  const [user, setUser] = useLocalStorage('xbox_auth_user', null)
  const [accounts, setAccounts] = useLocalStorage('xbox_accounts', {})
  const [favoritesByUser, setFavoritesByUser] = useLocalStorage('xbox_favorites', {})
  const [alertsByUser, setAlertsByUser] = useLocalStorage('xbox_price_alerts', {})

  const auth = useMemo(() => {
    const username = user?.username
    const favorites = username ? favoritesByUser[username] || [] : []
    const alerts = username ? alertsByUser[username] || [] : []
    /** Reject changes to saved items when no account is signed in. */
    const requireUser = () => {
      if (!username) throw new Error('Log in to save favorites and price alerts.')
    }

    return {
      user,
      favorites,
      alerts,
      /**
       * Sign in using a case-insensitive username and return account details without the password.
       * @throws {Error} When the username or password does not match a saved account.
       */
      async login(usernameToFind, password) {
        const account = accounts[usernameToFind.trim().toLowerCase()]
        if (!account || account.password !== password) throw new Error('Invalid username or password.')
        const { password: _, ...safeUser } = account
        setUser(safeUser)
        return safeUser
      },
      /**
       * Save a new account and sign in with a lowercase username.
       * @throws {Error} For invalid or taken usernames or passwords shorter than six characters.
       */
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
      /** Sign out without removing the account or its saved items. */
      logout() {
        setUser(null)
      },
      /** Check whether the current account saved the given product ID. */
      isFavorite(gameId) {
        return favorites.some((favorite) => favorite.id === gameId)
      },
      /**
       * Add or remove a game from the current account's favorites by product ID.
       * @throws {Error} When no account is signed in.
       */
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
      /**
       * Save an alert for the current account, replacing any alert for the same game ID.
       * A new ID is assigned even when replacing an existing alert.
       * @throws {Error} When no account is signed in.
       */
      saveAlert(alert) {
        requireUser()
        setAlertsByUser((current) => {
          const existing = current[username] || []
          const withoutGame = existing.filter((item) => item.gameId !== alert.gameId)
          return { ...current, [username]: [...withoutGame, { ...alert, id: crypto.randomUUID() }] }
        })
      },
      /**
       * Remove an alert by ID from the current account; missing IDs leave the list unchanged.
       * @throws {Error} When no account is signed in.
       */
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

/** Access the account context, or null when rendered outside AuthProvider. */
export function useAuth() {
  return useContext(AuthContext)
}
