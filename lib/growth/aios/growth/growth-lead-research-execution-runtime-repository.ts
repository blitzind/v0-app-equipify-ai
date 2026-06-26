/** GE-AIOS-GROWTH-3A — Execution runtime event-backed repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listAiOsEvents } from "@/lib/growth/aios/ai-event-repository"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"
import {
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES,
  GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
  type GrowthLeadResearchExecutionAuditEntry,
  type GrowthLeadResearchExecutionRecord,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"
import type { GrowthLeadResearchExecutionRuntimeStore } from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-store"

function asRecord(record: GrowthLeadResearchExecutionRecord): Record<string, unknown> {
  return structuredClone(record) as unknown as Record<string, unknown>
}

function asAudit(record: GrowthLeadResearchExecutionAuditEntry): Record<string, unknown> {
  return structuredClone(record) as unknown as Record<string, unknown>
}

function parseExecutionRecord(payload: unknown): GrowthLeadResearchExecutionRecord | null {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (typeof row.executionId !== "string") return null
  return row as unknown as GrowthLeadResearchExecutionRecord
}

function parseAuditEntry(payload: unknown): GrowthLeadResearchExecutionAuditEntry | null {
  if (!payload || typeof payload !== "object") return null
  const row = payload as Record<string, unknown>
  if (typeof row.auditId !== "string") return null
  return row as unknown as GrowthLeadResearchExecutionAuditEntry
}

export function createEventBackedExecutionRuntimeStore(
  admin: SupabaseClient,
  organizationId: string,
): GrowthLeadResearchExecutionRuntimeStore {
  return {
    async save(record) {
      await publishAiOsEvent(admin, {
        organizationId,
        eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged,
        entityType: "growth_execution_runtime",
        entityId: record.executionId,
        missionId: record.missionId,
        payload: {
          qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
          record: asRecord(record),
        },
        metadata: {
          qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
          execution_id: record.executionId,
          plan_id: record.planId,
          lead_id: record.leadId,
          state: record.state,
        },
      })
    },
    async get(executionId) {
      const events = await listAiOsEvents(admin, {
        organizationId,
        eventTypes: [GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged],
        entityType: "growth_execution_runtime",
        entityId: executionId,
        limit: 200,
      })
      const latest = events
        .map((event) => parseExecutionRecord((event.payload as Record<string, unknown> | null)?.record))
        .filter((row): row is GrowthLeadResearchExecutionRecord => row != null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      return latest ?? null
    },
    async list(orgId) {
      const events = await listAiOsEvents(admin, {
        organizationId: orgId,
        eventTypes: [GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.lifecycleChanged],
        limit: 500,
      })
      const byExecution = new Map<string, GrowthLeadResearchExecutionRecord>()
      for (const event of events) {
        const record = parseExecutionRecord((event.payload as Record<string, unknown> | null)?.record)
        if (!record) continue
        const existing = byExecution.get(record.executionId)
        if (!existing || record.updatedAt > existing.updatedAt) {
          byExecution.set(record.executionId, record)
        }
      }
      return [...byExecution.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async appendAudit(entry) {
      await publishAiOsEvent(admin, {
        organizationId,
        eventType: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.auditRecorded,
        entityType: "growth_execution_runtime",
        entityId: entry.executionId,
        payload: {
          qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
          audit: asAudit(entry),
        },
        metadata: {
          qa_marker: GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_QA_MARKER,
          execution_id: entry.executionId,
          event_type: entry.eventType,
        },
      })
    },
    async listAudit(executionId) {
      const events = await listAiOsEvents(admin, {
        organizationId,
        eventTypes: [
          GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.auditRecorded,
          GROWTH_LEAD_RESEARCH_EXECUTION_RUNTIME_EVENT_TYPES.stepCompleted,
        ],
        entityType: "growth_execution_runtime",
        entityId: executionId,
        limit: 500,
      })
      return events
        .map((event) => {
          const payload = event.payload as Record<string, unknown> | null
          return parseAuditEntry(payload?.audit) ?? parseAuditEntry(payload?.entry)
        })
        .filter((row): row is GrowthLeadResearchExecutionAuditEntry => row != null)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    },
  }
}
