/**
 * Phase 7A / 7A.6 — Stripe Connect & BlitzPay webhook **readiness helpers** (QA, diagnostics, FCC copy).
 * Does not call Stripe; does not mutate state; safe for scripts and Route Handlers.
 *
 * @see docs/STRIPE_PRODUCTION_READINESS.md
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
    "Webhook handler records each `evt_…` id in `blitzpay_stripe_webhook_events` before handlers run; unique violations return 200 `{ duplicate: true }` without re-applying financial side effects.",
    "Phase 2 handlers wrap work in try/catch; failures delete the idempotency row so Stripe can retry safely after remediation.",
    "Connect lifecycle: treat `account.updated` as authoritative for payouts-ready state; surface requirements only to staff.",
    "ACH and disputes: rely on existing Phase 2E+ handlers and ledger mirrors — no duplicate money movement on replay.",
    "Operational: log event type + bounded context; never log raw payment method payloads, bank numbers, or signing secrets.",
    "Environment: API key mode (sk_test_ vs sk_live_) must match deploy policy; webhook `livemode` should align with the signing secret’s Dashboard mode.",
  ] as const
}

export type StripeKeyMode = "test" | "live" | "missing" | "invalid"

const WEBHOOK_EVT = /^evt_[0-9a-zA-Z]{8,}$/

/** Stripe webhook event ids use the `evt_` prefix (bounded check for ops helpers). */
export function isLikelyStripeWebhookEventId(id: string): boolean {
  const t = id.trim()
  return t.length >= 12 && t.length <= 256 && WEBHOOK_EVT.test(t)
}

/**
 * Shapes safe client/ops JSON for duplicate webhook deliveries (contract used by `POST /api/blitzpay/webhook`).
 */
export function blitzpayWebhookDuplicateDeliveryBody(): { received: true; duplicate: true } {
  return { received: true, duplicate: true }
}

export function parseStripeSecretKeyMode(secretKey: string | undefined): StripeKeyMode {
  const trimmed = secretKey?.trim() ?? ""
  if (!trimmed) return "missing"
  if (trimmed.startsWith("sk_test_")) return "test"
  if (trimmed.startsWith("sk_live_")) return "live"
  return "invalid"
}

export function parseStripePublishableKeyMode(publishableKey: string | undefined): StripeKeyMode {
  const trimmed = publishableKey?.trim() ?? ""
  if (!trimmed) return "missing"
  if (trimmed.startsWith("pk_test_")) return "test"
  if (trimmed.startsWith("pk_live_")) return "live"
  return "invalid"
}

export type StripeWebhookEnvironmentAlignment =
  | "aligned"
  | "unknown"
  | "mismatch_live_event_on_test_host"
  | "mismatch_test_event_on_live_enforced_host"

/**
 * Compares Stripe `livemode` on an event (when known) with the host’s API key mode — advisory only.
 */
export function inferStripeWebhookLivemodeAlignment(input: {
  stripeSecretKeyMode: StripeKeyMode
  /** From Stripe.Event.livemode when known; use `null` if unavailable. */
  eventLivemode: boolean | null
  /** When true, production deploy expects live keys (see `isStripeLiveEnforced` in stripe-env). */
  stripeLiveModeEnforcedOnHost: boolean
}): StripeWebhookEnvironmentAlignment {
  if (input.stripeSecretKeyMode !== "test" && input.stripeSecretKeyMode !== "live") return "unknown"
  if (input.eventLivemode === null) return "unknown"
  if (input.stripeSecretKeyMode === "test" && input.eventLivemode === true) {
    return "mismatch_live_event_on_test_host"
  }
  if (input.stripeLiveModeEnforcedOnHost && input.stripeSecretKeyMode === "live" && input.eventLivemode === false) {
    return "mismatch_test_event_on_live_enforced_host"
  }
  return "aligned"
}

const REDACT_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bwhsec_[0-9a-zA-Z]+\b/gi, label: "[webhook_secret]" },
  { re: /\bsk_(live|test)_[0-9a-zA-Z]+\b/gi, label: "[stripe_secret_key]" },
  { re: /\bpk_(live|test)_[0-9a-zA-Z]+\b/gi, label: "[stripe_publishable_key]" },
  { re: /\brk_(live|test)_[0-9a-zA-Z]+\b/gi, label: "[stripe_restricted_key]" },
]

/** Truncates and redacts common Stripe secret patterns from operational log lines (bounded). */
export function sanitizeBlitzpayOperationalLogDetail(detail: string, maxLen = 280): string {
  let s = detail.replace(/\s+/g, " ").trim()
  for (const { re, label } of REDACT_PATTERNS) {
    s = s.replace(re, label)
  }
  if (s.length <= maxLen) return s
  return `${s.slice(0, maxLen - 1)}…`
}

export type BlitzpayStripeLiveReadinessStrip = {
  generatedAt: string
  stripeHostApiModeLabel: "Test" | "Live" | "Not configured" | "Invalid key shape"
  stripePublishableKeyModeLabel: "Test" | "Live" | "Not set" | "Invalid key shape"
  stripeLiveModeEnforcedOnHost: boolean
  blitzpayWebhookSigningConfigured: boolean
  publishableSecretModeAligned: boolean | null
  webhookEventDedupeSummary: string
  connectOnboardingHeadline: string
  connectOperationalWarnings: readonly string[]
  payoutReadinessSummary: string
  disputeExposureSummary: string
  achAttentionSummary: string | null
  environmentAlignmentNote: string | null
  operationalFootnotes: readonly string[]
}

export type BlitzpayStripeLiveReadinessInput = {
  generatedAtIso: string
  stripeSecretKeyMode: StripeKeyMode
  nextPublicPublishableKeyMode: StripeKeyMode
  stripeLiveModeEnforcedOnHost: boolean
  blitzpayWebhookSecretConfigured: boolean
  /** Persisted `organizations.stripe_connect_status` (or `not_started` when no account). */
  connectStatus: string
  stripeChargesEnabled: boolean
  stripePayoutsEnabled: boolean
  stripeDetailsSubmitted: boolean
  requirementsCurrentlyDueCount: number
  requirementsPastDueCount: number
  failedPayoutCount30d: number
  pendingPayoutsCents: number
  openDisputesCount: number
  openDisputesAmountCents: number
  achNudgeOpportunityCount: number
}

const MAX_WARNINGS = 5
const MAX_FOOTNOTES = 4

function connectHeadline(status: string, charges: boolean, payouts: boolean, details: boolean): string {
  switch (status) {
    case "ready":
      return charges && payouts ? "Stripe Connect is ready for charges and payouts" : "Connect marked ready — confirm charges and payouts in Stripe"
    case "disabled":
      return "Stripe Connect is restricted — review requirements in Stripe Dashboard"
    case "action_required":
      return "Stripe needs additional information before payouts can run reliably"
    case "pending_verification":
      return "Stripe is verifying this account — payouts may remain paused"
    case "onboarding_started":
      return details ? "Connect onboarding in progress" : "Connect onboarding not finished"
    case "not_started":
    default:
      return charges || payouts || details ? "Connect setup is incomplete" : "Connect onboarding has not finished"
  }
}

function buildConnectWarnings(input: BlitzpayStripeLiveReadinessInput): string[] {
  const w: string[] = []
  if (input.connectStatus === "disabled") {
    w.push("Account has a disabled or restricted posture in Stripe — staff should review Dashboard requirements.")
  }
  if (input.requirementsPastDueCount > 0) {
    w.push("Past-due verification items are present — resolve in Stripe before customers see interruptions.")
  } else if (input.requirementsCurrentlyDueCount > 0) {
    w.push("Information requests are open in Stripe — finish them to reduce payout holds.")
  }
  if (input.stripeChargesEnabled && !input.stripePayoutsEnabled) {
    w.push("Charges are enabled but payouts are not — expect settlement delays until Stripe enables payouts.")
  }
  if (!input.stripeChargesEnabled && input.stripeDetailsSubmitted) {
    w.push("Details were submitted but charges are not enabled yet — typical while Stripe reviews the account.")
  }
  if (!input.stripeDetailsSubmitted && input.connectStatus !== "not_started") {
    w.push("Hosted onboarding is not complete — finish Connect before going live with customers.")
  }
  return w.slice(0, MAX_WARNINGS)
}

function payoutSummary(input: BlitzpayStripeLiveReadinessInput): string {
  if (!input.stripePayoutsEnabled) {
    return "Payout readiness: blocked at Stripe — treasury movements depend on payouts being enabled."
  }
  if (input.failedPayoutCount30d > 0) {
    return `Payout readiness: watch — ${String(input.failedPayoutCount30d)} failed payout signal(s) in the last 30 days (advisory; confirm in Stripe payout logs).`
  }
  if (input.pendingPayoutsCents > 250_000_00) {
    return "Payout readiness: elevated in-flight payout exposure versus typical small-contractor bands — review cadence in Stripe."
  }
  return "Payout readiness: nominal for hosted Connect — continue monitoring failed payout counters in reporting."
}

function disputeSummary(input: BlitzpayStripeLiveReadinessInput): string {
  if (input.openDisputesCount <= 0) {
    return "Dispute exposure: no open disputes in Equipify’s bounded dispute sample for this org."
  }
  if (input.openDisputesCount >= 4 || input.openDisputesAmountCents >= 50_000_00) {
    return `Dispute exposure: elevated — ${String(input.openDisputesCount)} open dispute(s) with material contested balance (staff review).`
  }
  return `Dispute exposure: low — ${String(input.openDisputesCount)} open dispute(s); keep evidence and invoice records aligned.`
}

function achSummary(input: BlitzpayStripeLiveReadinessInput): string | null {
  if (input.achNudgeOpportunityCount <= 0) return null
  return `ACH attention: ${String(input.achNudgeOpportunityCount)} ACH-related follow-up signal(s) in reporting — ACH can settle slower than cards; advisory only.`
}

function pkAlignment(
  sk: StripeKeyMode,
  pk: StripeKeyMode,
): { aligned: boolean | null; note: string | null } {
  if (sk !== "test" && sk !== "live") return { aligned: null, note: null }
  if (pk === "missing") return { aligned: null, note: "Publishable key is unset — client-side Elements mode cannot be cross-checked on this host." }
  if (pk !== "test" && pk !== "live") return { aligned: null, note: "Publishable key shape is unexpected — verify Dashboard keys match this deploy." }
  if (sk === pk) return { aligned: true, note: null }
  return {
    aligned: false,
    note: "Secret and publishable key modes differ — mixed test/live keys are a common source of Dashboard confusion.",
  }
}

/**
 * Deterministic, additive **Stripe live readiness** strip for staff FCC (no secrets, no raw webhook payloads).
 */
export function buildBlitzpayStripeLiveReadinessStrip(input: BlitzpayStripeLiveReadinessInput): BlitzpayStripeLiveReadinessStrip {
  const stripeHostApiModeLabel: BlitzpayStripeLiveReadinessStrip["stripeHostApiModeLabel"] =
    input.stripeSecretKeyMode === "test" ? "Test"
    : input.stripeSecretKeyMode === "live" ? "Live"
    : input.stripeSecretKeyMode === "missing" ? "Not configured"
    : "Invalid key shape"

  const stripePublishableKeyModeLabel: BlitzpayStripeLiveReadinessStrip["stripePublishableKeyModeLabel"] =
    input.nextPublicPublishableKeyMode === "test" ? "Test"
    : input.nextPublicPublishableKeyMode === "live" ? "Live"
    : input.nextPublicPublishableKeyMode === "missing" ? "Not set"
    : "Invalid key shape"

  const { aligned, note } = pkAlignment(input.stripeSecretKeyMode, input.nextPublicPublishableKeyMode)

  const foot: string[] = []
  if (input.stripeLiveModeEnforcedOnHost && input.stripeSecretKeyMode === "test") {
    foot.push("This host is configured to enforce live Stripe, but the secret key is test mode — customer money features must not run against test data.")
  }
  if (!input.stripeLiveModeEnforcedOnHost && input.stripeSecretKeyMode === "live") {
    foot.push("Live Stripe secret key on a non-production-enforced host — confirm this environment is intentionally touching live money.")
  }
  if (note) foot.push(note)
  foot.push(
    "Webhook duplicate protection: `evt_` ids are inserted before handlers; duplicates short-circuit with HTTP 200 and no duplicate ledger rows.",
  )

  let environmentAlignmentNote: string | null = null
  if (aligned === false) {
    environmentAlignmentNote = "Publishable and secret Stripe key modes do not match — rotate keys or env vars to reduce accidental crossover."
  } else if (input.stripeLiveModeEnforcedOnHost && input.stripeSecretKeyMode === "live" && !input.blitzpayWebhookSecretConfigured) {
    environmentAlignmentNote =
      "Live API keys are present but the BlitzPay webhook signing secret is missing — Connect payment events cannot be verified."
  }

  return {
    generatedAt: input.generatedAtIso,
    stripeHostApiModeLabel,
    stripePublishableKeyModeLabel,
    stripeLiveModeEnforcedOnHost: input.stripeLiveModeEnforcedOnHost,
    blitzpayWebhookSigningConfigured: input.blitzpayWebhookSecretConfigured,
    publishableSecretModeAligned: aligned,
    webhookEventDedupeSummary:
      "Stripe event ids are persisted in `blitzpay_stripe_webhook_events` before side effects; handler failures roll back that row so Stripe retries stay safe.",
    connectOnboardingHeadline: connectHeadline(
      input.connectStatus,
      input.stripeChargesEnabled,
      input.stripePayoutsEnabled,
      input.stripeDetailsSubmitted,
    ),
    connectOperationalWarnings: buildConnectWarnings(input),
    payoutReadinessSummary: payoutSummary(input),
    disputeExposureSummary: disputeSummary(input),
    achAttentionSummary: achSummary(input),
    environmentAlignmentNote,
    operationalFootnotes: foot.slice(0, MAX_FOOTNOTES),
  }
}

export type BlitzpayWebhookOpsStatusInput = {
  deadInbox24h: number
  pendingInboxApprox: number
  ignoredUnknownEvents7dApprox: number
}

/**
 * Bounded narrative for platform ops (counts only — no payloads).
 */
export function summarizeBlitzpayWebhookOperationalStatus(input: BlitzpayWebhookOpsStatusInput): {
  tone: "nominal" | "attention"
  headline: string
  detailLines: readonly string[]
} {
  const lines: string[] = []
  if (input.deadInbox24h > 0) {
    lines.push(`${String(input.deadInbox24h)} webhook inbox row(s) marked dead in the last 24h — review Stripe Dashboard delivery logs and handler errors.`)
  }
  if (input.pendingInboxApprox > 50) {
    lines.push("Webhook inbox pending volume is elevated versus typical steady state — confirm workers are not backlogged.")
  }
  if (input.ignoredUnknownEvents7dApprox > 0) {
    lines.push(
      `${String(input.ignoredUnknownEvents7dApprox)} ignored-event log line(s) (7d approx) — unknown types stay no-ops by design; expand handlers only with explicit product scope.`,
    )
  }
  if (lines.length === 0) {
    lines.push("Webhook inbox shows no abnormal dead-letter pressure in the sampled window.")
  }
  return {
    tone: input.deadInbox24h > 0 ? "attention" : "nominal",
    headline: input.deadInbox24h > 0 ? "Webhook recovery attention" : "Webhook ingestion nominal",
    detailLines: lines.slice(0, 4),
  }
}
