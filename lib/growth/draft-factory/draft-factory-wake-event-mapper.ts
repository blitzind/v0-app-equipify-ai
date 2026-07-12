/** GE-AIOS-AUTONOMY-1B — Map AI OS events → Draft Factory canonical wakes (client-safe). */

import type { AiOsEvent } from "@/lib/growth/aios/ai-event-types"
import type { AiOsDraftFactoryCanonicalWake } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import {
  GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES,
  type GrowthDraftFactoryWakeEventType,
} from "@/lib/growth/draft-factory/draft-factory-wake-event-types"

export type DraftFactoryWakePlan =
  | {
      kind: "lead"
      organizationId: string
      leadId: string
      wakeType: AiOsDraftFactoryCanonicalWake
      sourceId: string
    }
  | {
      kind: "org_capacity"
      organizationId: string
      wakeType: "capacity_available"
      sourceId: string
    }
  | {
      kind: "org_mission"
      organizationId: string
      wakeType: "mission_changed"
      sourceId: string
      leadIds: string[]
    }

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function extractLeadId(event: AiOsEvent): string | null {
  if (event.entityType === "lead" && event.entityId) return event.entityId
  return (
    asString(event.payload.lead_id) ??
    asString(event.payload.leadId) ??
    (event.entityType === "lead" ? asString(event.entityId) : null)
  )
}

function extractLeadIds(event: AiOsEvent): string[] {
  const single = extractLeadId(event)
  const fromArray = Array.isArray(event.payload.lead_ids)
    ? event.payload.lead_ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : []
  const ids = [...(single ? [single] : []), ...fromArray]
  return [...new Set(ids)]
}

function isWakeEventType(eventType: string): eventType is GrowthDraftFactoryWakeEventType {
  return (GROWTH_DRAFT_FACTORY_WAKE_EVENT_TYPES as readonly string[]).includes(eventType)
}

/**
 * Pure mapping — one AI OS event → zero or more Draft Factory wake plans.
 * Each lead plan advances exactly one durable stage via existing DF engine.
 */
export function mapAiOsEventToDraftFactoryWakePlans(event: AiOsEvent): DraftFactoryWakePlan[] {
  if (!isWakeEventType(event.eventType)) return []

  const organizationId = event.organizationId
  const sourceId = event.id || event.correlationId || event.eventType

  switch (event.eventType) {
    case "growth.workflow.status_changed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      const status = asString(event.payload.workflow_status)
      const runId = asString(event.payload.research_run_id) ?? sourceId
      if (status === "research_complete" || status === "assessed" || status === "completed") {
        return [
          {
            kind: "lead",
            organizationId,
            leadId,
            wakeType: "research_completed",
            sourceId: runId,
          },
        ]
      }
      if (status === "failed") {
        return [
          {
            kind: "lead",
            organizationId,
            leadId,
            wakeType: "research_failed",
            sourceId: runId,
          },
        ]
      }
      return []
    }

    case "growth.company_intelligence.completed": {
      const leadIds = extractLeadIds(event)
      const runId = asString(event.payload.run_id) ?? sourceId
      return leadIds.map((leadId) => ({
        kind: "lead" as const,
        organizationId,
        leadId,
        wakeType: "company_changed" as const,
        sourceId: `ci:${runId}:${leadId}`,
      }))
    }

    case "growth.datamoon.person_requested":
    case "growth.datamoon.person_pending": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      // Pending discovery — schedule resume; do not complete DM stage.
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "datamoon_person_requested",
          sourceId: asString(event.payload.idempotency_key) ?? sourceId,
        },
      ]
    }

    case "growth.datamoon.person_completed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "datamoon_person_completed",
          sourceId: asString(event.payload.idempotency_key) ?? sourceId,
        },
      ]
    }

    case "growth.datamoon.person_failed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "datamoon_person_failed",
          sourceId: asString(event.payload.idempotency_key) ?? sourceId,
        },
      ]
    }

    case "growth.execution_plan.review_changed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      const action = asString(event.payload.review_action) ?? asString(event.payload.approval_status)
      const planId = asString(event.payload.plan_id) ?? sourceId
      if (action === "approve" || action === "approved") {
        return [{ kind: "lead", organizationId, leadId, wakeType: "approval_approved", sourceId: planId }]
      }
      if (action === "reject" || action === "rejected") {
        return [{ kind: "lead", organizationId, leadId, wakeType: "approval_rejected", sourceId: planId }]
      }
      return []
    }

    case "growth.ava.outreach_package_approval": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      const decision = asString(event.payload.decision)
      const packageId = asString(event.payload.package_id) ?? sourceId
      if (decision === "approve" || decision === "approved") {
        return [{ kind: "lead", organizationId, leadId, wakeType: "approval_approved", sourceId: packageId }]
      }
      if (decision === "reject" || decision === "rejected") {
        return [{ kind: "lead", organizationId, leadId, wakeType: "approval_rejected", sourceId: packageId }]
      }
      return []
    }

    case "decision.gate_passed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "approval_approved",
          sourceId: event.workOrderId ?? sourceId,
        },
      ]
    }

    case "decision.gate_blocked": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "approval_rejected",
          sourceId: event.workOrderId ?? sourceId,
        },
      ]
    }

    case "growth.contact.verified": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "contact_verified",
          sourceId: asString(event.payload.contact_id) ?? asString(event.payload.source_run_id) ?? sourceId,
        },
      ]
    }

    case "growth.contact.available": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      // Available (unverified) provider contact unblocks drafting prep via contact_verified wake.
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "contact_verified",
          sourceId: asString(event.payload.source_run_id) ?? `available:${sourceId}`,
        },
      ]
    }

    case "growth.contact.verification_failed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "contact_verification_failed",
          sourceId: asString(event.payload.source_run_id) ?? sourceId,
        },
      ]
    }

    case "growth.personalization.completed": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "personalization_improved",
          sourceId: asString(event.payload.generation_id) ?? sourceId,
        },
      ]
    }

    case "growth.mission.changed": {
      const leadIds = extractLeadIds(event)
      const objectiveId = asString(event.payload.objective_id) ?? sourceId
      if (leadIds.length === 0) {
        return [{ kind: "org_mission", organizationId, wakeType: "mission_changed", sourceId: objectiveId, leadIds: [] }]
      }
      return leadIds.map((leadId) => ({
        kind: "lead" as const,
        organizationId,
        leadId,
        wakeType: "mission_changed" as const,
        sourceId: `${objectiveId}:${leadId}`,
      }))
    }

    case "growth.company.profile_changed": {
      const leadIds = extractLeadIds(event)
      const profileId = asString(event.payload.profile_id) ?? sourceId
      return leadIds.map((leadId) => ({
        kind: "lead" as const,
        organizationId,
        leadId,
        wakeType: "company_changed" as const,
        sourceId: `profile:${profileId}:${leadId}`,
      }))
    }

    case "growth.capacity.available":
    case "growth.budget.window_reset": {
      return [
        {
          kind: "org_capacity",
          organizationId,
          wakeType: "capacity_available",
          sourceId: asString(event.payload.window_kind)
            ? `budget:${asString(event.payload.window_kind)}:${sourceId}`
            : sourceId,
        },
      ]
    }

    case "growth.research.became_stale": {
      const leadId = extractLeadId(event)
      if (!leadId) return []
      return [
        {
          kind: "lead",
          organizationId,
          leadId,
          wakeType: "research_became_stale",
          sourceId: asString(event.payload.last_researched_at) ?? sourceId,
        },
      ]
    }

    default:
      return []
  }
}
