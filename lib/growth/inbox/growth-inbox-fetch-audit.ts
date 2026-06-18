/**
 * Phase 8K — observe Growth Inbox fetches against the minimal runtime contract (warn only, never block).
 */

import { classifyGrowthInboxFetchRoute } from "@/lib/growth/inbox/growth-inbox-fetch-route-classifier"
import { isGrowthInboxMinimalRuntimeActive } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import {
  recordGrowthInboxAllowedInitialRequest,
  recordGrowthInboxAllowedSelectedThreadRequest,
  recordGrowthInboxFlaggedInitialRequest,
  recordGrowthInboxFlaggedTier3EagerRequest,
  recordGrowthInboxTier2SoftDisabledRequest,
} from "@/lib/growth/inbox/growth-inbox-minimal-runtime-metrics"
import { resolveGrowthRuntimeProfileId } from "@/lib/growth/runtime/growth-runtime-profile"

export const GROWTH_INBOX_FETCH_AUDIT_QA_MARKER = "growth-inbox-fetch-audit-v1" as const

export const GROWTH_ON_DEMAND_DEFERRED_COPY =
  "Intelligence is on demand to keep Growth Engine fast. Load when needed." as const

export type GrowthInboxFetchAuditLifecycle = "booting" | "ready" | "thread_selected"

let lifecycle: GrowthInboxFetchAuditLifecycle = "booting"
let explicitOperatorUntil = 0

export function getGrowthInboxFetchAuditLifecycle(): GrowthInboxFetchAuditLifecycle {
  return lifecycle
}

export function markGrowthInboxInitialLoadComplete(): void {
  if (lifecycle === "booting") lifecycle = "ready"
}

export function markGrowthInboxThreadSelected(): void {
  lifecycle = "thread_selected"
}

export function markGrowthInboxThreadCleared(): void {
  lifecycle = "ready"
}

/** Call before operator-initiated Tier 3 load or manual refresh. */
export function markGrowthInboxExplicitOperatorAction(durationMs = 8_000): void {
  explicitOperatorUntil = Date.now() + durationMs
}

export function isGrowthInboxExplicitOperatorContext(): boolean {
  return Date.now() < explicitOperatorUntil
}

export function resetGrowthInboxFetchAuditLifecycle(): void {
  lifecycle = "booting"
  explicitOperatorUntil = 0
}

function shouldAuditFetch(): boolean {
  const profile = resolveGrowthRuntimeProfileId()
  if (profile === "full_admin" || profile === "development_all") return false
  return isGrowthInboxMinimalRuntimeActive()
}

export function auditGrowthInboxFetch(input: RequestInfo | URL, init?: RequestInit): void {
  if (!shouldAuditFetch()) return

  const classification = classifyGrowthInboxFetchRoute(input)
  if (!classification) return

  const { pathname, tier, isInitialAllowed, isSelectedThreadAllowed, isTier3OnDemand, isTier2Route } =
    classification
  const explicit =
    isGrowthInboxExplicitOperatorContext() ||
    (init as (RequestInit & { growthExplicitOperator?: boolean }) | undefined)?.growthExplicitOperator === true

  if (isTier2Route) {
    recordGrowthInboxTier2SoftDisabledRequest(pathname)
    if (process.env.NODE_ENV === "development") {
      console.warn(`[GrowthInboxFetchAudit] Tier 2 route during minimal runtime: ${pathname}`)
    }
    return
  }

  if (lifecycle === "booting" || lifecycle === "ready") {
    if (isInitialAllowed) {
      recordGrowthInboxAllowedInitialRequest(pathname)
      return
    }
    if (isTier3OnDemand && !explicit) {
      recordGrowthInboxFlaggedTier3EagerRequest(pathname, "tier3_before_explicit_action")
      if (process.env.NODE_ENV === "development") {
        console.warn(`[GrowthInboxFetchAudit] Tier 3 eager fetch blocked by contract: ${pathname}`)
      }
      return
    }
    if (!isInitialAllowed && !explicit) {
      recordGrowthInboxFlaggedInitialRequest(pathname, `unexpected_initial_${tier}`)
      if (process.env.NODE_ENV === "development") {
        console.warn(`[GrowthInboxFetchAudit] Non-allowlisted initial fetch: ${pathname}`)
      }
    }
    return
  }

  if (lifecycle === "thread_selected") {
    if (isSelectedThreadAllowed && !isTier3OnDemand) {
      recordGrowthInboxAllowedSelectedThreadRequest(pathname)
      return
    }
    if (isTier3OnDemand && !explicit) {
      recordGrowthInboxFlaggedTier3EagerRequest(pathname, "tier3_on_thread_select")
      if (process.env.NODE_ENV === "development") {
        console.warn(`[GrowthInboxFetchAudit] Tier 3 fetch on thread selection: ${pathname}`)
      }
      return
    }
    if (isInitialAllowed) {
      recordGrowthInboxAllowedInitialRequest(pathname)
      return
    }
    if (explicit) return
    recordGrowthInboxFlaggedInitialRequest(pathname, `unexpected_thread_phase_${tier}`)
    if (process.env.NODE_ENV === "development") {
      console.warn(`[GrowthInboxFetchAudit] Unexpected fetch during thread phase: ${pathname}`)
    }
  }
}
