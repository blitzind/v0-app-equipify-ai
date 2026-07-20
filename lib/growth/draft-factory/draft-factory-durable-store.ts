/**
 * SV1-5 — Durable Draft Factory store.
 * In-process adapter with restart-survivable "disk" snapshot for serverless simulation.
 * Production Postgres mapping: growth.draft_factory_lead_states + wake_receipts.
 * SV1-3 in-memory store is NOT production authority.
 */

import type {
  AiOsDraftFactoryAdvanceResultV5,
  AiOsDraftFactoryDurableLeadState,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES } from "@/lib/growth/draft-factory/draft-factory-admission-downstream-reconcile-2a"

export type DraftFactoryWakeReceipt = {
  organizationId: string
  leadId: string
  wakeFingerprint: string
  wakeType: string
  outcome: string
  transitionSummary: Record<string, unknown>
  createdAt: string
}

export type DraftFactoryDurableStoreSnapshot = {
  states: AiOsDraftFactoryDurableLeadState[]
  receipts: DraftFactoryWakeReceipt[]
  packagesProducedByOrgDay: Record<string, number>
  transitions: AiOsDraftFactoryAdvanceResultV5[]
  qaMarker: typeof AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER
}

/** Survivable across simulateProcessRestart — models Postgres. */
const durableDisk: {
  states: Map<string, AiOsDraftFactoryDurableLeadState>
  receipts: Map<string, DraftFactoryWakeReceipt>
  packagesProducedByOrgDay: Map<string, number>
  transitions: AiOsDraftFactoryAdvanceResultV5[]
} = {
  states: new Map(),
  receipts: new Map(),
  packagesProducedByOrgDay: new Map(),
  transitions: [],
}

/** Request-local cache — cleared on restart simulation. */
let processLocalCache: Map<string, AiOsDraftFactoryDurableLeadState> | null = new Map()

function stateKey(organizationId: string, leadId: string): string {
  return `${organizationId}::${leadId}`
}

function receiptKey(organizationId: string, leadId: string, fingerprint: string): string {
  return `${organizationId}::${leadId}::${fingerprint}`
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function packageDayKey(organizationId: string, now: string): string {
  return `${organizationId}::${dayKey(now)}`
}

export function isDraftFactoryInMemoryStoreAuthoritative(): false {
  return false
}

export function getDurableDraftFactoryLeadState(
  organizationId: string,
  leadId: string,
): AiOsDraftFactoryDurableLeadState | null {
  const key = stateKey(organizationId, leadId)
  if (processLocalCache?.has(key)) {
    return processLocalCache.get(key) ?? null
  }
  const fromDisk = durableDisk.states.get(key) ?? null
  if (fromDisk && processLocalCache) {
    processLocalCache.set(key, { ...fromDisk })
  }
  return fromDisk ? { ...fromDisk } : null
}

/**
 * Optimistic version write. Returns false if version mismatch (concurrent writer).
 */
export function upsertDurableDraftFactoryLeadState(
  state: AiOsDraftFactoryDurableLeadState,
  expectedVersion?: number,
): boolean {
  const key = stateKey(state.organizationId, state.leadId)
  const existing = durableDisk.states.get(key)
  if (existing && expectedVersion != null && existing.version !== expectedVersion) {
    return false
  }
  if (existing && expectedVersion == null && state.version < existing.version) {
    return false
  }

  const written: AiOsDraftFactoryDurableLeadState =
    expectedVersion != null
      ? { ...state, version: expectedVersion + 1 }
      : existing
        ? { ...state, version: Math.max(state.version, existing.version) }
        : { ...state, version: state.version || 1 }

  durableDisk.states.set(key, written)
  processLocalCache?.set(key, { ...written })
  return true
}

export function tryAcquireDurableDraftFactoryLease(input: {
  organizationId: string
  leadId: string
  workerId: string
  now: string
  leaseMs?: number
}): boolean {
  const existing = getDurableDraftFactoryLeadState(input.organizationId, input.leadId)
  if (!existing) return true
  const nowMs = Date.parse(input.now)
  if (
    existing.leaseOwner &&
    existing.leaseOwner !== input.workerId &&
    existing.leaseExpiresAt &&
    Date.parse(existing.leaseExpiresAt) > nowMs
  ) {
    return false
  }
  const leaseMs = input.leaseMs ?? 60_000
  const next: AiOsDraftFactoryDurableLeadState = {
    ...existing,
    leaseOwner: input.workerId,
    leaseExpiresAt: new Date(nowMs + leaseMs).toISOString(),
    updatedAt: input.now,
  }
  return upsertDurableDraftFactoryLeadState(next, existing.version)
}

export function releaseDurableDraftFactoryLease(input: {
  organizationId: string
  leadId: string
  workerId: string
  now: string
}): void {
  const existing = getDurableDraftFactoryLeadState(input.organizationId, input.leadId)
  if (!existing) return
  if (existing.leaseOwner && existing.leaseOwner !== input.workerId) return
  upsertDurableDraftFactoryLeadState(
    {
      ...existing,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: input.now,
    },
    existing.version,
  )
}

export function getDurableWakeReceipt(
  organizationId: string,
  leadId: string,
  fingerprint: string,
): DraftFactoryWakeReceipt | null {
  return durableDisk.receipts.get(receiptKey(organizationId, leadId, fingerprint)) ?? null
}

export function recordDurableWakeReceipt(receipt: DraftFactoryWakeReceipt): boolean {
  const key = receiptKey(receipt.organizationId, receipt.leadId, receipt.wakeFingerprint)
  if (durableDisk.receipts.has(key)) return false
  durableDisk.receipts.set(key, receipt)
  return true
}

export function listDueDurableDraftFactoryStates(input: {
  organizationId: string
  now: string
  limit?: number
}): AiOsDraftFactoryDurableLeadState[] {
  const nowMs = Date.parse(input.now)
  const due = [...durableDisk.states.values()]
    .filter((s) => s.organizationId === input.organizationId)
    .filter((s) => {
      if (!s.nextEligibleWakeAt) {
        return (
          s.state !== "waiting_for_approval" &&
          s.state !== "approved" &&
          s.state !== "executed" &&
          s.state !== "failed" &&
          s.pausedReason !== "stop_investment"
        )
      }
      return Date.parse(s.nextEligibleWakeAt) <= nowMs
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
  return due.slice(0, input.limit ?? 100)
}

export function listAdmissionIntegrityReconcileDurableDraftFactoryStates(input: {
  organizationId: string
  limit?: number
}): AiOsDraftFactoryDurableLeadState[] {
  const scanStates = new Set<string>(GROWTH_REVENUE_2A_ADMISSION_INTEGRITY_RECONCILE_SCAN_STATES)
  return [...durableDisk.states.values()]
    .filter((s) => s.organizationId === input.organizationId && scanStates.has(s.state))
    .sort((a, b) => {
      const byUpdated = a.updatedAt.localeCompare(b.updatedAt)
      if (byUpdated !== 0) return byUpdated
      return a.leadId.localeCompare(b.leadId)
    })
    .slice(0, input.limit ?? 100)
}

export function listDeferredDurableDraftFactoryStates(organizationId: string): AiOsDraftFactoryDurableLeadState[] {
  return [...durableDisk.states.values()].filter(
    (s) =>
      s.organizationId === organizationId &&
      (s.state === "paused" || s.pausedReason === "portfolio_deferred" || s.earliestIncompleteStage === "portfolio"),
  )
}

export function incrementDurablePackagesProduced(organizationId: string, now: string): number {
  const key = packageDayKey(organizationId, now)
  const next = (durableDisk.packagesProducedByOrgDay.get(key) ?? 0) + 1
  durableDisk.packagesProducedByOrgDay.set(key, next)
  return next
}

export function getDurablePackagesProducedToday(organizationId: string, now: string): number {
  return durableDisk.packagesProducedByOrgDay.get(packageDayKey(organizationId, now)) ?? 0
}

export function appendDurableTransition(result: AiOsDraftFactoryAdvanceResultV5): void {
  durableDisk.transitions.push(result)
}

export function listDurableTransitions(organizationId: string, leadId?: string): AiOsDraftFactoryAdvanceResultV5[] {
  return durableDisk.transitions.filter(
    (t) => t.organizationId === organizationId && (leadId == null || t.leadId === leadId),
  )
}

/**
 * Clears process-local cache only — durable disk survives (simulates deployment restart).
 */
export function simulateDraftFactoryProcessRestart(): void {
  processLocalCache = new Map()
}

export function exportDurableDraftFactorySnapshot(): DraftFactoryDurableStoreSnapshot {
  return {
    states: [...durableDisk.states.values()].map((s) => ({ ...s })),
    receipts: [...durableDisk.receipts.values()].map((r) => ({ ...r })),
    packagesProducedByOrgDay: Object.fromEntries(durableDisk.packagesProducedByOrgDay),
    transitions: [...durableDisk.transitions],
    qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  }
}

export function importDurableDraftFactorySnapshot(snapshot: DraftFactoryDurableStoreSnapshot): void {
  durableDisk.states.clear()
  durableDisk.receipts.clear()
  durableDisk.packagesProducedByOrgDay.clear()
  durableDisk.transitions.length = 0
  for (const s of snapshot.states) {
    durableDisk.states.set(stateKey(s.organizationId, s.leadId), { ...s })
  }
  for (const r of snapshot.receipts) {
    durableDisk.receipts.set(receiptKey(r.organizationId, r.leadId, r.wakeFingerprint), { ...r })
  }
  for (const [k, v] of Object.entries(snapshot.packagesProducedByOrgDay)) {
    durableDisk.packagesProducedByOrgDay.set(k, v)
  }
  durableDisk.transitions.push(...snapshot.transitions)
  processLocalCache = new Map()
}

export function clearDurableDraftFactoryStoreForTests(): void {
  durableDisk.states.clear()
  durableDisk.receipts.clear()
  durableDisk.packagesProducedByOrgDay.clear()
  durableDisk.transitions.length = 0
  processLocalCache = new Map()
}
