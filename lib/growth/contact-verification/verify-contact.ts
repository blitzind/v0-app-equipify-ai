/** Unified contact verification orchestration. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCompanyContactEmailStatus,
  GrowthCompanyContactPhoneStatus,
} from "@/lib/growth/contact-discovery/company-contact-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import {
  buildEmailVerificationMetadata,
  verifyEmailWithProvider,
} from "@/lib/growth/contact-verification/email-verification-service"
import type { EmailVerificationProviderResult } from "@/lib/growth/contact-verification/email-verification-types"
import { verifyPhoneNumber } from "@/lib/growth/contact-verification/verify-phone"

export type ContactVerificationBundle = {
  email_status: GrowthCompanyContactEmailStatus
  phone_status: GrowthCompanyContactPhoneStatus
  confidence_score: number
  verification_reasons: string[]
  last_verified_at: string
  email_verification: EmailVerificationProviderResult | null
  email_verification_metadata: Record<string, unknown>
}

const STALE_MS = 90 * 24 * 60 * 60 * 1000

export function isCompanyContactStale(contact: Pick<GrowthCompanyContact, "last_verified_at">, now = Date.now()): boolean {
  if (!contact.last_verified_at) return true
  return now - Date.parse(contact.last_verified_at) >= STALE_MS
}

export async function verifyCompanyContact(
  contact: Pick<
    GrowthCompanyContact,
    "email" | "phone" | "title" | "source_evidence" | "confidence_score" | "contact_status"
  >,
  options?: {
    admin?: SupabaseClient
    leadId?: string | null
  },
): Promise<ContactVerificationBundle> {
  const verification_reasons: string[] = []
  const context = contact.source_evidence.map((item) => item.evidence).join(" ")

  const emailResult = await verifyEmailWithProvider(contact.email, {
    admin: options?.admin,
    leadId: options?.leadId,
  })
  const phoneResult = verifyPhoneNumber(contact.phone, `${contact.title ?? ""} ${context}`)

  let email_status: GrowthCompanyContactEmailStatus = "unknown"
  if (emailResult) {
    email_status = emailResult.email_status
    verification_reasons.push(...emailResult.reasons.map((reason) => `Email: ${reason}`))
  }

  let phone_status: GrowthCompanyContactPhoneStatus = "unknown"
  if (phoneResult) {
    phone_status = phoneResult.phone_status
    verification_reasons.push(...phoneResult.reasons.map((reason) => `Phone: ${reason}`))
  }

  let confidence_score = contact.confidence_score
  if (emailResult) confidence_score = Math.max(confidence_score, Math.round(emailResult.confidence * 100))
  if (phoneResult) confidence_score = Math.max(confidence_score, Math.round(phoneResult.confidence * 100))
  confidence_score = Math.min(100, confidence_score)

  if (contact.contact_status === "verified") {
    confidence_score = Math.max(confidence_score, 80)
    verification_reasons.push("Operator verified contact")
  }

  return {
    email_status,
    phone_status,
    confidence_score,
    verification_reasons,
    last_verified_at: new Date().toISOString(),
    email_verification: emailResult,
    email_verification_metadata: emailResult ? buildEmailVerificationMetadata(emailResult) : {},
  }
}
