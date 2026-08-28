let cached = null

export async function fetchUsdRates() {
  if (cached) return cached
  const res = await fetch('/rates/v6/latest/USD')
  if (!res.ok) throw new Error('Could not load exchange rates')
  const data = await res.json()
  if (data.result !== 'success' || !data.rates) {
    throw new Error('Exchange rates unavailable')
  }
  cached = data.rates
  return cached
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (amount == null || !fromCurrency || !toCurrency || !rates) return null
  if (fromCurrency === toCurrency) return amount
  const fromRate = fromCurrency === 'USD' ? 1 : rates[fromCurrency]
  const toRate = toCurrency === 'USD' ? 1 : rates[toCurrency]
  if (!fromRate || !toRate) return null
  return (amount / fromRate) * toRate
}

export function formatMoney(amount, currency) {
  if (amount == null || !currency) return '—'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}
