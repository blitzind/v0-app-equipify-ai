import "server-only"

/**
 * Single read surface for outbound email environment (Phase 55.1).
 * Does not expose secret values — use only for validation and boolean health checks.
 */

export type OutboundEmailProviderId = "resend"

export type OutboundEmailEnv = {
  provider: OutboundEmailProviderId
  resendApiKey: string | null
  fromAddress: string | null
  replyToDefault: string | null
}

export function getOutboundEmailEnv(): OutboundEmailEnv {
  return {
    provider: "resend",
    resendApiKey: process.env.RESEND_API_KEY?.trim() || null,
    fromAddress: process.env.EMAIL_FROM_ADDRESS?.trim() || process.env.EMAIL_FROM?.trim() || null,
    replyToDefault: process.env.EMAIL_REPLY_TO?.trim() || null,
  }
}

/** True when Resend can attempt a send (API key + verified from address). */
export function isOutboundEmailConfigured(): boolean {
  const e = getOutboundEmailEnv()
  return Boolean(e.resendApiKey && e.fromAddress)
}

/**
 * Safe diagnostics for logs, dev routes, and server checks. Never includes secrets or raw env values.
 */
export function getOutboundEmailHealth(): {
  provider: OutboundEmailProviderId
  configured: boolean
  hasResendApiKey: boolean
  hasFromAddress: boolean
  hasReplyToDefault: boolean
  supportEmailOverride: boolean
} {
  const e = getOutboundEmailEnv()
  return {
    provider: e.provider,
    configured: isOutboundEmailConfigured(),
    hasResendApiKey: Boolean(e.resendApiKey),
    hasFromAddress: Boolean(e.fromAddress),
    hasReplyToDefault: Boolean(e.replyToDefault),
    supportEmailOverride: Boolean(process.env.SUPPORT_EMAIL?.trim()),
  }
}

/**
 * Public app origin for links in transactional email (invite, welcome, digest, etc.).
 * Order: `NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_APP_URL` → server `APP_URL` → default.
 */
export function getPublicAppOrigin(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (site) return site.replace(/\/+$/, "")
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (app) return app.replace(/\/+$/, "")
  const serverApp = process.env.APP_URL?.trim()
  if (serverApp) return serverApp.replace(/\/+$/, "")
  return "https://app.equipify.ai"
}

/** Internal recipient for new self-serve workspace alerts (Phase 54.4). */
export function getSignupInternalNotifyRecipient(): string {
  const fromEnv = process.env.EMAIL_SIGNUP_INTERNAL_NOTIFY?.trim()
  if (fromEnv && fromEnv.includes("@")) return fromEnv
  return "mike@equipify.ai"
}

/** Product / AIden feature request notifications (internal). */
export function getSupportEmailRecipient(): string {
  const fromEnv = process.env.SUPPORT_EMAIL?.trim()
  if (fromEnv && fromEnv.includes("@")) return fromEnv
  return "support@equipify.ai"
}
