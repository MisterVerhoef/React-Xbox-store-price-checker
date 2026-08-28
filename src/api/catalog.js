import { MARKETS } from '../data/markets'

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

export async function searchGames(query) {
  const params = new URLSearchParams({
    languages: 'en-US',
    market: 'US',
    platformdependencyname: 'windows.xbox',
    productFamilyNames: 'Games,Apps',
    query,
    topProducts: '20',
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
  const seen = new Set()
  return products.filter((item) => {
    if (!item.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
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
