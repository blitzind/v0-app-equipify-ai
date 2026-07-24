/**
 * AVA-SUPERVISED-OUTBOUND-1B — Atomic send lifecycle (client-safe).
 */

import { AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"

export const AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER = "ava-supervised-outbound-1b-v1" as const

export const AVA_SUPERVISED_OUTBOUND_SEND_LIFECYCLE_STATUSES = [
  "sending",
  "sent",
  "failed",
  "delivery_unknown",
] as const

export type AvaSupervisedOutboundSendLifecycleStatus =
  (typeof AVA_SUPERVISED_OUTBOUND_SEND_LIFECYCLE_STATUSES)[number]

export type AvaSupervisedOutboundSendLifecycle = {
  qaMarker: typeof AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER
  status: AvaSupervisedOutboundSendLifecycleStatus
  claimedAt: string
  claimedBy: string
  sendAttemptId: string
  completedAt?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

export type AvaSupervisedOutboundSendReceiptStatus =
  | "sent"
  | "failed"
  | "delivery_unknown"

export function readAvaSupervisedOutboundSendLifecycle(
  classification: Record<string, unknown> | null | undefined,
): AvaSupervisedOutboundSendLifecycle | null {
  const raw = classification?.avaSupervisedOutboundSendLifecycle
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<AvaSupervisedOutboundSendLifecycle>
  if (
    row.qaMarker !== AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER ||
    !row.status ||
    !AVA_SUPERVISED_OUTBOUND_SEND_LIFECYCLE_STATUSES.includes(row.status) ||
    !row.claimedAt?.trim() ||
    !row.claimedBy?.trim() ||
    !row.sendAttemptId?.trim()
  ) {
    return null
  }
  return row as AvaSupervisedOutboundSendLifecycle
}

export function buildAvaSupervisedOutboundSendClaim(input: {
  claimedBy: string
  sendAttemptId: string
}): AvaSupervisedOutboundSendLifecycle {
  return {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
    status: "sending",
    claimedAt: new Date().toISOString(),
    claimedBy: input.claimedBy,
    sendAttemptId: input.sendAttemptId,
  }
}

export function isTerminalAvaSupervisedOutboundSendLifecycle(
  lifecycle: AvaSupervisedOutboundSendLifecycle | null,
): boolean {
  return (
    lifecycle?.status === "sent" ||
    lifecycle?.status === "delivery_unknown" ||
    Boolean(lifecycle?.status === "sending")
  )
}

/** Receipt QA marker remains 1A for backward compatibility with persisted rows. */
export const AVA_SUPERVISED_OUTBOUND_RECEIPT_QA_MARKER = AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER
