import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  browserIntakeHasContactData,
  browserIntakeInputToImportRow,
  normalizeBrowserIntakeSourcePlatform,
  resolveBrowserIntakeContactName,
  type GrowthBrowserIntakeCaptureMeta,
  type GrowthBrowserIntakeContactInput,
  type GrowthBrowserIntakeResult,
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
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { emitGrowthLeadCreatedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLead } from "@/lib/growth/types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function buildBrowserIntakeCaptureMeta(
  input: GrowthBrowserIntakeContactInput,
  externalRef: string,
  sourcePlatform: ReturnType<typeof normalizeBrowserIntakeSourcePlatform>,
): GrowthBrowserIntakeCaptureMeta {
  return {
    source_kind: "browser_extension",
    source_url: asString(input.source_url) || null,
    source_platform: sourcePlatform,
    captured_at: new Date().toISOString(),
    external_ref: externalRef,
    notes: asString(input.notes) || null,
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
    contactInput: GrowthBrowserIntakeContactInput
    normalized: ReturnType<typeof browserIntakeInputToImportRow>
    sourcePlatform: ReturnType<typeof normalizeBrowserIntakeSourcePlatform>
    sourceDetail: string
    createdBy: string | null
  },
): Promise<string | null> {
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

export async function createBrowserIntakeContact(
  admin: SupabaseClient,
  input: GrowthBrowserIntakeContactInput & { created_by?: string | null; actor_email?: string | null },
): Promise<GrowthBrowserIntakeResult> {
  const warnings: GrowthBrowserIntakeWarning[] = []
  const companyName = asString(input.company_name)
  const sourcePlatform = normalizeBrowserIntakeSourcePlatform(input.source_platform)

  if (!companyName) {
    return { status: "error", message: "company_name_required", warnings }
  }
  if (!browserIntakeHasContactData(input)) {
    return { status: "error", message: "contact_data_required", warnings }
  }

  const email = asString(input.email).toLowerCase() || null
  const externalRef = `browser_extension:${randomUUID()}`
  const normalized = browserIntakeInputToImportRow(input, externalRef)
  const capture = buildBrowserIntakeCaptureMeta(input, externalRef, sourcePlatform)
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
      }
    }
  }

  const dedupe = await findImportDedupeMatch(admin, {
    vendorKey: "browser_extension",
    row: normalized,
    externalRef,
  })
  const action = proposeImportRowAction(dedupe, "merge_empty_fields")

  if (action === "merge" && dedupe) {
    const existingLead = await fetchGrowthLeadById(admin, dedupe.leadId)
    if (!existingLead) {
      return { status: "error", message: "merge_target_missing", warnings }
    }

    const patch = buildBrowserIntakeMergePatch(existingLead, normalized, capture)
    const lead = await updateGrowthLeadFromImportMerge(admin, dedupe.leadId, patch)
    if (!lead) {
      return { status: "error", message: "merge_failed", warnings }
    }

    let decisionMakerId: string | null = null
    try {
      decisionMakerId = await maybeCreateBrowserIntakeDecisionMaker(admin, {
        leadId: lead.id,
        contactInput: input,
        normalized,
        sourcePlatform,
        sourceDetail,
        createdBy: input.created_by ?? null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "decision_maker_create_failed"
      warnings.push({ code: "decision_maker_create_failed", message })
    }

    await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

    logGrowthEngine("browser_intake_updated", {
      leadId: lead.id,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
      decisionMakerId,
    })

    return {
      status: "updated",
      lead_id: lead.id,
      decision_maker_id: decisionMakerId,
      rule: dedupe.rule,
      confidence: dedupe.confidence,
      warnings,
    }
  }

  const notesParts = [asString(input.notes)].filter(Boolean)
  if (asString(input.title)) notesParts.push(`Title: ${asString(input.title)}`)
  if (asString(input.linkedin_url)) notesParts.push(`LinkedIn: ${asString(input.linkedin_url)}`)
  if (asString(input.source_url)) notesParts.push(`Source: ${asString(input.source_url)}`)

  const linkedinSlug = normalizeLinkedIn(normalized.linkedinUrl)
  const leadMetadata: Record<string, unknown> = {
    browser_extension: capture,
    browser_extension_captures: [capture],
    ...(linkedinSlug ? { import: { linkedin: linkedinSlug } } : {}),
  }

  try {
    const lead = await createGrowthLead(admin, {
      sourceKind: "browser_extension",
      sourceDetail,
      externalRef,
      companyName: normalized.companyName,
      contactName: normalized.contactName ?? resolveBrowserIntakeContactName(input),
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
      metadata: leadMetadata,
    })

    let decisionMakerId: string | null = null
    try {
      decisionMakerId = await maybeCreateBrowserIntakeDecisionMaker(admin, {
        leadId: lead.id,
        contactInput: input,
        normalized,
        sourcePlatform,
        sourceDetail,
        createdBy: input.created_by ?? null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "decision_maker_create_failed"
      warnings.push({ code: "decision_maker_create_failed", message })
    }

    await emitGrowthLeadCreatedTimeline(admin, {
      leadId: lead.id,
      companyName: lead.companyName,
      sourceKind: "browser_extension",
      actor: input.created_by
        ? { userId: input.created_by, email: input.actor_email ?? null }
        : undefined,
    })

    await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

    logGrowthEngine("browser_intake_created", {
      leadId: lead.id,
      decisionMakerId,
      sourcePlatform,
    })

    return {
      status: "created",
      lead_id: lead.id,
      decision_maker_id: decisionMakerId,
      warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "create_failed"
    logGrowthEngine("browser_intake_failed", { message })
    return { status: "error", message, warnings }
  }
}
