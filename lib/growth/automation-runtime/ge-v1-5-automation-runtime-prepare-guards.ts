/** GE-AUTO-1D — Suppression and opt-out checks before GeV15 prepare (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluatePreSendAllowed } from "@/lib/growth/compliance/pre-send-assertion"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadPhoneDncLookup } from "@/lib/growth/prospect-search/prospect-search-contact-eligibility-server"
import { loadProspectSearchSuppressionLookup } from "@/lib/growth/prospect-search/prospect-search-suppression-overlays"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import { evaluateAndAuditCompliance } from "@/lib/voice/compliance-orchestration/compliance-orchestration-service"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"

export const GE_AUTO_1D_PREPARE_GUARDS_QA_MARKER = "growth-autonomy-ge-auto-1d-v1" as const

export type GeV15PrepareSuppressionResult =
  | { allowed: true; reason: null; code: null }
  | { allowed: false; reason: string; code: string }

export async function evaluateGeV15PrepareSuppression(
  admin: SupabaseClient,
  input: {
    channel: "email" | "sms" | "voice_drop"
    organizationId: string
    leadId: string
    recipientEmail?: string | null
    recipientPhone?: string | null
    senderProfileId?: string | null
    sequenceId?: string | null
  },
): Promise<GeV15PrepareSuppressionResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return { allowed: false, reason: "Lead not found.", code: "lead_not_found" }
  }

  if (!input.senderProfileId) {
    return { allowed: false, reason: "Sender profile is required before prepare.", code: "missing_sender_profile" }
  }

  if (input.channel === "email") {
    const email = (input.recipientEmail ?? lead.contactEmail ?? "").trim()
    if (!email) {
      return { allowed: false, reason: "Recipient email is missing.", code: "missing_recipient" }
    }

    const preSend = await evaluatePreSendAllowed(admin, {
      email,
      leadId: input.leadId,
      senderAccountId: input.senderProfileId,
    })
    if (!preSend.allowed) {
      return {
        allowed: false,
        reason: preSend.reason ?? "Recipient blocked by pre-send compliance.",
        code: preSend.blockCode ?? "pre_send_blocked",
      }
    }

    return { allowed: true, reason: null, code: null }
  }

  const phone = normalizeToE164(input.recipientPhone ?? lead.contactPhone ?? "")
  if (!phone) {
    return { allowed: false, reason: "Recipient phone is invalid or missing.", code: "invalid_phone" }
  }

  const suppressionLookup = await loadProspectSearchSuppressionLookup(admin)
  const overlay = suppressionLookup.matchForIdentifiers({
    email: lead.contactEmail,
    phone,
    company_name: lead.companyName,
    website: lead.website,
    growth_lead_id: lead.id,
  })
  if (overlay.is_suppressed) {
    return { allowed: false, reason: "Contact is suppressed.", code: "contact_suppressed" }
  }

  const dncLookup = await loadPhoneDncLookup(admin, [phone])
  const normalized = normalizePhoneNumber(phone) || phone.replace(/\D/g, "")
  if (dncLookup.has(normalized)) {
    return { allowed: false, reason: "Recipient is on the do-not-contact list.", code: "dnc_listed" }
  }

  if (input.channel === "sms") {
    return { allowed: true, reason: null, code: null }
  }

  const compliance = await evaluateAndAuditCompliance(admin, {
    organizationId: input.organizationId,
    phoneNumber: phone,
    channel: "voicemail",
    skipAudit: false,
  })

  if (!compliance.allowed || compliance.blocked) {
    return {
      allowed: false,
      reason: compliance.reasons.join("; ") || "Voice drop recipient blocked by compliance.",
      code: "voice_suppressed",
    }
  }

  return { allowed: true, reason: null, code: null }
}
