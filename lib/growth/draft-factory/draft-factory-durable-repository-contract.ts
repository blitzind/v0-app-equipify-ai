/**
 * SV1-5A — Durable Draft Factory repository contract (client-safe types).
 * Production must resolve to Postgres. Certification may inject memory/disk.
 * Never silently fall back from Postgres to memory.
 */

import type {
  AiOsDraftFactoryAdvanceResultV5,
  AiOsDraftFactoryDurableLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import type { DraftFactoryWakeReceipt } from "@/lib/growth/draft-factory/draft-factory-durable-store"

export const AI_OS_DRAFT_FACTORY_REPOSITORY_KINDS = ["postgres", "memory", "disk"] as const
export type AiOsDraftFactoryRepositoryKind = (typeof AI_OS_DRAFT_FACTORY_REPOSITORY_KINDS)[number]

export type AiOsDraftFactoryRuntimeMode = "production" | "certification" | "test"

export type DraftFactoryDurableRepository = {
  readonly kind: AiOsDraftFactoryRepositoryKind
  getLeadState(
    organizationId: string,
    leadId: string,
  ): Promise<AiOsDraftFactoryDurableLeadState | null>
  upsertLeadState(
    state: AiOsDraftFactoryDurableLeadState,
    expectedVersion?: number,
  ): Promise<boolean>
  tryAcquireLease(input: {
    organizationId: string
    leadId: string
    workerId: string
    now: string
    leaseMs?: number
  }): Promise<boolean>
  releaseLease(input: {
    organizationId: string
    leadId: string
    workerId: string
    now: string
  }): Promise<void>
  getWakeReceipt(
    organizationId: string,
    leadId: string,
    fingerprint: string,
  ): Promise<DraftFactoryWakeReceipt | null>
  recordWakeReceipt(receipt: DraftFactoryWakeReceipt): Promise<boolean>
  listDueStates(input: {
    organizationId: string
    now: string
    limit?: number
  }): Promise<AiOsDraftFactoryDurableLeadState[]>
  /** Wake-independent scan of downstream nonterminal states for admission integrity reconcile. */
  listAdmissionIntegrityReconcileStates(input: {
    organizationId: string
    limit?: number
  }): Promise<AiOsDraftFactoryDurableLeadState[]>
  listDeferredStates(organizationId: string): Promise<AiOsDraftFactoryDurableLeadState[]>
  incrementPackagesProduced(organizationId: string, now: string): Promise<number>
  getPackagesProducedToday(organizationId: string, now: string): Promise<number>
  appendTransition(result: AiOsDraftFactoryAdvanceResultV5): Promise<void>
  /** Optional schema probe — Postgres returns false when tables missing. */
  assertAvailable?(): Promise<{ ok: true } | { ok: false; reason: string }>
}

export type ResolveDraftFactoryDurableRepositoryInput = {
  runtime: AiOsDraftFactoryRuntimeMode
  /** Required for production Postgres. */
  admin?: unknown | null
  injectedRepository?: DraftFactoryDurableRepository | null
}

/**
 * Fail-closed factory. Production cannot use memory/disk.
 * Injected repositories are allowed only for certification/test.
 */
export function resolveDraftFactoryDurableRepositoryKind(
  input: ResolveDraftFactoryDurableRepositoryInput,
): AiOsDraftFactoryRepositoryKind {
  if (input.runtime === "production") {
    if (input.injectedRepository) {
      throw new Error(
        "SV1-5A: Production cannot resolve to an injected memory/disk Draft Factory repository.",
      )
    }
    if (!input.admin) {
      throw new Error(
        "SV1-5A: Production Draft Factory requires a Supabase admin client (Postgres). Fail closed.",
      )
    }
    return "postgres"
  }
  if (input.injectedRepository) {
    return input.injectedRepository.kind
  }
  return "memory"
}
