/**
 * SV1-3 — Request-local / test Draft Factory lead store.
 * NOT production authority after SV1-5 — durable store (`draft-factory-durable-store`) is canonical.
 * Kept for SV1-3 cert compatibility and request-local caching only.
 */

import type { AiOsDraftFactoryLeadRecord } from "@/lib/growth/draft-factory/draft-factory-types"

type OrgBucket = {
  records: Map<string, AiOsDraftFactoryLeadRecord>
  packagesProducedDay: number
  dayKey: string
}

const orgBuckets = new Map<string, OrgBucket>()

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function getBucket(organizationId: string, now: string): OrgBucket {
  const existing = orgBuckets.get(organizationId)
  const key = dayKey(now)
  if (!existing) {
    const created: OrgBucket = { records: new Map(), packagesProducedDay: 0, dayKey: key }
    orgBuckets.set(organizationId, created)
    return created
  }
  if (existing.dayKey !== key) {
    existing.dayKey = key
    existing.packagesProducedDay = 0
  }
  return existing
}

export function getDraftFactoryLeadRecord(
  organizationId: string,
  leadId: string,
  now: string,
): AiOsDraftFactoryLeadRecord | null {
  return getBucket(organizationId, now).records.get(leadId) ?? null
}

export function upsertDraftFactoryLeadRecord(
  organizationId: string,
  now: string,
  record: AiOsDraftFactoryLeadRecord,
): void {
  getBucket(organizationId, now).records.set(record.leadId, record)
}

export function tryAcquireDraftFactoryLeadLock(input: {
  organizationId: string
  leadId: string
  workerId: string
  now: string
}): boolean {
  const bucket = getBucket(input.organizationId, input.now)
  const record = bucket.records.get(input.leadId)
  if (!record) return true
  if (record.lockOwner && record.lockOwner !== input.workerId) return false
  bucket.records.set(input.leadId, { ...record, lockOwner: input.workerId })
  return true
}

export function releaseDraftFactoryLeadLock(input: {
  organizationId: string
  leadId: string
  now: string
}): void {
  const bucket = getBucket(input.organizationId, input.now)
  const record = bucket.records.get(input.leadId)
  if (!record) return
  bucket.records.set(input.leadId, { ...record, lockOwner: null })
}

export function incrementDraftFactoryPackagesProduced(organizationId: string, now: string): number {
  const bucket = getBucket(organizationId, now)
  bucket.packagesProducedDay += 1
  return bucket.packagesProducedDay
}

export function getDraftFactoryPackagesProducedToday(organizationId: string, now: string): number {
  return getBucket(organizationId, now).packagesProducedDay
}

export function clearDraftFactoryStoreForTests(): void {
  orgBuckets.clear()
}

export function listDraftFactoryRecords(organizationId: string, now: string): AiOsDraftFactoryLeadRecord[] {
  return [...getBucket(organizationId, now).records.values()]
}
