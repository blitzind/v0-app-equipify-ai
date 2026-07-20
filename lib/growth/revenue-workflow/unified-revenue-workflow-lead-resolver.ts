/**
 * GE-LAUNCH-1A — Idempotent lead resolution for unified intake.
 * Reuses import dedupe + growth lead repository — no source-specific workflows.
 */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { buildDefaultProductionLeadMetadata } from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import { findImportDedupeMatch } from "@/lib/growth/import/dedupe"
import {
  createGrowthLead,
  fetchGrowthLeadById,
} from "@/lib/growth/lead-repository"
import type { GrowthLead, GrowthLeadSourceKind } from "@/lib/growth/types"
import {
  buildLeadAdmissionMetadata,
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import type { NormalizedLeadIntake } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"

export type UnifiedLeadResolutionResult = {
  lead: GrowthLead
  created: boolean
  dedupeRule: string | null
}

function mapIntakeSourceToLeadSourceKind(source: NormalizedLeadIntake["source"]): GrowthLeadSourceKind {
  switch (source) {
    case "manual":
      return "manual"
    case "csv_import":
    case "apollo":
    case "pdl":
    case "datamoon":
      return "import"
    case "linkedin_capture":
    case "browser_intake":
      return "browser_extension"
    case "saved_search":
      return "acquisition"
    case "website":
      return "web"
    default:
      return "manual"
  }
}

function buildExternalRef(intake: NormalizedLeadIntake): string {
  if (intake.externalRef) return intake.externalRef
  return `unified_intake:${intake.source}:${randomUUID()}`
}

function mapIntakeSourceToBindingSource(
  source: NormalizedLeadIntake["source"],
): import("@/lib/growth/relationship/intake-relationship-graph-binding").IntakeRelationshipBindingSource {
  switch (source) {
    case "datamoon":
      return "datamoon"
    case "linkedin_capture":
    case "browser_intake":
      return "browser_capture"
    case "manual":
      return "manual_lead"
    default:
      return "discovery_import"
  }
}

export async function resolveUnifiedLeadFromIntake(
  admin: SupabaseClient,
  intake: NormalizedLeadIntake,
  actor?: { userId: string | null; email?: string | null },
): Promise<UnifiedLeadResolutionResult> {
  if (intake.leadId) {
    const existing = await fetchGrowthLeadById(admin, intake.leadId)
    if (existing) {
      return { lead: existing, created: false, dedupeRule: "lead_id" }
    }
  }

  if (intake.importRow) {
    const externalRef = buildExternalRef(intake)
    const dedupe = await findImportDedupeMatch(admin, {
      vendorKey: intake.source,
      row: intake.importRow,
      externalRef,
    })
    if (dedupe) {
      const existing = await fetchGrowthLeadById(admin, dedupe.leadId)
      if (existing) {
        logGrowthEngine("unified_intake_dedupe_match", {
          leadId: existing.id,
          rule: dedupe.rule,
          source: intake.source,
        })
        return { lead: existing, created: false, dedupeRule: dedupe.rule }
      }
    }
  }

  if (intake.blockers.includes("company_name_required")) {
    throw new Error("company_name_required")
  }

  const organizationId = getGrowthEngineAiOrgId()
  const admissionContext = organizationId
    ? await loadGrowthLeadAdmissionContext(admin, organizationId)
    : { approvedProfile: null, activeMissionTitle: null }
  const admission = evaluateGrowthLeadAdmission(intake, admissionContext)

  if (!admission.allowLeadCreation) {
    throw new Error("invalid_company_identity")
  }

  const sourceKind = mapIntakeSourceToLeadSourceKind(intake.source)
  const externalRef = buildExternalRef(intake)
  const sourceDetail = `${intake.source}:${externalRef}`

  const lead = await createGrowthLead(admin, {
    sourceKind,
    sourceDetail,
    externalRef,
    companyName: admission.sanitized.companyName,
    contactName: intake.contactName,
    contactEmail: intake.email,
    contactPhone: intake.phone,
    website: admission.sanitized.website,
    createdBy: actor?.userId ?? null,
    status: admission.leadStatus,
    intakeBindingSource: mapIntakeSourceToBindingSource(intake.source),
    metadata: buildDefaultProductionLeadMetadata({
      ...intake.metadata,
      unified_intake_source: intake.source,
      identity_uncertain: intake.identityUncertain,
      requires_human_review: admission.requiresHumanReview,
      linkedin_url: intake.linkedinUrl,
      contact_title: intake.title,
      ...buildLeadAdmissionMetadata(admission),
    }),
  })

  if (intake.contactName) {
    await createGrowthLeadDecisionMaker(admin, {
      leadId: lead.id,
      fullName: intake.contactName,
      title: intake.title,
      email: intake.email,
      phone: intake.phone,
      linkedinUrl: intake.linkedinUrl,
      source: intake.source,
      sourceDetail,
      evidenceExcerpt: sourceDetail,
      status: intake.identityUncertain ? "candidate" : "confirmed",
      confidence: intake.identityUncertain ? 0.55 : 0.82,
      isPrimary: true,
      createdBy: actor?.userId ?? null,
    })
  }

  logGrowthEngine("unified_intake_lead_created", {
    leadId: lead.id,
    source: intake.source,
    identityUncertain: intake.identityUncertain,
  })

  return { lead, created: true, dedupeRule: null }
}
