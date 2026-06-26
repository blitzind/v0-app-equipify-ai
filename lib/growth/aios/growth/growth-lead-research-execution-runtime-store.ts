/** GE-AIOS-GROWTH-3A — Execution runtime in-memory store (client-safe, cert + unit tests). */

import type {
  GrowthLeadResearchExecutionAuditEntry,
  GrowthLeadResearchExecutionRecord,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export type GrowthLeadResearchExecutionRuntimeStore = {
  save(record: GrowthLeadResearchExecutionRecord): Promise<void>
  get(executionId: string): Promise<GrowthLeadResearchExecutionRecord | null>
  list(organizationId: string): Promise<GrowthLeadResearchExecutionRecord[]>
  appendAudit(entry: GrowthLeadResearchExecutionAuditEntry): Promise<void>
  listAudit(executionId: string): Promise<GrowthLeadResearchExecutionAuditEntry[]>
}

export function createInMemoryExecutionRuntimeStore(): GrowthLeadResearchExecutionRuntimeStore {
  const records = new Map<string, GrowthLeadResearchExecutionRecord>()
  const audits = new Map<string, GrowthLeadResearchExecutionAuditEntry[]>()

  return {
    async save(record) {
      records.set(record.executionId, structuredClone(record))
    },
    async get(executionId) {
      const row = records.get(executionId)
      return row ? structuredClone(row) : null
    },
    async list(organizationId) {
      return [...records.values()]
        .filter((row) => row.organizationId === organizationId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((row) => structuredClone(row))
    },
    async appendAudit(entry) {
      const existing = audits.get(entry.executionId) ?? []
      existing.push(structuredClone(entry))
      audits.set(entry.executionId, existing)
    },
    async listAudit(executionId) {
      return [...(audits.get(executionId) ?? [])].map((row) => structuredClone(row))
    },
  }
}
