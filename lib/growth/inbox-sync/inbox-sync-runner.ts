import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getMailboxConnection, listMailboxConnections } from "@/lib/growth/mailboxes/mailbox-repository"
import { getMailboxProviderCapabilities } from "@/lib/growth/mailboxes/mailbox-provider-registry"
import { addInboxMessage, createInboxThread } from "@/lib/growth/inbox/thread-repository"
import {
  completeInboxSyncRun,
  createInboxSyncRun,
  findLeadByEmail,
  insertInboxProviderMessageMap,
  insertInboxThreadLink,
  loadInboxSyncDedupeState,
  loadInboxThreadMatchContext,
} from "@/lib/growth/inbox-sync/inbox-sync-repository"
import {
  recordInboxSyncLeadEvent,
  recordInboxSyncPlatformEvent,
  recordSequenceExitCandidate,
} from "@/lib/growth/inbox-sync/inbox-sync-events"
import { getInboxSyncAdapter } from "@/lib/growth/inbox-sync/provider-sync-adapters/inbox-sync-adapter-registry"
import { hashEmailAddress } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import {
  registerImportedInboxMessage,
  shouldSkipInboxDuplicate,
} from "@/lib/growth/inbox-sync/message-dedupe"
import {
  resolveThreadMatchFromContext,
  shouldCreateNewInboxThread,
} from "@/lib/growth/inbox-sync/thread-matcher"
import type { GrowthInboxSyncRunSummary } from "@/lib/growth/inbox-sync/inbox-sync-types"

function isSimulateEnabled(): boolean {
  return process.env.GROWTH_INBOX_SYNC_SIMULATE?.trim() === "true"
}

export async function runInboxSyncForMailbox(
  admin: SupabaseClient,
  input: {
    mailboxConnectionId: string
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthInboxSyncRunSummary> {
  const mailbox = await getMailboxConnection(admin, input.mailboxConnectionId)
  if (!mailbox) throw new Error("mailbox_not_found")

  const capabilities = getMailboxProviderCapabilities(mailbox.provider_family)
  if (!capabilities.replySync && !isSimulateEnabled()) {
    throw new Error("mailbox_sync_unsupported")
  }

  const run = await createInboxSyncRun(admin, {
    mailboxConnectionId: mailbox.id,
    providerFamily: mailbox.provider_family,
    metadata: { simulate: isSimulateEnabled() },
  })

  await recordInboxSyncPlatformEvent(admin, {
    eventType: "inbox_sync_started",
    title: "Inbox sync started",
    summary: `Sync started for ${mailbox.email_address}.`,
    payload: { mailbox_connection_id: mailbox.id, run_id: run.id },
  })

  const adapter = getInboxSyncAdapter({
    providerFamily: mailbox.provider_family,
    mailboxConnectionId: mailbox.id,
  })

  let messagesSeen = 0
  let messagesImported = 0
  let threadsMatched = 0
  let threadsCreated = 0
  let duplicatesSkipped = 0

  try {
    const [dedupeState, matchContext] = await Promise.all([
      loadInboxSyncDedupeState(admin, mailbox.id),
      loadInboxThreadMatchContext(admin),
    ])

    const rawMessages = await adapter.listRecentMessages()
    messagesSeen = rawMessages.length

    for (const raw of rawMessages) {
      const message = adapter.normalizeMessage(raw)
      const dedupe = shouldSkipInboxDuplicate(
        {
          providerFamily: mailbox.provider_family,
          providerMessageId: message.providerMessageId,
          messageHash: message.messageHash,
          mailboxConnectionId: mailbox.id,
          fromEmail: message.fromEmail,
          messageTimestamp: message.messageTimestamp,
          bodyPreview: message.bodyPreview,
        },
        dedupeState,
      )

      if (dedupe.skip) {
        duplicatesSkipped += 1
        await recordInboxSyncPlatformEvent(admin, {
          eventType: "inbox_duplicate_skipped",
          title: "Duplicate inbox message skipped",
          summary: dedupe.reason ?? "duplicate",
          payload: { provider_message_id: message.providerMessageId, reason: dedupe.reason },
        })
        continue
      }

      let leadId = await findLeadByEmail(admin, message.fromEmail)
      const match = resolveThreadMatchFromContext(
        {
          providerThreadId: message.providerThreadId,
          providerMessageId: message.providerMessageId,
          inReplyTo: message.inReplyTo,
          references: message.references,
          fromEmail: message.fromEmail,
          fromEmailHash: hashEmailAddress(message.fromEmail),
          subject: message.subject,
        },
        matchContext,
      )

      leadId = leadId ?? match.leadId

      let threadId = match.inboxThreadId
      if (!threadId && shouldCreateNewInboxThread(match) && leadId) {
        const created = await createInboxThread(admin, {
          lead_id: leadId,
          subject: message.subject,
          provider_family: mailbox.provider_family,
          mailbox_connection_id: mailbox.id,
        })
        threadId = created.id
        threadsCreated += 1
        matchContext.threadLeadById.set(threadId, leadId)
        matchContext.threadSubjectById.set(threadId, message.subject)
        if (message.providerThreadId) matchContext.providerThreadMap.set(message.providerThreadId, threadId)

        await recordInboxSyncPlatformEvent(admin, {
          eventType: "inbox_thread_created",
          title: "Inbox thread created",
          summary: "New thread created from provider reply.",
          threadId,
          leadId,
          payload: { matched_by: match.matchedBy, confidence: match.confidence },
        })
      } else if (threadId) {
        threadsMatched += 1
        await recordInboxSyncPlatformEvent(admin, {
          eventType: "inbox_thread_matched",
          title: "Inbox thread matched",
          summary: `Matched by ${match.matchedBy}.`,
          threadId,
          leadId: leadId ?? undefined,
          payload: { matched_by: match.matchedBy, confidence: match.confidence },
        })
      } else {
        continue
      }

      const imported = await addInboxMessage(admin, {
        thread_id: threadId,
        direction: "inbound",
        sender: message.fromEmail,
        recipient: message.toEmail,
        subject: message.subject,
        body_preview: message.bodyPreview,
        provider_message_id: message.providerMessageId,
        message_timestamp: message.messageTimestamp,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
      })

      await insertInboxProviderMessageMap(admin, {
        mailboxConnectionId: mailbox.id,
        providerFamily: mailbox.provider_family,
        providerMessageId: message.providerMessageId,
        providerThreadId: message.providerThreadId,
        inboxThreadId: threadId,
        inboxMessageId: imported.message.id,
        deliveryAttemptId: match.deliveryAttemptId,
        messageHash: message.messageHash,
      })

      await insertInboxThreadLink(admin, {
        inboxThreadId: threadId,
        leadId,
        sequenceEnrollmentId: match.sequenceEnrollmentId,
        deliveryAttemptId: match.deliveryAttemptId,
        linkReason: match.matchedBy,
        confidence: match.confidence,
      })

      registerImportedInboxMessage(message, { providerFamily: mailbox.provider_family, mailboxConnectionId: mailbox.id }, dedupeState)
      messagesImported += 1

      if (leadId) {
        await recordInboxSyncLeadEvent(admin, {
          leadId,
          eventType: "inbox_reply_imported",
          title: "Inbox reply imported",
          summary: "Provider reply synced into unified inbox.",
          payload: { thread_id: threadId, matched_by: match.matchedBy },
        })
      }

      if (match.sequenceEnrollmentId && leadId) {
        await recordSequenceExitCandidate(admin, {
          threadId,
          leadId,
          sequenceEnrollmentId: match.sequenceEnrollmentId,
          reason: "inbound_reply_on_active_sequence",
        })
      }
    }

    const completed = await completeInboxSyncRun(admin, run.id, {
      status: "completed",
      messagesSeen,
      messagesImported,
      threadsMatched,
      threadsCreated,
      duplicatesSkipped,
      metadata: { simulate: isSimulateEnabled() },
    })

    await recordInboxSyncPlatformEvent(admin, {
      eventType: "inbox_sync_completed",
      title: "Inbox sync completed",
      summary: `Imported ${messagesImported} messages.`,
      payload: { run_id: completed.id, messages_imported: messagesImported },
    })

    return {
      runId: completed.id,
      mailboxConnectionId: completed.mailboxConnectionId,
      providerFamily: completed.providerFamily,
      status: completed.status,
      messagesSeen,
      messagesImported,
      threadsMatched,
      threadsCreated,
      duplicatesSkipped,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "sync_failed"
    const failed = await completeInboxSyncRun(admin, run.id, {
      status: "failed",
      messagesSeen,
      messagesImported,
      threadsMatched,
      threadsCreated,
      duplicatesSkipped,
      failureReason: reason,
    })
    throw new Error(failed.failureReason ?? reason)
  }
}

export async function runInboxSyncForEnabledMailboxes(
  admin: SupabaseClient,
  input?: { actorUserId?: string; actorEmail?: string; limit?: number },
): Promise<{ scanned: number; completed: number; failed: number; summaries: GrowthInboxSyncRunSummary[] }> {
  const mailboxes = await listMailboxConnections(admin)
  const eligible = mailboxes.filter((mailbox) => {
    if (mailbox.status !== "connected") return false
    const caps = getMailboxProviderCapabilities(mailbox.provider_family)
    return caps.replySync || isSimulateEnabled()
  })

  const limit = input?.limit ?? 10
  const batch = eligible.slice(0, limit)
  const summaries: GrowthInboxSyncRunSummary[] = []
  let completed = 0
  let failed = 0

  for (const mailbox of batch) {
    try {
      const summary = await runInboxSyncForMailbox(admin, {
        mailboxConnectionId: mailbox.id,
        actorUserId: input?.actorUserId ?? "system",
        actorEmail: input?.actorEmail ?? "cron@growth.equipify.internal",
      })
      summaries.push(summary)
      completed += 1
    } catch {
      failed += 1
    }
  }

  return { scanned: batch.length, completed, failed, summaries }
}
