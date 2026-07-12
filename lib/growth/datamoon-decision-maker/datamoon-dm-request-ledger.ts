/**
 * SV1-4 — In-memory DataMoon DM request ledger (idempotency / no-waste).
 * Durable provider results still flow through existing DataMoon audience + lead_decision_makers stores.
 */

import type { AiOsDatamoonDmDecision } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"
import { AI_OS_DATAMOON_DM_RETRY } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"

type RequestEntry = {
  idempotencyKey: string
  leadId: string
  organizationId: string
  attemptedAt: string
  outcome: string
  noSuitablePerson: boolean
}

const requestsByKey = new Map<string, RequestEntry>()
const attemptsByLead = new Map<string, number>()
const decisions: AiOsDatamoonDmDecision[] = []

function leadKey(organizationId: string, leadId: string): string {
  return `${organizationId}:${leadId}`
}

export function getDatamoonDmAttemptCount(organizationId: string, leadId: string): number {
  return attemptsByLead.get(leadKey(organizationId, leadId)) ?? 0
}

export function hasRecentEquivalentDatamoonDmNoResult(input: {
  idempotencyKey: string
  now: string
}): boolean {
  const existing = requestsByKey.get(input.idempotencyKey)
  if (!existing?.noSuitablePerson) return false
  const then = Date.parse(existing.attemptedAt)
  const now = Date.parse(input.now)
  if (!Number.isFinite(then) || !Number.isFinite(now)) return false
  const cooldownMs = AI_OS_DATAMOON_DM_RETRY.noResultCooldownHours * 60 * 60 * 1000
  return now - then < cooldownMs
}

export function hasInFlightOrRecentDatamoonDmRequest(input: {
  idempotencyKey: string
  now: string
}): boolean {
  const existing = requestsByKey.get(input.idempotencyKey)
  if (!existing) return false
  const then = Date.parse(existing.attemptedAt)
  const now = Date.parse(input.now)
  if (!Number.isFinite(then) || !Number.isFinite(now)) return false
  const ttlMs = AI_OS_DATAMOON_DM_RETRY.idempotencyTtlHours * 60 * 60 * 1000
  return now - then < ttlMs
}

export function recordDatamoonDmRequestAttempt(input: {
  idempotencyKey: string
  organizationId: string
  leadId: string
  now: string
  outcome: string
  noSuitablePerson: boolean
}): void {
  requestsByKey.set(input.idempotencyKey, {
    idempotencyKey: input.idempotencyKey,
    organizationId: input.organizationId,
    leadId: input.leadId,
    attemptedAt: input.now,
    outcome: input.outcome,
    noSuitablePerson: input.noSuitablePerson,
  })
  const key = leadKey(input.organizationId, input.leadId)
  attemptsByLead.set(key, (attemptsByLead.get(key) ?? 0) + 1)
}

export function recordDatamoonDmDecision(decision: AiOsDatamoonDmDecision): void {
  decisions.unshift(decision)
  if (decisions.length > 300) decisions.length = 300
}

export function peekDatamoonDmDecisions(): readonly AiOsDatamoonDmDecision[] {
  return decisions
}

export function clearDatamoonDmRequestLedgerForTests(): void {
  requestsByKey.clear()
  attemptsByLead.clear()
  decisions.length = 0
}
