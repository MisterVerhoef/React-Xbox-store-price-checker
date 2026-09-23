import { MARKETS } from '../data/markets'

const ROMAN_NUMERALS = {
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
  9: 'IX',
}

function imageUrl(uri) {
  if (!uri) return ''
  return uri.startsWith('http') ? uri : `https:${uri}`
}

export function pickCover(product) {
  const images = product?.LocalizedProperties?.[0]?.Images ?? []
  const preferred = ['Poster', 'BoxArt', 'SuperHeroArt', 'TitledHeroArt', 'Logo']
  for (const purpose of preferred) {
    const match = images.find((img) => img.ImagePurpose === purpose)
    if (match?.Uri) return imageUrl(match.Uri)
  }
  return images[0]?.Uri ? imageUrl(images[0].Uri) : ''
}

function pickPurchase(product) {
  const skus = product?.DisplaySkuAvailabilities ?? []
  for (const entry of skus) {
    if (entry.Sku?.Properties?.IsTrial) continue
    const skuTitle = entry.Sku?.LocalizedProperties?.[0]?.SkuTitle ?? ''
    const skuType = entry.Sku?.SkuType ?? ''
    for (const availability of entry.Availabilities ?? []) {
      const actions = availability.Actions ?? []
      if (!actions.includes('Purchase')) continue
      const price = availability.OrderManagementData?.Price
      if (!price) continue
      return {
        listPrice: price.ListPrice,
        msrp: price.MSRP,
        currency: price.CurrencyCode,
        skuTitle,
        skuType,
      }
    }
  }
  return null
}

export function summarizeProduct(product) {
  const loc = product?.LocalizedProperties?.[0] ?? {}
  const price = pickPurchase(product)
  return {
    id: product.ProductId,
    title: loc.ProductTitle ?? 'Untitled',
    publisher: loc.PublisherName ?? '',
    description: loc.ShortDescription || loc.ProductDescription || '',
    cover: pickCover(product),
    productKind: product.ProductKind,
    productFamily: product.ProductFamily,
    price,
  }
}

/** Return nonempty spelling, numeral, and common game-title abbreviation variants of a query. */
function searchVariants(query) {
  const trimmed = query.trim().replace(/\s+/g, ' ')
  const variants = new Set([trimmed])
  const numericVariant = trimmed.replace(/\b([2-9])\b/g, (_, number) => ROMAN_NUMERALS[number])
  const romanVariant = trimmed.replace(/\b(II|III|IV|V|VI|VII|VIII|IX)\b/gi, (numeral) => {
    const value = Object.entries(ROMAN_NUMERALS).find(([, roman]) => roman.toLowerCase() === numeral.toLowerCase())
    return value ? value[0] : numeral
  })
  variants.add(numericVariant)
  variants.add(romanVariant)

  const shorthand = trimmed.toLowerCase()
    .replace(/\bcod\b/g, 'call of duty')
    .replace(/\bbo([2-9])\b/g, (_, number) => `black ops ${ROMAN_NUMERALS[number]}`)
    .replace(/\bmw([2-9])\b/g, (_, number) => `modern warfare ${ROMAN_NUMERALS[number]}`)
    .replace(/\bgta\s*([2-9])\b/g, (_, number) => `grand theft auto ${ROMAN_NUMERALS[number]}`)
  variants.add(shorthand)

  return [...variants].filter(Boolean)
}

/**
 * Search the US Xbox catalog for one query variant.
 * @param {string} productFamilyNames Comma-separated catalog families to include.
 * @param {number} topProducts Maximum products requested for this variant.
 * @returns {Promise<object[]>} Catalog matches in the order returned by the service.
 * @throws {Error} When the request fails, its response is invalid, or HTTP status is not OK.
 */
async function searchCatalog(query, productFamilyNames, topProducts) {
  const params = new URLSearchParams({
    languages: 'en-US',
    market: 'US',
    platformdependencyname: 'windows.xbox',
    productFamilyNames,
    query,
    topProducts: String(topProducts),
  })
  const res = await fetch(`/catalog/v7.0/productFamilies/autosuggest?${params}`)
  if (!res.ok) {
    throw new Error(`Search failed (${res.status})`)
  }
  const data = await res.json()
  const products = (data.Results ?? []).flatMap((family) =>
    (family.Products ?? []).map((product) => ({
      id: product.ProductId,
      title: product.Title,
      type: product.Type,
      family: family.ProductFamilyName,
      icon: product.Icon ? imageUrl(product.Icon) : '',
    })),
  )
  return products
}

/** Keep distinct product IDs and rank matches by title-term overlap, then title. */
function rankProducts(products, query) {
  const terms = query.toLowerCase().replace(/[®™]/g, '').split(/\s+/).filter(Boolean)
  const seen = new Set()
  return products
    .filter((item) => item.id && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => {
      const score = (item) => {
        const title = item.title.toLowerCase()
        return terms.reduce((total, term) => total + (title.includes(term) ? 1 : 0), 0)
      }
      return score(b) - score(a) || a.title.localeCompare(b.title)
    })
}

/**
 * Combine and rank successful catalog searches for alternate spellings of a query.
 * Failed variants are ignored when at least one search succeeds, even if it returns no matches.
 * @throws {Error} When every variant's request or response fails.
 */
async function searchWithVariants(query, productFamilyNames, topProducts) {
  const results = await Promise.allSettled(
    searchVariants(query).map((variant) => searchCatalog(variant, productFamilyNames, topProducts)),
  )
  const successful = results.filter((result) => result.status === 'fulfilled')
  if (!successful.length) {
    throw new Error('Search failed for all catalog query variants.')
  }
  return rankProducts(successful.flatMap((result) => result.value), query)
}

/**
 * Search games, DLC, and apps by title, including alternate spellings.
 * @returns {Promise<object[]>} Distinct catalog matches ranked by title-term overlap.
 * @throws {Error} When all catalog query variants fail.
 */
export async function searchGames(query) {
  return searchWithVariants(query, 'Games,DLC,Apps', 20)
}

/**
 * Search DLC by a product title; results are title matches, not verified add-ons for that product.
 * @returns {Promise<object[]>} Distinct catalog matches ranked by title-term overlap.
 * @throws {Error} When all catalog query variants fail.
 */
export async function searchRelatedDlc(title) {
  return searchWithVariants(title, 'DLC', 50)
}

async function fetchProduct(productId, market) {
  const params = new URLSearchParams({
    actionFilter: 'Browse',
    bigIds: productId,
    fieldsTemplate: 'details',
    languages: market.locale,
    market: market.code,
  })
  const res = await fetch(`/catalog/v7.0/products?${params}`)
  if (!res.ok) {
    throw new Error(`${market.code} failed (${res.status})`)
  }
  const data = await res.json()
  return data.Products?.[0] ?? null
}

export async function fetchRegionalPrices(productId, onProgress) {
  const results = []
  let done = 0
  await Promise.all(
    MARKETS.map(async (market) => {
      try {
        const product = await fetchProduct(productId, market)
        const summary = product ? summarizeProduct(product) : null
        results.push({
          market,
          available: Boolean(summary?.price),
          ...summary,
        })
      } catch {
        results.push({
          market,
          available: false,
          title: '',
          error: true,
        })
      } finally {
        done += 1
        onProgress?.(done, MARKETS.length)
      }
    }),
  )
  return results
}

export function storeUrl(productId) {
  return `https://www.xbox.com/en-us/games/store/_/${productId}`
}
