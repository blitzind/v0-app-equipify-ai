/**
 * Deterministic transfer state machine — Phase 1E.
 * Pure functions safe for unit tests (no server-only).
 */

import type { VoiceTransferCancelAction, VoiceTransferKind, VoiceTransferStatus } from "@/lib/voice/transfer-control/types"

export type VoiceTransferTransitionAction =
  | "start"
  | "enter_consult"
  | "complete"
  | "cancel"
  | "return_to_operator"
  | "send_to_voicemail"
  | "fail"

export type VoiceTransferTransitionResult =
  | { ok: true; nextStatus: VoiceTransferStatus }
  | { ok: false; reason: string }

const ACTIVE_TRANSFER_STATUSES: VoiceTransferStatus[] = ["starting", "consulting", "completing"]

export function isActiveTransferStatus(status: VoiceTransferStatus): boolean {
  return ACTIVE_TRANSFER_STATUSES.includes(status)
}

export function assertNoDuplicateActiveTransfer(input: {
  activeTransferStatus: VoiceTransferStatus | null
}): { ok: true } | { ok: false; reason: string } {
  if (input.activeTransferStatus && isActiveTransferStatus(input.activeTransferStatus)) {
    return { ok: false, reason: "An active transfer is already in progress for this call." }
  }
  return { ok: true }
}

export function initialTransferStatus(kind: VoiceTransferKind): VoiceTransferStatus {
  return "starting"
}

export function transitionTransferStatus(input: {
  currentStatus: VoiceTransferStatus
  action: VoiceTransferTransitionAction
  transferKind: VoiceTransferKind
}): VoiceTransferTransitionResult {
  const { currentStatus, action, transferKind } = input

  if (action === "start") {
    if (currentStatus !== "idle") {
      return { ok: false, reason: "Transfer can only start from idle state." }
    }
    return { ok: true, nextStatus: "starting" }
  }

  if (action === "enter_consult") {
    if (currentStatus !== "starting") {
      return { ok: false, reason: "Consult state requires transfer to be starting." }
    }
    if (transferKind === "cold") {
      return { ok: false, reason: "Cold transfer does not enter consult state." }
    }
    return { ok: true, nextStatus: "consulting" }
  }

  if (action === "complete") {
    if (transferKind === "cold") {
      if (currentStatus !== "starting") {
        return { ok: false, reason: "Cold transfer can complete only from starting state." }
      }
      return { ok: true, nextStatus: "completed" }
    }
    if (!["consulting", "starting"].includes(currentStatus)) {
      return { ok: false, reason: "Transfer must be consulting or starting before completion." }
    }
    return { ok: true, nextStatus: "completed" }
  }

  if (action === "cancel") {
    if (!isActiveTransferStatus(currentStatus)) {
      return { ok: false, reason: "No active transfer to cancel." }
    }
    return { ok: true, nextStatus: "canceled" }
  }

  if (action === "return_to_operator") {
    if (currentStatus !== "consulting") {
      return { ok: false, reason: "Return to operator requires an active consult transfer." }
    }
    return { ok: true, nextStatus: "returned" }
  }

  if (action === "send_to_voicemail") {
    if (!isActiveTransferStatus(currentStatus)) {
      return { ok: false, reason: "Send to voicemail requires an active transfer." }
    }
    return { ok: true, nextStatus: "completed" }
  }

  if (action === "fail") {
    if (!isActiveTransferStatus(currentStatus) && currentStatus !== "idle") {
      return { ok: false, reason: "Transfer is already terminal." }
    }
    return { ok: true, nextStatus: "failed" }
  }

  return { ok: false, reason: "Unsupported transfer action." }
}

export function mapCancelActionToTransition(action: VoiceTransferCancelAction): VoiceTransferTransitionAction {
  switch (action) {
    case "return_to_operator":
      return "return_to_operator"
    case "send_to_voicemail":
      return "send_to_voicemail"
    default:
      return "cancel"
  }
}

export function transferKindRequiresConsult(kind: VoiceTransferKind): boolean {
  return kind === "warm" || kind === "consult"
}
