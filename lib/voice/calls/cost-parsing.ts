export type ParsedVoiceCallCost = {
  costCurrency: string
  costAmount: number | null
}

export function parseTwilioCallCost(payload: Record<string, unknown>): ParsedVoiceCallCost {
  const priceRaw = payload.Price ?? payload.CallPrice
  const currencyRaw = payload.PriceUnit ?? payload.Currency ?? "USD"
  const currency = typeof currencyRaw === "string" && currencyRaw.trim() ? currencyRaw.trim().toUpperCase() : "USD"
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
    return { costCurrency: currency, costAmount: Math.abs(priceRaw) }
  }
  if (typeof priceRaw === "string" && priceRaw.trim()) {
    const parsed = Number.parseFloat(priceRaw)
    if (Number.isFinite(parsed)) {
      return { costCurrency: currency, costAmount: Math.abs(parsed) }
    }
  }
  return { costCurrency: currency, costAmount: null }
}
