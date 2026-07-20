/**
 * SV1-5A — Memory/disk repository adapter for certification only.
 * Never selected for production runtime.
 */

import type { DraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-contract"
import {
  appendDurableTransition,
  getDurableDraftFactoryLeadState,
  getDurablePackagesProducedToday,
  getDurableWakeReceipt,
  incrementDurablePackagesProduced,
  listDeferredDurableDraftFactoryStates,
  listDueDurableDraftFactoryStates,
  listAdmissionIntegrityReconcileDurableDraftFactoryStates,
  recordDurableWakeReceipt,
  releaseDurableDraftFactoryLease,
  tryAcquireDurableDraftFactoryLease,
  upsertDurableDraftFactoryLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-store"
import type { AiOsDraftFactoryAdvanceResultV5 } from "@/lib/growth/draft-factory/draft-factory-durable-types"

export function createMemoryDraftFactoryRepository(
  kind: "memory" | "disk" = "memory",
): DraftFactoryDurableRepository {
  return {
    kind,
    async getLeadState(organizationId, leadId) {
      return getDurableDraftFactoryLeadState(organizationId, leadId)
    },
    async upsertLeadState(state, expectedVersion) {
      return upsertDurableDraftFactoryLeadState(state, expectedVersion)
    },
    async tryAcquireLease(input) {
      return tryAcquireDurableDraftFactoryLease(input)
    },
    async releaseLease(input) {
      releaseDurableDraftFactoryLease(input)
    },
    async getWakeReceipt(organizationId, leadId, fingerprint) {
      return getDurableWakeReceipt(organizationId, leadId, fingerprint)
    },
    async recordWakeReceipt(receipt) {
      return recordDurableWakeReceipt(receipt)
    },
    async listDueStates(input) {
      return listDueDurableDraftFactoryStates(input)
    },
    async listAdmissionIntegrityReconcileStates(input) {
      return listAdmissionIntegrityReconcileDurableDraftFactoryStates(input)
    },
    async listDeferredStates(organizationId) {
      return listDeferredDurableDraftFactoryStates(organizationId)
    },
    async incrementPackagesProduced(organizationId, now) {
      return incrementDurablePackagesProduced(organizationId, now)
    },
    async getPackagesProducedToday(organizationId, now) {
      return getDurablePackagesProducedToday(organizationId, now)
    },
    async appendTransition(result: AiOsDraftFactoryAdvanceResultV5) {
      appendDurableTransition(result)
    },
    async assertAvailable() {
      return { ok: true as const }
    },
  }
}
