import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import { finalizeIngestedReplyIntelligence } from "@/lib/growth/replies/finalize-ingested-reply-intelligence"
import { ingestGrowthReplyFromInboxSync } from "@/lib/growth/replies/reply-ingestion-pipeline"
import { resolveReplyIngestionConnectionId } from "@/lib/growth/replies/reply-connection-resolver"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ReconcileInboxSyncReplyResult = {
  leadId: string
  ingestionEventId: string | null
  outboundReplyId: string | null
  reconciled: boolean
  reason: string
}

/**
 * Re-process inbox-sync ingestion gaps where reply_ingestion_events exist without outbound_replies.
 * Uses official ingestion + intelligence bridge — no synthetic reply content.
 */
export async function reconcileInboxSyncReplyGapForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<ReconcileInboxSyncReplyResult> {
  const { data: existingReplies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,intelligence_processed_at")
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(1)

  if (existingReplies?.length && asString(existingReplies[0].intelligence_processed_at)) {
    return {
      leadId,
      ingestionEventId: null,
      outboundReplyId: asString(existingReplies[0].id),
      reconciled: false,
      reason: "already_complete",
    }
  }

  const { data: ingestionRows } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("*")
    .eq("lead_id", leadId)
    .is("outbound_reply_id", null)
    .order("received_at", { ascending: false })
    .limit(1)

  const ingestion = (ingestionRows ?? [])[0] as Record<string, unknown> | undefined
  if (!ingestion) {
    return {
      leadId,
      ingestionEventId: null,
      outboundReplyId: existingReplies?.[0]?.id ? asString(existingReplies[0].id) : null,
      reconciled: false,
      reason: "no_pending_ingestion",
    }
  }

  const mailboxConnectionId = asString(ingestion.mailbox_connection_id)
  const connectionId = await resolveReplyIngestionConnectionId(admin, {
    leadId,
    mailboxConnectionId: mailboxConnectionId || null,
    source: "google_mailbox_sync",
  })

  if (!connectionId) {
    return {
      leadId,
      ingestionEventId: asString(ingestion.id),
      outboundReplyId: null,
      reconciled: false,
      reason: "connection_unresolved",
    }
  }

  const ingestionResult = await ingestGrowthReplyFromInboxSync(admin, {
    leadId,
    connectionId,
    mailboxConnectionId: mailboxConnectionId || null,
    inboxMessageId: asString(ingestion.inbox_message_id) || null,
    senderEmail: asString(ingestion.sender_email) || null,
    recipientEmail: asString(ingestion.recipient_email) || null,
    subject: asString(ingestion.subject) || null,
    bodyExcerpt: asString(ingestion.body_excerpt) || null,
    receivedAt: asString(ingestion.received_at) || new Date().toISOString(),
    providerFamily: asString(ingestion.provider_family) || "google",
    providerMessageId: asString(ingestion.provider_message_id) || null,
    sequenceEnrollmentId: asString(ingestion.sequence_enrollment_id) || null,
    deliveryAttemptId: asString(ingestion.delivery_attempt_id) || null,
  })

  const outboundReply = ingestionResult.outboundReply
  if (!outboundReply) {
    return {
      leadId,
      ingestionEventId: asString(ingestion.id),
      outboundReplyId: ingestionResult.outboundReplyId,
      reconciled: false,
      reason: ingestionResult.deduped ? "deduped_without_outbound" : "outbound_not_created",
    }
  }

  await finalizeIngestedReplyIntelligence(admin, {
    leadId,
    outboundReply: outboundReply as GrowthOutboundReply,
    bodyPreview: asString(ingestion.body_excerpt) || null,
    senderEmail: asString(ingestion.sender_email) || null,
    sequenceEnrollmentId: asString(ingestion.sequence_enrollment_id) || null,
    ingestionEventId: ingestionResult.ingestionEventId,
    deliveryAttemptId: asString(ingestion.delivery_attempt_id) || null,
  })

  return {
    leadId,
    ingestionEventId: asString(ingestion.id),
    outboundReplyId: outboundReply.id,
    reconciled: true,
    reason: "intelligence_finalized",
  }
}

export async function assessHistoricalReplyBackfillPossible(
  admin: SupabaseClient,
  leadId: string,
): Promise<{ possible: boolean; reason: string }> {
  const { count: pendingIngestion } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .is("outbound_reply_id", null)

  if (!pendingIngestion) {
    return { possible: false, reason: "no_pending_ingestion" }
  }

  const { data: ingestion } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("mailbox_connection_id")
    .eq("lead_id", leadId)
    .is("outbound_reply_id", null)
    .limit(1)
    .maybeSingle()

  const mailboxConnectionId = asString((ingestion as { mailbox_connection_id?: string } | null)?.mailbox_connection_id)
  const connectionId = await resolveReplyIngestionConnectionId(admin, {
    leadId,
    mailboxConnectionId: mailboxConnectionId || null,
    source: "google_mailbox_sync",
  })

  if (!connectionId) {
    return { possible: false, reason: "connection_unresolved" }
  }

  return { possible: true, reason: "ingestion_pending_connection_resolvable" }
}
