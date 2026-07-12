/**
 * GE-AIOS-AUTONOMY-1B — Thin completion emitters onto the existing AI OS Event Bus.
 * Callers publish; draft_factory_wake_observer advances Draft Factory.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"

async function publishSafely(
  admin: SupabaseClient,
  input: Parameters<typeof publishGrowthAiEvent>[1],
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      ...input,
      payload: {
        ...(input.payload ?? {}),
        qa_marker: GROWTH_DRAFT_FACTORY_WAKE_BUS_QA_MARKER,
      },
    })
  } catch {
    // Emitters must never block completion paths.
  }
}

export async function publishDraftFactoryCompanyIntelligenceCompleted(
  admin: SupabaseClient,
  input: {
    organizationId: string
    companyId: string
    runId: string
    leadIds: string[]
    jobId?: string | null
  },
): Promise<void> {
  if (input.leadIds.length === 0) return
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.company_intelligence.completed",
    category: "system",
    producer: "growth_company_intelligence",
    source: "company_intelligence_queue",
    entityType: "company",
    entityId: input.companyId,
    correlationId: input.runId,
    payload: {
      company_id: input.companyId,
      run_id: input.runId,
      job_id: input.jobId ?? null,
      lead_ids: input.leadIds,
      lead_id: input.leadIds[0] ?? null,
    },
  })
}

export async function publishDraftFactoryDatamoonPersonCompleted(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    idempotencyKey: string
    failed?: boolean
    runId?: string | null
    audienceId?: string | null
    companyId?: string | null
    canonicalPersonId?: string | null
    outcome?: string | null
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: input.failed ? "growth.datamoon.person_failed" : "growth.datamoon.person_completed",
    category: "system",
    producer: "growth_datamoon_decision_maker",
    source: "datamoon_dm_service",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `datamoon-person:${input.failed ? "failed" : "completed"}:${input.organizationId}:${input.leadId}:${input.idempotencyKey}`,
    payload: {
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      idempotency_key: input.idempotencyKey,
      provider_run_id: input.runId ?? null,
      audience_id: input.audienceId ?? null,
      canonical_person_id: input.canonicalPersonId ?? null,
      outcome: input.outcome ?? (input.failed ? "failed" : "completed"),
      source_version: "contact-1b-v1",
    },
  })
}

export async function publishDraftFactoryDatamoonPersonRequested(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    idempotencyKey: string
    runId?: string | null
    audienceId?: string | null
    companyId?: string | null
    nextPollAt?: string | null
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.datamoon.person_requested",
    category: "system",
    producer: "growth_datamoon_decision_maker",
    source: "datamoon_dm_discovery_live_adapter",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `datamoon-person:requested:${input.organizationId}:${input.leadId}:${input.idempotencyKey}`,
    payload: {
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      idempotency_key: input.idempotencyKey,
      provider_run_id: input.runId ?? null,
      audience_id: input.audienceId ?? null,
      next_poll_at: input.nextPollAt ?? null,
      outcome: "provider_pending",
      source_version: "contact-1b-v1",
    },
  })
}

export async function publishDraftFactoryDatamoonPersonPending(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    idempotencyKey: string
    runId?: string | null
    audienceId?: string | null
    companyId?: string | null
    nextPollAt?: string | null
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.datamoon.person_pending",
    category: "system",
    producer: "growth_datamoon_decision_maker",
    source: "datamoon_dm_discovery_live_adapter",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `datamoon-person:pending:${input.organizationId}:${input.leadId}:${input.idempotencyKey}:${input.nextPollAt ?? "na"}`,
    payload: {
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      idempotency_key: input.idempotencyKey,
      provider_run_id: input.runId ?? null,
      audience_id: input.audienceId ?? null,
      next_poll_at: input.nextPollAt ?? null,
      outcome: "provider_pending",
      source_version: "contact-1b-v1",
    },
  })
}

export async function publishDraftFactoryContactVerified(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    contactId: string
    canonicalPersonId?: string | null
    channel?: "email" | "phone"
    verificationStatus?: string
    sourceRunId?: string | null
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.contact.verified",
    category: "system",
    producer: "growth_contact_verification",
    source: "company_contact_repository",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `contact-verified:${input.organizationId}:${input.leadId}:${input.contactId}`,
    payload: {
      lead_id: input.leadId,
      contact_id: input.contactId,
      canonical_person_id: input.canonicalPersonId ?? null,
      channel: input.channel ?? "email",
      verification_status: input.verificationStatus ?? "verified",
      source_run_id: input.sourceRunId ?? null,
    },
  })
}

export async function publishDraftFactoryContactAvailable(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    canonicalPersonId?: string | null
    channel: "email" | "phone"
    verificationStatus?: string
    sourceRunId?: string | null
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.contact.available",
    category: "system",
    producer: "growth_datamoon_decision_maker",
    source: "datamoon_dm_canonical_contact_persist",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `contact-available:${input.organizationId}:${input.leadId}:${input.channel}:${input.sourceRunId ?? "na"}`,
    payload: {
      lead_id: input.leadId,
      canonical_person_id: input.canonicalPersonId ?? null,
      channel: input.channel,
      verification_status: input.verificationStatus ?? "unverified",
      source_run_id: input.sourceRunId ?? null,
    },
  })
}

export async function publishDraftFactoryContactVerificationFailed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    canonicalPersonId?: string | null
    channel: "email" | "phone"
    sourceRunId?: string | null
    reason?: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.contact.verification_failed",
    category: "system",
    producer: "growth_contact_verification",
    source: "contact_verification",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    replayKey: `contact-verify-failed:${input.organizationId}:${input.leadId}:${input.channel}:${input.sourceRunId ?? "na"}`,
    payload: {
      lead_id: input.leadId,
      canonical_person_id: input.canonicalPersonId ?? null,
      channel: input.channel,
      verification_status: "failed",
      source_run_id: input.sourceRunId ?? null,
      reason: input.reason ?? null,
    },
  })
}

export async function publishDraftFactoryPersonalizationCompleted(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generationId: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.personalization.completed",
    category: "system",
    producer: "growth_personalization",
    source: "personalization_dashboard",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      lead_id: input.leadId,
      generation_id: input.generationId,
    },
  })
}

export async function publishDraftFactoryMissionChanged(
  admin: SupabaseClient,
  input: {
    organizationId: string
    objectiveId: string
    leadIds?: string[]
    changeKind: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.mission.changed",
    category: "mission",
    producer: "growth_objective_runtime",
    source: "growth_objective_service",
    entityType: "objective",
    entityId: input.objectiveId,
    correlationId: input.objectiveId,
    missionId: input.objectiveId,
    payload: {
      objective_id: input.objectiveId,
      change_kind: input.changeKind,
      lead_ids: input.leadIds ?? [],
      lead_id: input.leadIds?.[0] ?? null,
    },
  })
}

export async function publishDraftFactoryCompanyProfileChanged(
  admin: SupabaseClient,
  input: {
    organizationId: string
    profileId: string
    leadIds?: string[]
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.company.profile_changed",
    category: "system",
    producer: "growth_business_profile",
    source: "business_profile_service",
    entityType: "company",
    entityId: input.profileId,
    correlationId: input.profileId,
    payload: {
      profile_id: input.profileId,
      lead_ids: input.leadIds ?? [],
      lead_id: input.leadIds?.[0] ?? null,
    },
  })
}

export async function publishDraftFactoryCapacityAvailable(
  admin: SupabaseClient,
  input: {
    organizationId: string
    sourceId: string
    reason?: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.capacity.available",
    category: "system",
    producer: "growth_runtime_capacity",
    source: "draft_factory_wake_emitters",
    entityType: "system",
    entityId: input.organizationId,
    correlationId: input.sourceId,
    payload: {
      reason: input.reason ?? "capacity_available",
    },
  })
}

export async function publishDraftFactoryResearchBecameStale(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    lastResearchedAt: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.research.became_stale",
    category: "system",
    producer: "growth_lead_research",
    source: "growth_lead_research_readiness",
    entityType: "lead",
    entityId: input.leadId,
    correlationId: input.leadId,
    payload: {
      lead_id: input.leadId,
      last_researched_at: input.lastResearchedAt,
    },
  })
}

export async function publishDraftFactoryBudgetWindowReset(
  admin: SupabaseClient,
  input: {
    organizationId: string
    resourceType: string
    windowKind: string
  },
): Promise<void> {
  await publishSafely(admin, {
    organizationId: input.organizationId,
    eventType: "growth.budget.window_reset",
    category: "system",
    aiOsCategory: "budget",
    producer: "growth_runtime_budget",
    source: "growth_runtime_budget_service",
    entityType: "system",
    entityId: input.organizationId,
    correlationId: `${input.organizationId}:${input.resourceType}:${input.windowKind}`,
    payload: {
      resource_type: input.resourceType,
      window_kind: input.windowKind,
    },
  })
}
