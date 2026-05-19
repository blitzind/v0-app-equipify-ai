const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")

/** Cost / buy-side columns — most specific aliases first. */
export const CATALOG_IMPORT_COST_HEADER_ALIASES = [
  "cost price",
  "unit cost",
  "item cost",
  "wholesale cost",
  "dealer cost",
  "net cost",
  "your cost",
  "buy price",
  "cost",
  "wholesale",
  "net price",
] as const

/** Customer-facing / sell-side columns — most specific aliases first. */
export const CATALOG_IMPORT_LIST_PRICE_HEADER_ALIASES = [
  "list price",
  "unit price",
  "sales price",
  "retail price",
  "sell price",
  "msrp",
  "retail",
  "list usd",
  "list",
  "price",
] as const

function isCostLikeHeader(header: string): boolean {
  const n = norm(header)
  return n.includes("cost") || n.includes("wholesale") || n.includes("dealer") || n.includes("buy_price")
}

function pickLeftmostHeader(headers: string[], aliases: readonly string[]): string | undefined {
  for (const h of headers) {
    const hn = norm(h)
    if (aliases.some((a) => norm(a) === hn)) return h
  }
  return undefined
}

export function pickCatalogCostColumn(headers: string[]): string | undefined {
  return pickLeftmostHeader(headers, CATALOG_IMPORT_COST_HEADER_ALIASES)
}

/**
 * Pick list/sell price column, never reusing the cost column.
 * Generic "price" skips cost-like headers (e.g. "Cost Price").
 */
export function pickCatalogListPriceColumn(
  headers: string[],
  costColumn?: string,
): string | undefined {
  for (const h of headers) {
    if (costColumn && h === costColumn) continue
    const hn = norm(h)
    for (const alias of CATALOG_IMPORT_LIST_PRICE_HEADER_ALIASES) {
      if (hn !== norm(alias)) continue
      if (alias === "price" && isCostLikeHeader(h)) continue
      return h
    }
  }
  return undefined
}

export function pickCatalogImportPriceColumns(headers: string[]): {
  costCol: string | undefined
  listPriceCol: string | undefined
} {
  const costCol = pickCatalogCostColumn(headers)
  const listPriceCol = pickCatalogListPriceColumn(headers, costCol)
  return { costCol, listPriceCol }
}
