/** Unified outreach eligibility engine — client-safe single source of truth. */

import { computeProspectSearchContactOutreachReadiness } from "@/lib/growth/prospect-search/prospect-search-contact-readiness"
import {
  freshnessAffectsEligibility,
} from "@/lib/growth/prospect-search/prospect-search-contact-freshness"

export const GROWTH_CONTACT_ELIGIBILITY_ENGINE_QA_MARKER =
  "growth-contact-eligibility-engine-v1" as const

export const PROSPECT_SEARCH_OUTREACH_CHANNELS = ["email", "call", "sms"] as const

export type ProspectSearchOutreachChannel = (typeof PROSPECT_SEARCH_OUTREACH_CHANNELS)[number]

export const PROSPECT_SEARCH_CONTACT_ELIGIBILITY_STATES = [
  "eligible",
  "blocked",
  "needs_review",
  "verification_required",
  "suppressed",
  "unsupported",
] as const

export type ProspectSearchContactEligibilityState =
  (typeof PROSPECT_SEARCH_CONTACT_ELIGIBILITY_STATES)[number]

export type ProspectSearchContactEligibilityInput = {
  channel: ProspectSearchOutreachChannel
  email?: string | null
  phone?: string | null
  verification_status?: string | null
  confidence?: number | null
  company_suppressed?: boolean
  contact_suppressed?: boolean
  email_suppressed?: boolean
  phone_on_dnc?: boolean | null
  opt_out?: boolean
  last_checked_at?: string | null
  source_label?: string | null
  source_page_url?: string | null
  freshness_status?: import("@/lib/growth/prospect-search/prospect-search-contact-freshness").ProspectSearchContactFreshnessStatus
  email_verification_depth?: string | null
  phone_verification_depth?: string | null
}

export type ProspectSearchContactEligibilityResult = {
  channel: ProspectSearchOutreachChannel
  state: ProspectSearchContactEligibilityState
  eligible: boolean
  reason: string
  evidence: string[]
  last_checked_at: string | null
  source: string | null
}

function normalizePhoneDigits(phone: string | null | undefined): string {
  return phone?.replace(/\D/g, "") ?? ""
}

function isLikelyMobilePhone(phone: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(phone)
  if (digits.length < 10) return false
  const last10 = digits.slice(-10)
  const area = last10.slice(0, 3)
  if (area.startsWith("8") || area.startsWith("9")) return false
  return true
}

export function resolveContactOutreachEligibility(
  input: ProspectSearchContactEligibilityInput,
): ProspectSearchContactEligibilityResult {
  const evidence: string[] = []
  if (input.source_label?.trim()) evidence.push(input.source_label.trim())
  if (input.source_page_url?.trim()) evidence.push(`Source page: ${input.source_page_url.trim()}`)

  const suppressed =
    input.company_suppressed === true ||
    input.contact_suppressed === true ||
    input.opt_out === true

  if (suppressed) {
    return {
      channel: input.channel,
      state: "suppressed",
      eligible: false,
      reason: "Suppressed for outreach",
      evidence,
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }

  const freshnessStatus = input.freshness_status ?? "unknown"
  const staleFreshness = freshnessAffectsEligibility(freshnessStatus)
  if (freshnessStatus === "expired") {
    evidence.push("Verification expired — refresh required")
  } else if (freshnessStatus === "stale") {
    evidence.push("Contact data is stale")
  }

  const readiness = computeProspectSearchContactOutreachReadiness({
    email: input.email,
    phone: input.phone,
    verification_status: input.verification_status,
    confidence: input.confidence,
    suppressed: false,
  })

  if (input.channel === "email") {
    if (!readiness.email_available) {
      return {
        channel: input.channel,
        state: "unsupported",
        eligible: false,
        reason: "No evidence-backed email on file",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (input.email_suppressed) {
      return {
        channel: input.channel,
        state: "blocked",
        eligible: false,
        reason: "Email address is on suppression list",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (!readiness.email_verified) {
      return {
        channel: input.channel,
        state: "verification_required",
        eligible: false,
        reason: "Email found — verification pending before outreach",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (freshnessStatus === "expired") {
      return {
        channel: input.channel,
        state: "verification_required",
        eligible: false,
        reason: "Verification expired — refresh before email outreach",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (staleFreshness) {
      const publishedEmail =
        input.email_verification_depth === "published_on_website" && readiness.email_verified
      if (publishedEmail) {
        return {
          channel: input.channel,
          state: "eligible",
          eligible: (input.confidence ?? 0) >= 0.45,
          reason: "Email published on website — freshness warning, verify before outreach",
          evidence,
          last_checked_at: input.last_checked_at ?? null,
          source: input.source_label ?? null,
        }
      }
      return {
        channel: input.channel,
        state: "needs_review",
        eligible: false,
        reason: "Stale verified email — operator review required before outreach",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if ((input.confidence ?? 0) < 0.45) {
      return {
        channel: input.channel,
        state: "needs_review",
        eligible: false,
        reason: "Confidence below outreach threshold — operator review required",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    return {
      channel: input.channel,
      state: "eligible",
      eligible: true,
      reason: "Email verified and ready for operator outreach",
      evidence,
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }

  if (input.channel === "call") {
    if (!readiness.phone_available) {
      return {
        channel: input.channel,
        state: "unsupported",
        eligible: false,
        reason: "No evidence-backed phone on file",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (input.phone_on_dnc === true) {
      return {
        channel: input.channel,
        state: "blocked",
        eligible: false,
        reason: "DNC blocked — phone is on do-not-call registry",
        evidence: [...evidence, "Matched voice.voice_dnc_entries"],
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (input.phone_on_dnc === null) {
      return {
        channel: input.channel,
        state: "needs_review",
        eligible: false,
        reason: "Phone found — DNC verification pending",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (!readiness.phone_verified && !readiness.call_ready) {
      return {
        channel: input.channel,
        state: "verification_required",
        eligible: false,
        reason: "Phone found, verification pending",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (freshnessStatus === "expired") {
      return {
        channel: input.channel,
        state: "verification_required",
        eligible: false,
        reason: "Verification expired — refresh before calling",
        evidence,
        last_checked_at: input.last_checked_at ?? null,
        source: input.source_label ?? null,
      }
    }
    if (staleFreshness) {
      const publishedPhone =
        input.phone_verification_depth === "published_on_website" && readiness.call_ready
      if (publishedPhone) {
        const callEligible = (input.confidence ?? 0) >= 0.45
        return {
          channel: input.channel,
          state: callEligible ? "eligible" : "needs_review",
          eligible: callEligible,
          reason:
            "Call ready — website-published phone; freshness warning, review before dialing",
          evidence,
          last_checked_at: input.last_checked_at ?? null,
          source: input.source_label ?? null,
        }
      }
      if (readiness.call_ready) {
        return {
          channel: input.channel,
          state: "needs_review",
          eligible: false,
          reason: "Stale phone record — review before calling",
          evidence,
          last_checked_at: input.last_checked_at ?? null,
          source: input.source_label ?? null,
        }
      }
    }
    const callEligible = readiness.call_ready && (input.confidence ?? 0) >= 0.45
    return {
      channel: input.channel,
      state: callEligible ? "eligible" : "needs_review",
      eligible: callEligible,
      reason: callEligible
        ? "Call ready — operator may dial after compliance review"
        : "Office line only — review before calling",
      evidence,
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }

  if (!readiness.phone_available) {
    return {
      channel: input.channel,
      state: "unsupported",
      eligible: false,
      reason: "SMS requires an evidence-backed phone number",
      evidence,
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }
  if (input.phone_on_dnc === true) {
    return {
      channel: input.channel,
      state: "blocked",
      eligible: false,
      reason: "DNC blocked — SMS not permitted for this number",
      evidence: [...evidence, "Matched voice.voice_dnc_entries"],
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }
  if (!isLikelyMobilePhone(input.phone)) {
    return {
      channel: input.channel,
      state: "unsupported",
      eligible: false,
      reason: "Office line only — SMS channel unsupported",
      evidence,
      last_checked_at: input.last_checked_at ?? null,
      source: input.source_label ?? null,
    }
  }
  return {
    channel: input.channel,
    state: "needs_review",
    eligible: false,
    reason: "SMS channel requires operator review — no autonomous send",
    evidence,
    last_checked_at: input.last_checked_at ?? null,
    source: input.source_label ?? null,
  }
}

export function resolveContactOutreachEligibilityBundle(input: Omit<
  ProspectSearchContactEligibilityInput,
  "channel"
>): {
  email: ProspectSearchContactEligibilityResult
  call: ProspectSearchContactEligibilityResult
  sms: ProspectSearchContactEligibilityResult
  call_ready: boolean
  sms_ready: boolean
  call_block_reason: string | null
  sms_block_reason: string | null
} {
  const email = resolveContactOutreachEligibility({ ...input, channel: "email" })
  const call = resolveContactOutreachEligibility({ ...input, channel: "call" })
  const sms = resolveContactOutreachEligibility({ ...input, channel: "sms" })
  return {
    email,
    call,
    sms,
    call_ready: call.eligible,
    sms_ready: sms.eligible,
    call_block_reason: call.eligible ? null : call.reason,
    sms_block_reason: sms.eligible ? null : sms.reason,
  }
}
