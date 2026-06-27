/** GE-AI-2I — Bounded Autonomous Outbound in-memory store (test doubles only). */

import "server-only"

import type {
  GrowthAutonomousOutboundActionRecord,
  GrowthAutonomousOutboundScope,
  GrowthAutonomousOutboundStopCondition,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

export type GrowthAutonomousOutboundOrgState = {
  scopes: GrowthAutonomousOutboundScope[]
  actions: GrowthAutonomousOutboundActionRecord[]
  stopConditionTriggers: Array<{
    scopeId: string
    condition: GrowthAutonomousOutboundStopCondition
    triggeredAt: string
    label: string
  }>
  lastEventAt: string | null
  lastEventType: string | null
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousOutboundOrgState>()

function defaultState(now: string): GrowthAutonomousOutboundOrgState {
  return {
    scopes: [],
    actions: [],
    stopConditionTriggers: [],
    lastEventAt: null,
    lastEventType: null,
    updatedAt: now,
  }
}

export function getAutonomousOutboundOrgState(organizationId: string, now: string): GrowthAutonomousOutboundOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function upsertAutonomousOutboundScope(input: {
  organizationId: string
  scope: GrowthAutonomousOutboundScope
  now: string
}): GrowthAutonomousOutboundOrgState {
  const state = getAutonomousOutboundOrgState(input.organizationId, input.now)
  const index = state.scopes.findIndex((row) => row.id === input.scope.id)
  const scopes =
    index >= 0
      ? state.scopes.map((row, idx) => (idx === index ? input.scope : row))
      : [...state.scopes, input.scope]
  const next = { ...state, scopes, updatedAt: input.now }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousOutboundAction(input: {
  organizationId: string
  action: GrowthAutonomousOutboundActionRecord
  now: string
}): GrowthAutonomousOutboundOrgState {
  const state = getAutonomousOutboundOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    actions: [...state.actions, input.action].slice(-2000),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function recordAutonomousOutboundEvent(input: {
  organizationId: string
  eventType: string
  now: string
}): void {
  const state = getAutonomousOutboundOrgState(input.organizationId, input.now)
  orgStateById.set(input.organizationId, {
    ...state,
    lastEventAt: input.now,
    lastEventType: input.eventType,
    updatedAt: input.now,
  })
}

export function appendAutonomousOutboundStopTrigger(input: {
  organizationId: string
  scopeId: string
  condition: GrowthAutonomousOutboundStopCondition
  label: string
  now: string
}): GrowthAutonomousOutboundOrgState {
  const state = getAutonomousOutboundOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    stopConditionTriggers: [
      ...state.stopConditionTriggers,
      {
        scopeId: input.scopeId,
        condition: input.condition,
        triggeredAt: input.now,
        label: input.label,
      },
    ].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function listAutonomousOutboundScopes(
  organizationId: string,
  now: string,
): GrowthAutonomousOutboundScope[] {
  return getAutonomousOutboundOrgState(organizationId, now).scopes
}

export function listAutonomousOutboundActions(
  organizationId: string,
  now: string,
): GrowthAutonomousOutboundActionRecord[] {
  return getAutonomousOutboundOrgState(organizationId, now).actions
}

export function clearAutonomousOutboundStoreForTests(): void {
  orgStateById.clear()
}
