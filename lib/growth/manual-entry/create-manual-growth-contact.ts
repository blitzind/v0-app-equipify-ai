import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import { createGrowthLead, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  buildEmailVerificationMetadata,
  verifyEmailWithProvider,
} from "@/lib/growth/contact-verification/email-verification-service"
import {
  manualContactInputToImportRow,
  type GrowthManualContactEntryInput,
  type GrowthManualContactEntryResult,
  type GrowthManualContactEntryWarning,
} from "@/lib/growth/manual-entry/manual-contact-entry-types"
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { emitGrowthLeadCreatedTimeline } from "@/lib/growth/timeline-emitter"
import { buildDefaultCapturedLeadReviewMetadata } from "@/lib/growth/captured-leads/captured-lead-actions"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function createManualGrowthContact(
  admin: SupabaseClient,
  input: GrowthManualContactEntryInput & { created_by?: string | null; actor_email?: string | null },
): Promise<GrowthManualContactEntryResult> {
  const warnings: GrowthManualContactEntryWarning[] = []
  const companyName = asString(input.company_name)
  const contactName = asString(input.contact_name)

  if (!companyName) {
    return { status: "error", message: "company_name_required", warnings }
  }
  if (!contactName) {
    return { status: "error", message: "contact_name_required", warnings }
  }

  const email = asString(input.email).toLowerCase() || null
  const externalRef = `manual:entry:${randomUUID()}`
  const normalized = manualContactInputToImportRow(input, externalRef)

  if (email) {
    const suppression = await assertEmailSendAllowed(admin, email)
    if (!suppression.allowed) {
      logGrowthEngine("manual_contact_entry_suppressed", {
        email,
        reason: suppression.reason,
        blockLayer: suppression.blockLayer,
      })
      return {
        status: "suppressed",
        reason: suppression.reason ?? "email_suppressed",
        block_layer: suppression.blockLayer ?? null,
        warnings: [
          {
            code: "suppression_blocked",
            message: suppression.reason ?? "Email is on the suppression list.",
          },
        ],
      }
    }
  }

  const dedupe = await findImportDedupeMatch(admin, {
    vendorKey: "manual_entry",
    row: normalized,
    externalRef,
  })
  const action = proposeImportRowAction(dedupe, "skip_high_confidence")

  if ((action === "skip" || action === "merge") && dedupe) {
    warnings.push({
      code: "duplicate_match",
      message: `Matched existing lead (${dedupe.rule}, ${Math.round(dedupe.confidence * 100)}% confidence). Linked instead of creating a new lead.`,
    })
    logGrowthEngine("manual_contact_entry_linked_duplicate", {
      leadId: dedupe.leadId,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
    })
    const existingLead = await fetchGrowthLeadById(admin, dedupe.leadId)
    return {
      status: "linked_duplicate",
      lead_id: dedupe.leadId,
      lead_status: existingLead?.status ?? "unknown",
      lead_created: false,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
      warnings,
    }
  }

  let emailStatus: string | null = email ? "unknown" : null
  let verifiedByProvider = false
  const leadMetadata: Record<string, unknown> = {
    manual_entry: {
      source_note: asString(input.source_note) || null,
      acquisition_run_id: input.acquisition_run_id ?? null,
      entered_at: new Date().toISOString(),
      external_ref: externalRef,
    },
    ...buildDefaultCapturedLeadReviewMetadata(),
  }

  if (email && input.verify_email) {
    const verification = await verifyEmailWithProvider(email, { admin })
    if (verification) {
      emailStatus = verification.email_status
      verifiedByProvider = verification.verified_by_provider
      Object.assign(leadMetadata, buildEmailVerificationMetadata(verification))
      if (verification.email_status === "blocked" || verification.blocked_by_suppression) {
        return {
          status: "suppressed",
          reason: verification.reasons[0] ?? "email_blocked",
          warnings: [
            {
              code: "verification_blocked",
              message: verification.reasons.join(" · ") || "Email failed verification or suppression.",
            },
          ],
        }
      }
      if (verification.email_status === "invalid") {
        warnings.push({
          code: "email_invalid",
          message: `Email marked invalid by verification (${verification.provider_name ?? "provider"}). Lead was still created.`,
        })
      }
    }
  } else if (email) {
    warnings.push({
      code: "email_unverified",
      message: "Email saved without provider verification. Status is unknown until verified.",
    })
  }

  const sourceDetail = asString(input.source_note) || "manual_entry"
  const notesParts = [sourceDetail]
  if (asString(input.title)) notesParts.push(`Title: ${asString(input.title)}`)
  if (asString(input.linkedin_url)) notesParts.push(`LinkedIn: ${asString(input.linkedin_url)}`)

  try {
    const lead = await createGrowthLead(admin, {
      sourceKind: "manual",
      sourceDetail,
      externalRef,
      companyName: normalized.companyName,
      contactName: normalized.contactName,
      contactEmail: email,
      contactPhone: normalized.phone,
      website: normalized.website,
      addressLine1: normalized.addressLine1,
      city: normalized.city,
      state: normalized.state,
      postalCode: normalized.postalCode,
      country: normalized.country,
      notes: notesParts.filter(Boolean).join("\n"),
      createdBy: input.created_by ?? null,
      intakeBindingSource: "manual_lead",
      metadata: leadMetadata,
    })

    const decisionMaker = await createGrowthLeadDecisionMaker(admin, {
      leadId: lead.id,
      fullName: contactName,
      title: normalized.title,
      email,
      phone: normalized.phone,
      linkedinUrl: normalized.linkedinUrl,
      source: "manual",
      sourceDetail,
      evidenceExcerpt: sourceDetail,
      status: "confirmed",
      confidence: 0.85,
      isPrimary: true,
      createdBy: input.created_by ?? null,
    })

    await emitGrowthLeadCreatedTimeline(admin, {
      leadId: lead.id,
      companyName: lead.companyName,
      sourceKind: "manual",
      actor: input.created_by
        ? { userId: input.created_by, email: input.actor_email ?? null }
        : undefined,
    })

    await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

    logGrowthEngine("manual_contact_entry_created", {
      leadId: lead.id,
      decisionMakerId: decisionMaker.id,
      emailStatus,
      verifiedByProvider,
    })

    return {
      status: "created",
      lead_id: lead.id,
      lead_status: lead.status,
      lead_created: true,
      decision_maker_id: decisionMaker.id,
      email_status: emailStatus,
      verified_by_provider: verifiedByProvider,
      warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed"
    logGrowthEngine("manual_contact_entry_failed", { message })
    return { status: "error", message, warnings }
  }
}
