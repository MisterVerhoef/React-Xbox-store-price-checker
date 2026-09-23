import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRegionalPrices, searchGames, searchRelatedDlc, storeUrl } from './api/catalog'
import { convertAmount, fetchUsdRates, formatMoney } from './api/rates'
import { DISPLAY_CURRENCIES } from './data/markets'
import Button from './components/Button'
import Card from './components/Card'
import PageLayout from './components/PageLayout'
import AccountPanel from './components/AccountPanel'
import { useAuth } from './context/AuthContext'
import './App.css'

const SUGGESTIONS = ['Games', 'DLC', 'XBOX', 'XBOX360', 'XBOX One', 'XBOX Series']

function discountPercent(price) {
  if (!price || !price.msrp || price.msrp <= price.listPrice) return 0
  return Math.round((1 - price.listPrice / price.msrp) * 100)
}

export default function App() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selected, setSelected] = useState(null)
  const [rows, setRows] = useState([])
  const [relatedDlc, setRelatedDlc] = useState([])
  const [loadingDlc, setLoadingDlc] = useState(false)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [rates, setRates] = useState(null)
  const [rateError, setRateError] = useState('')
  const [accountOpen, setAccountOpen] = useState(false)
  const [alertThreshold, setAlertThreshold] = useState('')
  const requestId = useRef(0)
  const { user, alerts, isFavorite, toggleFavorite, saveAlert } = useAuth()

  useEffect(() => {
    fetchUsdRates()
      .then(setRates)
      .catch(() => setRateError('Converted totals use live mid-market rates when available.'))
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2 || (selected && trimmed === selected.title)) {
      setHits([])
      setSearchError('')
      setSearching(false)
      return undefined
    }

    const id = ++requestId.current
    setSearching(true)
    const timer = setTimeout(() => {
      searchGames(trimmed)
        .then((results) => {
          if (requestId.current !== id) return
          setHits(results)
          setSearchError(results.length ? '' : 'No Xbox catalog matches.')
        })
        .catch((error) => {
          if (requestId.current !== id) return
          setHits([])
          setSearchError(error.message)
        })
        .finally(() => {
          if (requestId.current === id) setSearching(false)
        })
    }, 280)

    return () => clearTimeout(timer)
  }, [query])

  async function chooseGame(hit) {
    setSelected(hit)
    setHits([])
    setQuery(hit.title)
    setLoadingPrices(true)
    setRows([])
    setRelatedDlc([])
    setLoadingDlc(true)
    setProgress({ done: 0, total: 0 })
    try {
      const data = await fetchRegionalPrices(hit.id, (done, total) => {
        setProgress({ done, total })
      })
      setRows(data)
      searchRelatedDlc(hit.title)
        .then((dlc) => setRelatedDlc(dlc.filter((item) => item.id !== hit.id)))
        .catch(() => setRelatedDlc([]))
        .finally(() => setLoadingDlc(false))
    } catch (error) {
      setSearchError(error.message)
    } finally {
      setLoadingPrices(false)
    }
  }

  const ranked = useMemo(() => {
    return [...rows]
      .map((row) => {
        const converted = row.price
          ? convertAmount(row.price.listPrice, row.price.currency, displayCurrency, rates)
          : null
        return { ...row, converted, off: discountPercent(row.price) }
      })
      .sort((a, b) => {
        if (a.converted == null && b.converted == null) return a.market.name.localeCompare(b.market.name)
        if (a.converted == null) return 1
        if (b.converted == null) return -1
        return a.converted - b.converted
      })
  }, [rows, displayCurrency, rates])

  const cheapest = ranked.find((row) => row.converted != null)
  const hero = rows.find((row) => row.cover) ?? selected
  const availableCount = rows.filter((row) => row.available).length
  const selectedAlert = selected && alerts.find((alert) => alert.gameId === selected.id)

  function saveSelectedAlert(event) {
    event.preventDefault()
    if (!user) {
      setAccountOpen(true)
      return
    }
    const threshold = Number(alertThreshold)
    if (!selected || !Number.isFinite(threshold) || threshold <= 0) return
    saveAlert({
      gameId: selected.id,
      title: selected.title,
      currency: displayCurrency,
      threshold: threshold.toFixed(2),
    })
    setAlertThreshold('')
  }

  return (
    <PageLayout
      footer={
        <>
          Prices come from Microsoft’s public display catalog. Regional availability, tax, and
          account restrictions can still apply.
        </>
      }
    >
      <div className="app">
        <header className="hero-bar">
          <div className="hero-topline">
            <div className="brand">
              <span className="logo" aria-hidden="true" />
              <div>
                <p className="eyebrow">Xbox Games &amp; DLC Store</p>
                <h1>Price checker</h1>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setAccountOpen((open) => !open)}>
              {user ? user.name : 'Account'}
            </Button>
          </div>
          <p className="lede">
            Search games and DLC in the Microsoft catalog and compare prices across regional stores.
          </p>
        </header>

        {accountOpen && <AccountPanel onSelectFavorite={(favorite) => { setAccountOpen(false); chooseGame(favorite) }} />}

      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault()
          if (hits[0]) chooseGame(hits[0])
        }}
      >
        <label htmlFor="game-search" className="sr-only">
          Search Xbox games
        </label>
        <input
          id="game-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a game or DLC, like Halo Infinite"
          autoComplete="off"
        />
        {searching && <span className="status">Searching…</span>}
      </form>

      <div className="chips">
        {SUGGESTIONS.map((name) => (
          <Button key={name} type="button" variant="ghost" className="chip" onClick={() => setQuery(name)}>
            {name}
          </Button>
        ))}
      </div>

      {hits.length > 0 && (
        <ul className="results" role="listbox">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => chooseGame(hit)}>
                {hit.icon ? <img src={hit.icon} alt="" /> : <span className="thumb-fallback" />}
                <span>
                  <strong>{hit.title}</strong>
                  <em>{hit.family || hit.type}</em>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searchError && !hits.length && <p className="message">{searchError}</p>}

      {selected && (
        <Card className="detail">
          <div className="detail-head">
            {hero?.cover && <img className="cover" src={hero.cover} alt="" />}
            <div>
              <h2>{selected.title}</h2>
              <p>
                {availableCount
                  ? `${availableCount} regional prices loaded`
                  : loadingPrices
                    ? `Checking stores ${progress.done}/${progress.total || '…'}`
                    : 'No purchase price found in these markets'}
              </p>
              <div className="toolbar">
                <label>
                  Show as
                  <select
                    value={displayCurrency}
                    onChange={(event) => setDisplayCurrency(event.target.value)}
                  >
                    {DISPLAY_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <a href={storeUrl(selected.id)} target="_blank" rel="noreferrer">
                  Open on Xbox.com
                </a>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (user) toggleFavorite(selected)
                    else setAccountOpen(true)
                  }}
                >
                  {user && isFavorite(selected.id) ? '★ Favorited' : '☆ Add favorite'}
                </Button>
              </div>
              <form className="alert-form" onSubmit={saveSelectedAlert}>
                <label>
                  Alert me below {displayCurrency}
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={alertThreshold}
                    onChange={(event) => setAlertThreshold(event.target.value)}
                    placeholder="25.00"
                    required
                  />
                </label>
                <Button type="submit" variant="secondary">
                  {selectedAlert ? 'Update alert' : 'Set price alert'}
                </Button>
              </form>
              <p className="hint">Alerts are saved locally for this account; notification delivery needs a server.</p>
              {rateError && <p className="hint">{rateError}</p>}
            </div>
          </div>

          {loadingPrices && <div className="bar" style={{ '--p': `${progress.total ? (progress.done / progress.total) * 100 : 8}%` }} />}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Region</th>
                  <th>Local price</th>
                  <th>MSRP</th>
                  <th>{displayCurrency}</th>
                  <th>Sale</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((row) => (
                  <tr
                    key={row.market.code}
                    className={cheapest && row.market.code === cheapest.market.code ? 'best' : ''}
                  >
                    <td>
                      <strong>{row.market.name}</strong>
                      <span>{row.market.code}</span>
                    </td>
                    <td>
                      {row.price
                        ? formatMoney(row.price.listPrice, row.price.currency)
                        : row.error
                          ? 'Error'
                          : 'Unavailable'}
                    </td>
                    <td>{row.price ? formatMoney(row.price.msrp, row.price.currency) : '—'}</td>
                    <td>{formatMoney(row.converted, displayCurrency)}</td>
                    <td>
                      {row.off > 0 ? <span className="sale">−{row.off}%</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="dlc-section" aria-labelledby="related-dlc-heading">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Add-ons</span>
                <h3 id="related-dlc-heading">Related DLC</h3>
              </div>
              {loadingDlc && <span className="status">Finding add-ons…</span>}
            </div>
            {!loadingDlc && !relatedDlc.length && (
              <p className="account-note">No related DLC was found in the Microsoft catalog.</p>
            )}
            {relatedDlc.length > 0 && (
              <div className="dlc-grid">
                {relatedDlc.map((dlc) => (
                  <a
                    className="dlc-item"
                    href={storeUrl(dlc.id)}
                    target="_blank"
                    rel="noreferrer"
                    key={dlc.id}
                  >
                    {dlc.icon ? <img src={dlc.icon} alt="" /> : <span className="thumb-fallback" />}
                    <span>
                      <strong>{dlc.title}</strong>
                      <small>{dlc.family || 'DLC'}</small>
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        </Card>
      )}
      </div>
    </PageLayout>
  )
}
