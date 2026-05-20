import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { logCommunicationEvent } from "@/lib/notifications/log-event"

export async function logProspectBusinessCardScanAudit(args: {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  success: boolean
  failureReason?: string | null
  durationMs: number
}): Promise<void> {
  const failureReason = args.failureReason?.trim().slice(0, 120) || null

  await logCommunicationEvent(args.supabase, {
    organizationId: args.organizationId,
    channel: "system",
    direction: "outbound",
    eventType: "prospect_business_card_scan_used",
    title: args.success ? "Business card scan completed" : "Business card scan failed",
    summary: args.success
      ? "Prospect business card fields extracted for review."
      : failureReason
        ? `Scan failed: ${failureReason}`
        : "Scan failed.",
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: args.success ? "sent" : "failed",
    recipientKind: "none",
    provider: "internal",
    metadata: {
      success: args.success,
      failure_reason: failureReason,
      duration_ms: Math.max(0, Math.round(args.durationMs)),
    },
    sentAt: new Date().toISOString(),
    createdBy: args.userId,
  })
}
