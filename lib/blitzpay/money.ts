const MAX_SAFE_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

export function assertNonNegativeCents(value: bigint, label = "amount_cents"): void {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative`)
  }
  if (value > MAX_SAFE_CENTS) {
    throw new Error(`${label} exceeds safe integer range`)
  }
}

export function assertPositiveCents(value: bigint, label = "amount_cents"): void {
  if (value <= 0n) {
    throw new Error(`${label} must be positive`)
  }
  assertNonNegativeCents(value, label)
}

export function addCents(a: bigint, b: bigint): bigint {
  return a + b
}

/** Minor units from Stripe amount (integer). */
export function stripeAmountToCents(amount: number): bigint {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
    throw new Error("Stripe amount must be a non-negative integer")
  }
  return BigInt(amount)
}
