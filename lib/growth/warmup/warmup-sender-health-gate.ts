/** GS-GROWTH-WARMUP-HEALTH-FIX-1K — warmup executor sender health gate (client-safe). */

import type { GrowthWarmupExecutorSkipCode } from "@/lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupHealthTier, GrowthWarmupProfileStatus } from "@/lib/growth/warmup/warmup-types"
import type { GrowthSenderHealthStatus } from "@/lib/growth/sender/sender-types"

export const GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER = "growth-warmup-health-fix-1k-v1" as const

export type WarmupSenderHealthGateInput = {
  senderStatus: string | null | undefined
  senderHealthStatus: string | null | undefined
  profileStatus: GrowthWarmupProfileStatus
  warmupHealth: GrowthWarmupHealthTier
}

export type WarmupSenderHealthGateResult = {
  allowed: boolean
  skipCode: GrowthWarmupExecutorSkipCode | null
  message: string | null
  nextAction: string | null
  controlledWarmupAllowed: boolean
  senderHealthNote: string | null
}

export function resolveWarmupAlignedSenderHealthStatus(input: {
  profileStatus: GrowthWarmupProfileStatus
  warmupHealth: GrowthWarmupHealthTier
}): GrowthSenderHealthStatus {
  if (input.profileStatus === "throttled" || input.warmupHealth === "critical") {
    return "degraded"
  }
  if (input.profileStatus === "warming") {
    return "warming"
  }
  if (input.warmupHealth === "degraded") {
    return "degraded"
  }
  return "healthy"
}

export function isControlledWarmupSenderHealthAllowed(input: WarmupSenderHealthGateInput): boolean {
  return (
    input.profileStatus === "warming" &&
    input.warmupHealth !== "critical" &&
    input.senderStatus === "connected" &&
    input.senderHealthStatus === "degraded"
  )
}

export function evaluateWarmupExecutorSenderHealthGate(
  input: WarmupSenderHealthGateInput,
): WarmupSenderHealthGateResult {
  const senderStatus = (input.senderStatus ?? "").toLowerCase()
  const senderHealth = (input.senderHealthStatus ?? "").toLowerCase()

  if (!senderStatus) {
    return {
      allowed: false,
      skipCode: "sender_not_connected",
      message: "Sender account not found.",
      nextAction: "Connect sender account before warmup sends.",
      controlledWarmupAllowed: false,
      senderHealthNote: null,
    }
  }

  if (senderStatus !== "connected") {
    return {
      allowed: false,
      skipCode: "sender_not_connected",
      message: `Sender not connected (${input.senderStatus}).`,
      nextAction: "Reconnect mailbox OAuth before warmup sends.",
      controlledWarmupAllowed: false,
      senderHealthNote: null,
    }
  }

  if (input.profileStatus === "warming" && input.warmupHealth === "critical") {
    return {
      allowed: false,
      skipCode: "sender_unhealthy",
      message: "Warmup health is critical — executor sends paused.",
      nextAction: "Review warmup health events before continuing.",
      controlledWarmupAllowed: false,
      senderHealthNote: null,
    }
  }

  if (senderHealth === "blocked" || senderHealth === "critical") {
    return {
      allowed: false,
      skipCode: "sender_unhealthy",
      message: `Sender health is ${input.senderHealthStatus} — operator review required.`,
      nextAction: "Review sender health before warmup continues.",
      controlledWarmupAllowed: false,
      senderHealthNote: null,
    }
  }

  if (isControlledWarmupSenderHealthAllowed(input)) {
    return {
      allowed: true,
      skipCode: null,
      message: null,
      nextAction: null,
      controlledWarmupAllowed: true,
      senderHealthNote: "Sender account health is degraded; controlled warmup is allowed.",
    }
  }

  if (senderHealth === "degraded") {
    return {
      allowed: false,
      skipCode: "sender_unhealthy",
      message: "Sender health is degraded.",
      nextAction: "Review sender health before warmup continues.",
      controlledWarmupAllowed: false,
      senderHealthNote: null,
    }
  }

  return {
    allowed: true,
    skipCode: null,
    message: null,
    nextAction: null,
    controlledWarmupAllowed: false,
    senderHealthNote: null,
  }
}
