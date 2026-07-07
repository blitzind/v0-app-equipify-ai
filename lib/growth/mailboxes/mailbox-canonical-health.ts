/** GE-MAILBOX-HEALTH-CONSISTENCY-1 — Canonical mailbox health classification (client-safe). */

import { buildMailboxHealthReason, isMailboxTokenExpired } from "@/lib/growth/mailboxes/mailbox-health"
import type { GrowthMailboxHealthTier } from "@/lib/growth/mailboxes/mailbox-types"

export const GROWTH_MAILBOX_CANONICAL_HEALTH_QA_MARKER = "ge-mailbox-health-consistency-1-v1" as const

export const GROWTH_MAILBOX_CANONICAL_HEALTH_STATES = [
  "healthy",
  "warning",
  "unhealthy",
  "disconnected",
] as const

export type GrowthMailboxCanonicalHealthState = (typeof GROWTH_MAILBOX_CANONICAL_HEALTH_STATES)[number]

export type GrowthMailboxCanonicalHealthInput = {
  connectionStatus: string | null | undefined
  healthTier?: GrowthMailboxHealthTier | string | null
  healthScore?: number | null
  tokenExpiresAt?: string | null
  tokenConfigured?: boolean
  validationFailureCount?: number | null
  needsReconnect?: boolean
  signatureStatus?: "configured" | "missing" | "inherited" | null
  lastValidationAt?: string | null
  dailyCap?: number | null
  operationalPaused?: boolean
  now?: number
}

export type GrowthMailboxCanonicalHealth = {
  state: GrowthMailboxCanonicalHealthState
  warningReasons: string[]
  requiresAction: boolean
  primaryLabel: string
}

const DISCONNECTED_STATUSES = new Set([
  "pending",
  "connecting",
  "error",
  "expired",
  "disabled",
  "no_mailbox",
])

const VALIDATION_STALE_MS = 7 * 24 * 60 * 60 * 1000

function disconnectedLabel(status: string): string {
  if (status === "expired") return "Mailbox connection expired"
  if (status === "error") return "Mailbox connection error"
  if (status === "no_mailbox") return "No mailbox connected"
  return "Mailbox is not connected"
}

export function classifyMailboxCanonicalHealth(
  input: GrowthMailboxCanonicalHealthInput,
): GrowthMailboxCanonicalHealth {
  const now = input.now ?? Date.now()
  const connectionStatus = input.connectionStatus ?? "no_mailbox"
  const healthTier = input.healthTier ?? "warning"
  const healthScore = input.healthScore ?? 0
  const validationFailureCount = input.validationFailureCount ?? 0
  const warningReasons: string[] = []

  if (DISCONNECTED_STATUSES.has(connectionStatus)) {
    const state = connectionStatus === "expired" || connectionStatus === "error" ? "unhealthy" : "disconnected"
    return {
      state,
      warningReasons: [disconnectedLabel(connectionStatus)],
      requiresAction: true,
      primaryLabel: state === "unhealthy" ? "Unhealthy" : "Disconnected",
    }
  }

  if (input.needsReconnect) {
    warningReasons.push("Reconnect required to refresh OAuth tokens")
  }

  if (isMailboxTokenExpired(input.tokenExpiresAt, now)) {
    return {
      state: "unhealthy",
      warningReasons: ["OAuth token expired"],
      requiresAction: true,
      primaryLabel: "Unhealthy",
    }
  }

  if (healthTier === "critical") {
    return {
      state: "unhealthy",
      warningReasons: ["Mailbox health is critical"],
      requiresAction: true,
      primaryLabel: "Unhealthy",
    }
  }

  if (connectionStatus === "warning") {
    warningReasons.push("Connection status requires review")
  }

  if (healthTier === "warning" || healthTier === "degraded") {
    warningReasons.push(`Health tier: ${healthTier}`)
  }

  if (validationFailureCount > 3) {
    warningReasons.push("Validation failures exceed threshold")
  } else if (validationFailureCount > 0) {
    warningReasons.push("Recent validation failures detected")
  }

  if (input.signatureStatus === "missing") {
    warningReasons.push("Signature not configured")
  } else if (input.signatureStatus === "inherited") {
    warningReasons.push("Signature inherited from sender profile")
  }

  if (input.lastValidationAt) {
    const validatedAt = Date.parse(input.lastValidationAt)
    if (Number.isFinite(validatedAt) && now - validatedAt > VALIDATION_STALE_MS) {
      warningReasons.push("Last validation older than 7 days")
    }
  } else if (connectionStatus === "connected") {
    warningReasons.push("Mailbox has not been validated yet")
  }

  if ((input.dailyCap ?? 0) <= 0) {
    warningReasons.push("Daily send cap not assigned")
  }

  if (input.operationalPaused) {
    warningReasons.push("Sender paused in pool")
  }

  const scoreReason = buildMailboxHealthReason({
    status: connectionStatus === "connected" ? "connected" : "warning",
    token_expires_at: input.tokenExpiresAt,
    validation_failure_count: validationFailureCount,
    score: healthScore,
    now,
  })
  if (scoreReason && !warningReasons.includes(scoreReason)) {
    warningReasons.push(scoreReason)
  }

  if (warningReasons.length > 0) {
    return {
      state: "warning",
      warningReasons,
      requiresAction: true,
      primaryLabel: "Warning",
    }
  }

  if (connectionStatus === "connected" && healthTier === "healthy" && healthScore >= 90) {
    return {
      state: "healthy",
      warningReasons: [],
      requiresAction: false,
      primaryLabel: "Healthy",
    }
  }

  if (connectionStatus === "connected") {
    return {
      state: "warning",
      warningReasons: [`Connection health ${healthScore}/100`],
      requiresAction: true,
      primaryLabel: "Warning",
    }
  }

  return {
    state: "unhealthy",
    warningReasons: ["Mailbox requires attention"],
    requiresAction: true,
    primaryLabel: "Unhealthy",
  }
}

export function isCanonicalHealthyMailbox(input: GrowthMailboxCanonicalHealthInput): boolean {
  return classifyMailboxCanonicalHealth(input).state === "healthy"
}

export function aggregateMailboxCanonicalHealth(
  inputs: GrowthMailboxCanonicalHealthInput[],
): {
  healthyCount: number
  warningCount: number
  unhealthyCount: number
  disconnectedCount: number
} {
  let healthyCount = 0
  let warningCount = 0
  let unhealthyCount = 0
  let disconnectedCount = 0

  for (const input of inputs) {
    const result = classifyMailboxCanonicalHealth(input)
    if (result.state === "healthy") healthyCount += 1
    else if (result.state === "warning") warningCount += 1
    else if (result.state === "unhealthy") unhealthyCount += 1
    else disconnectedCount += 1
  }

  return { healthyCount, warningCount, unhealthyCount, disconnectedCount }
}

export function mailboxCanonicalHealthFromConnection(input: {
  status: string
  health_tier: GrowthMailboxHealthTier | string
  connection_health: number
  token_expires_at?: string | null
  token_configured?: boolean
  validation_failure_count?: number
  last_validation_at?: string | null
}): GrowthMailboxCanonicalHealth {
  return classifyMailboxCanonicalHealth({
    connectionStatus: input.status,
    healthTier: input.health_tier,
    healthScore: input.connection_health,
    tokenExpiresAt: input.token_expires_at,
    tokenConfigured: input.token_configured,
    validationFailureCount: input.validation_failure_count,
    lastValidationAt: input.last_validation_at,
  })
}

export function resolveMailboxCardHealthDisplay(input: {
  canonicalHealthState: GrowthMailboxCanonicalHealthState
  canonicalHealthLabel: string
  warningReasons: string[]
}): {
  state: GrowthMailboxCanonicalHealthState
  label: string
} {
  if (input.canonicalHealthState === "warning" && input.warningReasons.length === 0) {
    return { state: "healthy", label: "Healthy" }
  }
  return {
    state: input.canonicalHealthState,
    label: input.canonicalHealthLabel,
  }
}
