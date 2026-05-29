import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  browserIntakeHasContactData,
  browserIntakeInputToImportRow,
  browserIntakeIsCompanyOnlyCapture,
  normalizeBrowserIntakeCaptureMethod,
  normalizeBrowserIntakeSourcePlatform,
  resolveBrowserIntakeContactName,
  type GrowthBrowserIntakeCaptureMeta,
  type GrowthBrowserIntakeResult,
  type GrowthBrowserIntakeServiceInput,
  type GrowthBrowserIntakeWarning,
} from "@/lib/growth/browser-intake/browser-intake-types"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import { normalizeLinkedIn } from "@/lib/growth/import/normalize"
import {
  createGrowthLead,
  fetchGrowthLeadById,
  updateGrowthLeadFromImportMerge,
} from "@/lib/growth/lead-repository"
import { queueBrowserIntakeContactDiscovery } from "@/lib/growth/browser-intake/queue-browser-intake-contact-discovery"
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { emitGrowthLeadCreatedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildBrowserIntakeCaptureMeta(
  input: GrowthBrowserIntakeServiceInput,
  externalRef: string,
  sourcePlatform: ReturnType<typeof normalizeBrowserIntakeSourcePlatform>,
  captureType: "company_only" | "contact",
): GrowthBrowserIntakeCaptureMeta {
  return {
    source_kind: "browser_extension",
    source_url: asString(input.source_url) || null,
    source_platform: sourcePlatform,
    page_title: asString(input.page_title) || null,
    captured_at: new Date().toISOString(),
    capture_method: normalizeBrowserIntakeCaptureMethod(input.capture_method),
    external_ref: externalRef,
    notes: asString(input.notes) || null,
    linkedin_url: asString(input.linkedin_url) || null,
    capture_type: captureType,
  }
}

function buildBrowserIntakeMergePatch(
  existing: GrowthLead,
  normalized: ReturnType<typeof browserIntakeInputToImportRow>,
  capture: GrowthBrowserIntakeCaptureMeta,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const existingMetadata = existing.metadata ?? {}
  const priorCaptures = Array.isArray(existingMetadata.browser_extension_captures)
    ? (existingMetadata.browser_extension_captures as GrowthBrowserIntakeCaptureMeta[])
    : existingMetadata.browser_extension
      ? [existingMetadata.browser_extension as GrowthBrowserIntakeCaptureMeta]
      : []

  const linkedinSlug = normalizeLinkedIn(normalized.linkedinUrl)
  const importMeta = {
    ...(((existingMetadata.import as Record<string, unknown> | undefined) ?? {})),
    ...(linkedinSlug ? { linkedin: linkedinSlug } : {}),
  }

  patch.metadata = {
    ...existingMetadata,
    browser_extension: capture,
    browser_extension_captures: [...priorCaptures, capture],
    company_prospect:
      capture.capture_type === "company_only"
        ? {
            ...(typeof existingMetadata.company_prospect === "object" && existingMetadata.company_prospect
              ? (existingMetadata.company_prospect as Record<string, unknown>)
              : {}),
            status: "open",
            source: "browser_extension",
            updated_at: capture.captured_at,
          }
        : existingMetadata.company_prospect,
    ...(Object.keys(importMeta).length > 0 ? { import: importMeta } : {}),
  }

  if (!existing.contactName && normalized.contactName) patch.contact_name = normalized.contactName
  if (!existing.contactEmail && normalized.email) patch.contact_email = normalized.email
  if (!existing.contactPhone && normalized.phone) patch.contact_phone = normalized.phone
  if (!existing.website && normalized.website) patch.website = normalized.website
  if (!existing.city && normalized.city) patch.city = normalized.city
  if (!existing.state && normalized.state) patch.state = normalized.state

  return patch
}

async function maybeCreateBrowserIntakeDecisionMaker(
  admin: SupabaseClient,
  input: {
    leadId: string
    contactInput: GrowthBrowserIntakeServiceInput
    normalized: ReturnType<typeof browserIntakeInputToImportRow>
    sourcePlatform: ReturnType<typeof normalizeBrowserIntakeSourcePlatform>
    sourceDetail: string
    createdBy: string | null
  },
): Promise<string | null> {
  if (browserIntakeIsCompanyOnlyCapture(input.contactInput)) return null
  if (!browserIntakeHasContactData(input.contactInput)) return null

  const fullName = resolveBrowserIntakeContactName(input.contactInput)
  if (!fullName) return null

  const decisionMaker = await createGrowthLeadDecisionMaker(admin, {
    leadId: input.leadId,
    fullName,
    title: input.normalized.title,
    email: input.normalized.email,
    phone: input.normalized.phone,
    linkedinUrl: input.normalized.linkedinUrl,
    source: "manual",
    sourceDetail: `browser_extension:${input.sourcePlatform}`,
    evidenceExcerpt: asString(input.contactInput.source_url) || input.sourceDetail,
    status: "confirmed",
    confidence: 0.8,
    isPrimary: true,
    createdBy: input.createdBy,
  })

  return decisionMaker.id
}

async function maybeQueueContactDiscovery(
  admin: SupabaseClient,
  input: {
    leadId: string
    queueContactDiscovery: boolean
    createdBy: string | null
  },
): Promise<{ queued: boolean; company_candidate_id: string | null }> {
  if (!input.queueContactDiscovery) {
    return { queued: false, company_candidate_id: null }
  }

  const queued = await queueBrowserIntakeContactDiscovery(admin, {
    leadId: input.leadId,
    createdBy: input.createdBy,
  })

  return { queued: true, company_candidate_id: queued.company_candidate_id }
}

async function finalizeBrowserIntakeLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    contactInput: GrowthBrowserIntakeServiceInput
    normalized: ReturnType<typeof browserIntakeInputToImportRow>
    sourcePlatform: ReturnType<typeof normalizeBrowserIntakeSourcePlatform>
    sourceDetail: string
    captureType: "company_only" | "contact"
    queueContactDiscovery: boolean
    createdBy: string | null
    actorEmail: string | null
    emitCreatedTimeline: boolean
    companyName: string
  },
): Promise<{
  decisionMakerId: string | null
  contactDiscoveryQueued: boolean
  companyCandidateId: string | null
  warnings: GrowthBrowserIntakeWarning[]
}> {
  const warnings: GrowthBrowserIntakeWarning[] = []
  let decisionMakerId: string | null = null

  try {
    decisionMakerId = await maybeCreateBrowserIntakeDecisionMaker(admin, {
      leadId: input.leadId,
      contactInput: input.contactInput,
      normalized: input.normalized,
      sourcePlatform: input.sourcePlatform,
      sourceDetail: input.sourceDetail,
      createdBy: input.createdBy,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "decision_maker_create_failed"
    warnings.push({ code: "decision_maker_create_failed", message })
  }

  if (input.emitCreatedTimeline) {
    await emitGrowthLeadCreatedTimeline(admin, {
      leadId: input.leadId,
      companyName: input.companyName,
      sourceKind: "browser_extension",
      actor: input.createdBy
        ? { userId: input.createdBy, email: input.actorEmail ?? null }
        : undefined,
    })
  }

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)

  const queueResult = await maybeQueueContactDiscovery(admin, {
    leadId: input.leadId,
    queueContactDiscovery: input.queueContactDiscovery,
    createdBy: input.createdBy,
  })

  return {
    decisionMakerId,
    contactDiscoveryQueued: queueResult.queued,
    companyCandidateId: queueResult.company_candidate_id,
    warnings,
  }
}

export async function createBrowserIntakeContact(
  admin: SupabaseClient,
  input: GrowthBrowserIntakeServiceInput,
): Promise<GrowthBrowserIntakeResult> {
  const warnings: GrowthBrowserIntakeWarning[] = []
  const companyName = asString(input.company_name)
  const sourcePlatform = normalizeBrowserIntakeSourcePlatform(input.source_platform)
  const captureType: "company_only" | "contact" = browserIntakeIsCompanyOnlyCapture(input)
    ? "company_only"
    : "contact"
  const intakeMode = input.intake_mode ?? "default"
  const queueContactDiscovery = input.queue_contact_discovery === true

  if (!companyName) {
    return { status: "error", message: "company_name_required", warnings }
  }
  if (captureType === "contact" && !browserIntakeHasContactData(input)) {
    return { status: "error", message: "contact_data_required", warnings }
  }

  const email = asString(input.email).toLowerCase() || null
  const externalRef = `browser_extension:${randomUUID()}`
  const normalized = browserIntakeInputToImportRow(input, externalRef)
  const capture = buildBrowserIntakeCaptureMeta(input, externalRef, sourcePlatform, captureType)
  const sourceDetail = `${sourcePlatform}:${asString(input.source_url) || "unknown"}`

  if (email) {
    const suppression = await assertEmailSendAllowed(admin, email)
    if (!suppression.allowed) {
      logGrowthEngine("browser_intake_suppressed", {
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
        capture_type: captureType,
      }
    }
  }

  if (intakeMode === "update_existing" && input.target_lead_id) {
    const existingLead = await fetchGrowthLeadById(admin, input.target_lead_id)
    if (!existingLead) {
      return { status: "error", message: "target_lead_missing", warnings, capture_type: captureType }
    }

    const patch = buildBrowserIntakeMergePatch(existingLead, normalized, capture)
    const lead = await updateGrowthLeadFromImportMerge(admin, existingLead.id, patch)
    if (!lead) {
      return { status: "error", message: "merge_failed", warnings, capture_type: captureType }
    }

    const finalized = await finalizeBrowserIntakeLead(admin, {
      leadId: lead.id,
      contactInput: input,
      normalized,
      sourcePlatform,
      sourceDetail,
      captureType,
      queueContactDiscovery,
      createdBy: input.created_by ?? null,
      actorEmail: input.actor_email ?? null,
      emitCreatedTimeline: false,
      companyName: lead.companyName,
    })

    logGrowthEngine("browser_intake_updated_explicit", {
      leadId: lead.id,
      decisionMakerId: finalized.decisionMakerId,
      captureType,
    })

    return {
      status: "updated",
      lead_id: lead.id,
      decision_maker_id: finalized.decisionMakerId,
      rule: "explicit_target",
      confidence: 1,
      warnings: [...warnings, ...finalized.warnings],
      contact_discovery_queued: finalized.contactDiscoveryQueued,
      company_candidate_id: finalized.companyCandidateId,
      capture_type: captureType,
    }
  }

  const dedupe =
    intakeMode === "create_new"
      ? null
      : await findImportDedupeMatch(admin, {
          vendorKey: "browser_extension",
          row: normalized,
          externalRef,
        })
  const action =
    intakeMode === "create_new"
      ? "create_new"
      : proposeImportRowAction(dedupe, "merge_empty_fields")

  if (action === "merge" && dedupe) {
    const existingLead = await fetchGrowthLeadById(admin, dedupe.leadId)
    if (!existingLead) {
      return { status: "error", message: "merge_target_missing", warnings, capture_type: captureType }
    }

    const patch = buildBrowserIntakeMergePatch(existingLead, normalized, capture)
    const lead = await updateGrowthLeadFromImportMerge(admin, dedupe.leadId, patch)
    if (!lead) {
      return { status: "error", message: "merge_failed", warnings, capture_type: captureType }
    }

    const finalized = await finalizeBrowserIntakeLead(admin, {
      leadId: lead.id,
      contactInput: input,
      normalized,
      sourcePlatform,
      sourceDetail,
      captureType,
      queueContactDiscovery,
      createdBy: input.created_by ?? null,
      actorEmail: input.actor_email ?? null,
      emitCreatedTimeline: false,
      companyName: lead.companyName,
    })

    logGrowthEngine("browser_intake_updated", {
      leadId: lead.id,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
      decisionMakerId: finalized.decisionMakerId,
      captureType,
    })

    return {
      status: "updated",
      lead_id: lead.id,
      decision_maker_id: finalized.decisionMakerId,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
      warnings: [...warnings, ...finalized.warnings],
      contact_discovery_queued: finalized.contactDiscoveryQueued,
      company_candidate_id: finalized.companyCandidateId,
      capture_type: captureType,
    }
  }

  const notesParts = [asString(input.notes)].filter(Boolean)
  if (asString(input.page_title)) notesParts.push(`Page: ${asString(input.page_title)}`)
  if (asString(input.title)) notesParts.push(`Title: ${asString(input.title)}`)
  if (asString(input.linkedin_url)) notesParts.push(`LinkedIn: ${asString(input.linkedin_url)}`)
  if (asString(input.source_url)) notesParts.push(`Source: ${asString(input.source_url)}`)

  const linkedinSlug = normalizeLinkedIn(normalized.linkedinUrl)
  const leadMetadata: Record<string, unknown> = {
    browser_extension: capture,
    browser_extension_captures: [capture],
    ...(captureType === "company_only"
      ? {
          company_prospect: {
            status: "open",
            source: "browser_extension",
            created_at: capture.captured_at,
          },
        }
      : {}),
    ...(linkedinSlug ? { import: { linkedin: linkedinSlug } } : {}),
  }

  try {
    const lead = await createGrowthLead(admin, {
      sourceKind: "browser_extension",
      sourceDetail,
      externalRef,
      companyName: normalized.companyName,
      contactName:
        captureType === "company_only"
          ? null
          : normalized.contactName ?? resolveBrowserIntakeContactName(input),
      contactEmail: captureType === "company_only" ? null : email,
      contactPhone: captureType === "company_only" ? null : normalized.phone,
      website: normalized.website,
      addressLine1: normalized.addressLine1,
      city: normalized.city,
      state: normalized.state,
      postalCode: normalized.postalCode,
      country: normalized.country,
      notes: notesParts.filter(Boolean).join("\n"),
      createdBy: input.created_by ?? null,
      metadata: leadMetadata,
    })

    const finalized = await finalizeBrowserIntakeLead(admin, {
      leadId: lead.id,
      contactInput: input,
      normalized,
      sourcePlatform,
      sourceDetail,
      captureType,
      queueContactDiscovery,
      createdBy: input.created_by ?? null,
      actorEmail: input.actor_email ?? null,
      emitCreatedTimeline: true,
      companyName: lead.companyName,
    })

    logGrowthEngine("browser_intake_created", {
      leadId: lead.id,
      decisionMakerId: finalized.decisionMakerId,
      sourcePlatform,
      captureType,
      contactDiscoveryQueued: finalized.contactDiscoveryQueued,
    })

    return {
      status: "created",
      lead_id: lead.id,
      decision_maker_id: finalized.decisionMakerId,
      warnings: [...warnings, ...finalized.warnings],
      contact_discovery_queued: finalized.contactDiscoveryQueued,
      company_candidate_id: finalized.companyCandidateId,
      capture_type: captureType,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed"
    logGrowthEngine("browser_intake_failed", { message })
    return { status: "error", message, warnings, capture_type: captureType }
  }
}
