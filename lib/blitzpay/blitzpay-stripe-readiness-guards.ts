/**
 * Phase 7A — lightweight validation helpers for BlitzPay / Connect operational readiness reviews.
 * Does not call Stripe; safe to import from scripts and Route Handlers.
 */

const STRIPE_LIKE = [/\bacct_[0-9a-zA-Z]{8,}\b/gi, /\bcus_[0-9a-zA-Z]{8,}\b/gi, /\bpi_[0-9a-zA-Z]{8,}\b/gi, /\bpm_[0-9a-zA-Z]{8,}\b/gi]

function visitJsonForStripeLikeTokens(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    for (const re of STRIPE_LIKE) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(value)) != null) {
        out.add(m[0].slice(0, 32))
      }
    }
  } else if (Array.isArray(value)) {
    for (const x of value) visitJsonForStripeLikeTokens(x, out)
  } else if (value && typeof value === "object") {
    for (const x of Object.values(value as Record<string, unknown>)) visitJsonForStripeLikeTokens(x, out)
  }
}

/** Returns unique substrings that look like raw Stripe object ids (for QA / CI scans of JSON payloads). */
export function scanJsonForStripeLikeTokens(value: unknown): string[] {
  const out = new Set<string>()
  visitJsonForStripeLikeTokens(value, out)
  return [...out].sort((a, b) => a.localeCompare(b))
}

/** Human checklist — complement `docs/STRIPE_PRODUCTION_READINESS.md`. */
export function blitzpayConnectWebhookReadinessNotes(): readonly string[] {
  return [
    "Dedicated signing secret per mode: `STRIPE_BLITZPAY_WEBHOOK_SECRET` (test vs live) matching the Dashboard endpoint.",
    "Webhook handler applies idempotency on `evt_` ids (`blitzpay_stripe_webhook_events`) before mutating org rows.",
    "Connect lifecycle: treat `account.updated` as authoritative for payouts-ready state; surface requirements arrays only to staff.",
    "ACH and disputes: rely on existing Phase 2E+ handlers and ledger mirrors — no duplicate money movement on replay.",
    "Operational: log event type + org resolution; never log raw payment method payloads or secrets.",
  ] as const
}
