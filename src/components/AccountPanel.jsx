import { useState } from 'react'
import Button from './Button'
import Card from './Card'
import { useAuth } from '../context/AuthContext'

export default function AccountPanel({ onSelectFavorite }) {
  const { user, favorites, alerts, login, register, logout, removeAlert } = useAuth()
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      if (mode === 'login') await login(username, password)
      else await register(username, password, email)
      setPassword('')
    } catch (submissionError) {
      setError(submissionError.message)
    }
  }

  if (!user) {
    return (
      <Card className="account-panel">
        <div className="account-tabs" role="tablist" aria-label="Account actions">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <form className="account-form" onSubmit={submit}>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          {mode === 'register' && (
            <label>Email for future alerts<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          )}
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</Button>
        </form>
        <p className="account-note">Demo mode: account data is stored only in this browser.</p>
      </Card>
    )
  }

  return (
    <Card className="account-panel">
      <div className="account-heading">
        <div><span className="eyebrow">Signed in</span><h2>{user.name}</h2></div>
        <Button variant="secondary" onClick={logout}>Log out</Button>
      </div>
      <div className="account-section">
        <h3>Favorites</h3>
        {favorites.length ? (
          <div className="saved-list">
            {favorites.map((favorite) => (
              <button key={favorite.id} type="button" onClick={() => onSelectFavorite(favorite)}>
                {favorite.icon ? <img src={favorite.icon} alt="" /> : <span className="thumb-fallback" />}
                <span>{favorite.title}</span>
              </button>
            ))}
          </div>
        ) : <p className="account-note">Favorite a game to keep it here.</p>}
      </div>
      <div className="account-section">
        <h3>Price alerts</h3>
        {alerts.length ? alerts.map((alert) => (
          <div className="alert-row" key={alert.id}>
            <span><strong>{alert.title}</strong><small>Under {alert.currency} {alert.threshold}</small></span>
            <Button variant="ghost" onClick={() => removeAlert(alert.id)}>Remove</Button>
          </div>
        )) : <p className="account-note">Set an alert from a game’s price comparison.</p>}
      </div>
    </Card>
  )
}
