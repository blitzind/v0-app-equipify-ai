import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchCapturedGrowthLeadRow } from "@/lib/growth/captured-leads/captured-lead-repository"
import {
  buildCapturedLeadReviewPatch,
} from "@/lib/growth/captured-leads/captured-lead-projection"
import type {
  GrowthCapturedLeadAction,
  GrowthCapturedLeadActionResult,
} from "@/lib/growth/captured-leads/captured-lead-types"
import { isGrowthCapturedLeadSource } from "@/lib/growth/captured-leads/captured-lead-types"
import { queueBrowserIntakeContactDiscovery } from "@/lib/growth/browser-intake/queue-browser-intake-contact-discovery"
import {
  buildEmailVerificationMetadata,
  verifyEmailWithProvider,
} from "@/lib/growth/contact-verification/email-verification-service"
import { fetchGrowthLeadById, updateGrowthLeadFromImportMerge } from "@/lib/growth/lead-repository"
import { nativeCallWorkspaceHref } from "@/lib/growth/native-dialer/native-dialer-navigation"
import { seedNativeDialerQueueFromCallQueue } from "@/lib/growth/native-dialer/native-dialer-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { createGrowthSequenceEnrollmentDraft } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function patchLeadMetadata(
  admin: SupabaseClient,
  leadId: string,
  metadataPatch: Record<string, unknown>,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) throw new Error("lead_not_found")

  await updateGrowthLeadFromImportMerge(admin, leadId, {
    metadata: {
      ...(lead.metadata ?? {}),
      ...metadataPatch,
    },
  })
}

export async function runCapturedLeadAction(
  admin: SupabaseClient,
  input: {
    leadId: string
    action: GrowthCapturedLeadAction
    actorUserId: string
    actorEmail: string
  },
): Promise<GrowthCapturedLeadActionResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return {
      ok: false,
      action: input.action,
      lead_id: input.leadId,
      message: "Lead not found.",
    }
  }

  if (!isGrowthCapturedLeadSource(lead.sourceKind)) {
    return {
      ok: false,
      action: input.action,
      lead_id: input.leadId,
      message: "Lead is not from manual entry or browser extension capture.",
    }
  }

  if (input.action === "mark_reviewed") {
    await patchLeadMetadata(
      admin,
      lead.id,
      buildCapturedLeadReviewPatch({ status: "reviewed", reviewedBy: input.actorUserId }),
    )
    logGrowthEngine("captured_lead_marked_reviewed", { leadId: lead.id, actorEmail: input.actorEmail })
    const row = await fetchCapturedGrowthLeadRow(admin, lead.id)
    return {
      ok: true,
      action: input.action,
      lead_id: lead.id,
      message: "Marked as reviewed.",
      row: row ?? undefined,
    }
  }

  if (input.action === "verify_email") {
    const email = asString(lead.contactEmail)
    if (!email) {
      return {
        ok: false,
        action: input.action,
        lead_id: lead.id,
        message: "Lead has no email to verify.",
      }
    }

    const verification = await verifyEmailWithProvider(email, { admin, leadId: lead.id })
    if (!verification) {
      return {
        ok: false,
        action: input.action,
        lead_id: lead.id,
        message: "Email verification did not return a result.",
      }
    }

    await patchLeadMetadata(admin, lead.id, buildEmailVerificationMetadata(verification))
    await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

    logGrowthEngine("captured_lead_email_verified", {
      leadId: lead.id,
      emailStatus: verification.email_status,
      actorEmail: input.actorEmail,
    })

    const row = await fetchCapturedGrowthLeadRow(admin, lead.id)
    return {
      ok: true,
      action: input.action,
      lead_id: lead.id,
      message: `Email verification: ${verification.email_status}.`,
      row: row ?? undefined,
    }
  }

  if (input.action === "queue_contact_discovery") {
    const queued = await queueBrowserIntakeContactDiscovery(admin, {
      leadId: lead.id,
      createdBy: input.actorUserId,
    })

    logGrowthEngine("captured_lead_discovery_queued", {
      leadId: lead.id,
      companyCandidateId: queued.company_candidate_id,
      actorEmail: input.actorEmail,
    })

    const row = await fetchCapturedGrowthLeadRow(admin, lead.id)
    return {
      ok: true,
      action: input.action,
      lead_id: lead.id,
      message: "Contact discovery queued.",
      company_candidate_id: queued.company_candidate_id,
      row: row ?? undefined,
    }
  }

  if (input.action === "add_to_call_queue") {
    const phone = asString(lead.contactPhone)
    if (!phone) {
      return {
        ok: false,
        action: input.action,
        lead_id: lead.id,
        message: "Add a phone number before queueing for calls.",
      }
    }

    const queueItem = await seedNativeDialerQueueFromCallQueue(admin, {
      leadId: lead.id,
      phoneNumber: phone,
      contactName: lead.contactName,
      companyName: lead.companyName,
      reason: "Captured lead follow-up",
      queueMode: "priority",
      priorityScore: 70,
    })

    logGrowthEngine("captured_lead_call_queue_added", {
      leadId: lead.id,
      queueItemId: queueItem.id,
      actorEmail: input.actorEmail,
    })

    return {
      ok: true,
      action: input.action,
      lead_id: lead.id,
      message: "Added to native dialer call queue.",
      queue_item_id: queueItem.id,
      workspace_href: nativeCallWorkspaceHref({
        leadId: lead.id,
        phone,
        queueItemId: queueItem.id,
      }),
    }
  }

  if (input.action === "create_sequence_draft") {
    const enrollment = await createGrowthSequenceEnrollmentDraft(admin, {
      leadId: lead.id,
      actingUserId: input.actorUserId,
      actingUserEmail: input.actorEmail,
    })

    logGrowthEngine("captured_lead_sequence_draft_created", {
      leadId: lead.id,
      enrollmentId: enrollment.id,
      actorEmail: input.actorEmail,
    })

    return {
      ok: true,
      action: input.action,
      lead_id: lead.id,
      message: "Sequence draft created. Confirm before any outreach sends.",
      enrollment_id: enrollment.id,
    }
  }

  return {
    ok: false,
    action: input.action,
    lead_id: lead.id,
    message: "Unsupported action.",
  }
}

export function buildDefaultCapturedLeadReviewMetadata(): Record<string, unknown> {
  return buildCapturedLeadReviewPatch({ status: "needs_review", reviewedBy: null })
}
