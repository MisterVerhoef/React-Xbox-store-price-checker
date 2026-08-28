import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchRegionalPrices, searchGames, storeUrl } from './api/catalog'
import { convertAmount, fetchUsdRates, formatMoney } from './api/rates'
import { DISPLAY_CURRENCIES } from './data/markets'
import './App.css'

const SUGGESTIONS = ['Halo', 'Forza Horizon', 'Indiana Jones', 'Call of Duty', 'Minecraft']

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
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [displayCurrency, setDisplayCurrency] = useState('USD')
  const [rates, setRates] = useState(null)
  const [rateError, setRateError] = useState('')
  const requestId = useRef(0)

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
    setProgress({ done: 0, total: 0 })
    try {
      const data = await fetchRegionalPrices(hit.id, (done, total) => {
        setProgress({ done, total })
      })
      setRows(data)
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

  return (
    <div className="app">
      <header className="hero-bar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <div>
            <p className="eyebrow">Xbox Store</p>
            <h1>Price checker</h1>
          </div>
        </div>
        <p className="lede">
          Search the Microsoft catalog and compare the same product across regional stores.
        </p>
      </header>

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
          placeholder="Search a game, like Halo Infinite"
          autoComplete="off"
        />
        {searching && <span className="status">Searching…</span>}
      </form>

      <div className="chips">
        {SUGGESTIONS.map((name) => (
          <button key={name} type="button" className="chip" onClick={() => setQuery(name)}>
            {name}
          </button>
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
        <section className="detail">
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
              </div>
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
        </section>
      )}

      <footer>
        Prices come from Microsoft’s public display catalog. Regional availability, tax, and account
        restrictions can still apply.
      </footer>
    </div>
  )
}
