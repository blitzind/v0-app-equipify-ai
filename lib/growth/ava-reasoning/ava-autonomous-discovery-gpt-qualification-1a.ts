/**
 * AVA-SIMPLE-GPT-QUALIFICATION-1A — Direct GPT-5.5 qualification for autonomous DataMoon discovery.
 * Bypasses deterministic admission/research gates. Reuses supervised Ava outreach + Home review.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import { runEquipifySupervisedAvaOutreach } from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import {
  buildDraftFactorySchedulerGenerationProvenance,
  type DraftFactorySchedulerGenerationProvenance,
} from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import {
  fetchGrowthLeadById,
  mergeGrowthLeadMetadata,
  updateGrowthLead,
} from "@/lib/growth/lead-repository"
import type { GrowthLead } from "@/lib/growth/types"

import {
  AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY,
  AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
  isAutonomousDiscoveryGptQualificationLead,
  readAutonomousGptQualificationRecord,
} from "@/lib/growth/ava-reasoning/ava-sal-runtime-convergence-1a"

export {
  AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY,
  AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
  isAutonomousDiscoveryGptQualificationLead,
} from "@/lib/growth/ava-reasoning/ava-sal-runtime-convergence-1a"

const AUTONOMOUS_GPT_ACTING_EMAIL = "ava-autonomous-discovery@equipify.local"
const INFLIGHT_STALE_MS = 15 * 60 * 1000

export type AutonomousDiscoveryGptQualificationDecision = "pursue" | "reject" | "hold"

export type AutonomousDiscoveryGptQualificationResult = {
  qaMarker: typeof AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER
  leadId: string
  decision: AutonomousDiscoveryGptQualificationDecision | null
  rationale: string | null
  persistedGenerationId: string | null
  skippedReason: string | null
}

const inFlightQualifications = new Map<string, Promise<AutonomousDiscoveryGptQualificationResult>>()

function readMetadataRecord(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {}
  return metadata
}

export function isAutonomousExternalDiscoveryIntakeMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const raw = readMetadataRecord(metadata)
  return (
    raw.intake_site_key === "prospect_search_external_discovery" ||
    raw.intakeSiteKey === "prospect_search_external_discovery"
  )
}

export function shouldScheduleAutonomousDiscoveryGptQualification(
  lead: Pick<GrowthLead, "id" | "status" | "metadata">,
): boolean {
  if (lead.status === "disqualified" || lead.status === "archived" || lead.status === "converted") {
    return false
  }
  if (!isAutonomousDiscoveryGptQualificationLead(lead.metadata)) return false

  const qualification = readAutonomousGptQualificationRecord(lead.metadata)
  if (qualification?.evaluated_at && typeof qualification.evaluated_at === "string") {
    return false
  }

  const startedAt =
    typeof qualification?.evaluation_started_at === "string"
      ? Date.parse(qualification.evaluation_started_at)
      : Number.NaN
  if (Number.isFinite(startedAt) && Date.now() - startedAt < INFLIGHT_STALE_MS) {
    return false
  }

  return true
}

function buildAutonomousProvenance(
  organizationId: string,
  generatedAt: string,
): DraftFactorySchedulerGenerationProvenance {
  return buildDraftFactorySchedulerGenerationProvenance({
    organizationId,
    generatedAt,
  })
}

export async function markAutonomousDiscoveryGptQualificationStarted(input: {
  admin: SupabaseClient
  leadId: string
  startedAt: string
}): Promise<boolean> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead || !shouldScheduleAutonomousDiscoveryGptQualification(lead)) {
    return false
  }

  await updateGrowthLead(input.admin, input.leadId, {
    metadata: mergeGrowthLeadMetadata(lead.metadata, {
      ava_gpt_qualification: {
        qa_marker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
        evaluation_started_at: input.startedAt,
      },
    }),
  })

  return true
}

export async function persistAutonomousDiscoveryGptQualificationDecision(input: {
  admin: SupabaseClient
  leadId: string
  decision: AutonomousDiscoveryGptQualificationDecision
  rationale: string | null
  missingInformation?: string[]
  evidenceReferences?: string[]
  persistedGenerationId: string | null
  model: string | null
  evaluatedAt: string
}): Promise<void> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) return

  const metadata = mergeGrowthLeadMetadata(lead.metadata, {
    ava_gpt_qualification: {
      qa_marker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
      decision: input.decision,
      rationale: input.rationale,
      missing_information: input.missingInformation ?? [],
      evidence_references: input.evidenceReferences ?? [],
      evaluated_at: input.evaluatedAt,
      evaluation_started_at: input.evaluatedAt,
      model: input.model,
      persisted_generation_id: input.persistedGenerationId,
    },
  })

  await updateGrowthLead(input.admin, input.leadId, {
    metadata,
    ...(input.decision === "reject" ? { status: "disqualified" } : {}),
  })
}

async function runAutonomousDiscoveryGptQualificationInner(input: {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
  generatedAt?: string
}): Promise<AutonomousDiscoveryGptQualificationResult> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()

  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) {
    return {
      qaMarker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
      leadId: input.leadId,
      decision: null,
      rationale: null,
      persistedGenerationId: null,
      skippedReason: "lead_not_found",
    }
  }

  if (!shouldScheduleAutonomousDiscoveryGptQualification(lead)) {
    return {
      qaMarker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
      leadId: input.leadId,
      decision: null,
      rationale: null,
      persistedGenerationId: null,
      skippedReason: "not_eligible",
    }
  }

  const started = await markAutonomousDiscoveryGptQualificationStarted({
    admin: input.admin,
    leadId: input.leadId,
    startedAt: generatedAt,
  })
  if (!started) {
    return {
      qaMarker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
      leadId: input.leadId,
      decision: null,
      rationale: null,
      persistedGenerationId: null,
      skippedReason: "already_inflight_or_completed",
    }
  }

  const supervised = await runEquipifySupervisedAvaOutreach({
    admin: input.admin,
    leadId: input.leadId,
    organizationId,
    actingUserEmail: AUTONOMOUS_GPT_ACTING_EMAIL,
    persist: true,
    websiteEvidenceOptional: true,
    autonomousProvenance: buildAutonomousProvenance(organizationId!, generatedAt),
  })

  if (!supervised.ok) {
    logGrowthEngine("ava_autonomous_discovery_gpt_qualification_failed", {
      leadId: input.leadId,
      code: supervised.code,
      message: supervised.message,
    })
    return {
      qaMarker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
      leadId: input.leadId,
      decision: null,
      rationale: supervised.message,
      persistedGenerationId: null,
      skippedReason: supervised.code,
    }
  }

  const decision = supervised.output.decision
  await persistAutonomousDiscoveryGptQualificationDecision({
    admin: input.admin,
    leadId: input.leadId,
    decision,
    rationale: supervised.output.rationale,
    missingInformation: supervised.output.missingInformation,
    evidenceReferences: supervised.output.evidenceReferences,
    persistedGenerationId: supervised.output.persistedGenerationId,
    model: supervised.output.model,
    evaluatedAt: generatedAt,
  })

  logGrowthEngine("ava_autonomous_discovery_gpt_qualification_completed", {
    leadId: input.leadId,
    decision,
    persistedGenerationId: supervised.output.persistedGenerationId,
    model: supervised.output.model,
  })

  return {
    qaMarker: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
    leadId: input.leadId,
    decision,
    rationale: supervised.output.rationale,
    persistedGenerationId: supervised.output.persistedGenerationId,
    skippedReason: null,
  }
}

export async function runAutonomousDiscoveryGptQualification(input: {
  admin: SupabaseClient
  leadId: string
  organizationId?: string | null
  generatedAt?: string
}): Promise<AutonomousDiscoveryGptQualificationResult> {
  const existing = inFlightQualifications.get(input.leadId)
  if (existing) return existing

  const run = runAutonomousDiscoveryGptQualificationInner(input)
  inFlightQualifications.set(input.leadId, run)
  try {
    return await run
  } finally {
    if (inFlightQualifications.get(input.leadId) === run) {
      inFlightQualifications.delete(input.leadId)
    }
  }
}

export function scheduleAutonomousDiscoveryGptQualificationIfNeeded(
  admin: SupabaseClient,
  input: {
    leadId: string
    organizationId?: string | null
    generatedAt?: string
  },
): void {
  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) return

  void runAutonomousDiscoveryGptQualification({
    admin,
    leadId: input.leadId,
    organizationId,
    generatedAt: input.generatedAt,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("ava_autonomous_discovery_gpt_qualification_schedule_failed", {
      leadId: input.leadId,
      message: message.slice(0, 240),
    })
  })
}

/** Test seam — clear process-local in-flight dedupe. */
export function resetAutonomousDiscoveryGptQualificationInFlightForTests(): void {
  inFlightQualifications.clear()
}
