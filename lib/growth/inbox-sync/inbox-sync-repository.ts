import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthInboxSyncRun,
  GrowthInboxSyncRunStatus,
  GrowthInboxSyncRunView,
  GrowthInboxThreadLink,
  GrowthInboxThreadSyncDetail,
} from "@/lib/growth/inbox-sync/inbox-sync-types"
import { maskInboxSyncEmail } from "@/lib/growth/inbox-sync/inbox-sync-types"
import type { GrowthInboxThreadMatchContext } from "@/lib/growth/inbox-sync/thread-matcher"
import { hashEmailAddress } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import { normalizeRfcMessageId } from "@/lib/growth/inbox-sync/gmail-message-utils"
import {
  createInboxDedupeState,
  type GrowthInboxDedupeState,
} from "@/lib/growth/inbox-sync/message-dedupe"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function syncRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_sync_runs")
}

function messageMapTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_provider_message_map")
}

function threadLinksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_thread_links")
}

function mapRun(row: Row): GrowthInboxSyncRun {
  return {
    id: asString(row.id),
    mailboxConnectionId: asString(row.mailbox_connection_id),
    providerFamily: asString(row.provider_family),
    status: asString(row.status) as GrowthInboxSyncRunStatus,
    startedAt: asString(row.started_at),
    completedAt: asString(row.completed_at) || null,
    messagesSeen: asNumber(row.messages_seen),
    messagesImported: asNumber(row.messages_imported),
    threadsMatched: asNumber(row.threads_matched),
    threadsCreated: asNumber(row.threads_created),
    duplicatesSkipped: asNumber(row.duplicates_skipped),
    failureReason: asString(row.failure_reason) || null,
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    createdAt: asString(row.created_at),
  }
}

export async function createInboxSyncRun(
  admin: SupabaseClient,
  input: { mailboxConnectionId: string; providerFamily: string; metadata?: Record<string, unknown> },
): Promise<GrowthInboxSyncRun> {
  const { data, error } = await syncRunsTable(admin)
    .insert({
      mailbox_connection_id: input.mailboxConnectionId,
      provider_family: input.providerFamily,
      status: "running",
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRun(data as Row)
}

export async function completeInboxSyncRun(
  admin: SupabaseClient,
  runId: string,
  input: {
    status: GrowthInboxSyncRunStatus
    messagesSeen: number
    messagesImported: number
    threadsMatched: number
    threadsCreated: number
    duplicatesSkipped: number
    failureReason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<GrowthInboxSyncRun> {
  const { data, error } = await syncRunsTable(admin)
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      messages_seen: input.messagesSeen,
      messages_imported: input.messagesImported,
      threads_matched: input.threadsMatched,
      threads_created: input.threadsCreated,
      duplicates_skipped: input.duplicatesSkipped,
      failure_reason: input.failureReason?.slice(0, 500) ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", runId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRun(data as Row)
}

export async function listInboxSyncRuns(admin: SupabaseClient, limit = 50): Promise<GrowthInboxSyncRun[]> {
  const { data, error } = await syncRunsTable(admin).select("*").order("started_at", { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRun(row as Row))
}

export async function enrichInboxSyncRunViews(
  admin: SupabaseClient,
  runs: GrowthInboxSyncRun[],
): Promise<GrowthInboxSyncRunView[]> {
  if (runs.length === 0) return []
  const mailboxIds = [...new Set(runs.map((run) => run.mailboxConnectionId))]
  const { data } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id, email_address, display_name")
    .in("id", mailboxIds)
  const labelMap = new Map(
    (data ?? []).map((row) => {
      const record = row as Row
      const email = maskInboxSyncEmail(asString(record.email_address))
      const name = asString(record.display_name)
      return [asString(record.id), name ? `${name} · ${email}` : email]
    }),
  )
  return runs.map((run) => ({
    ...run,
    mailboxLabel: labelMap.get(run.mailboxConnectionId) ?? "Mailbox",
  }))
}

export async function insertInboxProviderMessageMap(
  admin: SupabaseClient,
  input: {
    mailboxConnectionId: string
    providerFamily: string
    providerMessageId: string
    providerThreadId?: string | null
    inboxThreadId: string
    inboxMessageId: string
    deliveryAttemptId?: string | null
    messageHash: string
  },
): Promise<void> {
  const { error } = await messageMapTable(admin).insert({
    mailbox_connection_id: input.mailboxConnectionId,
    provider_family: input.providerFamily,
    provider_message_id: input.providerMessageId,
    provider_thread_id: input.providerThreadId ?? null,
    inbox_thread_id: input.inboxThreadId,
    inbox_message_id: input.inboxMessageId,
    delivery_attempt_id: input.deliveryAttemptId ?? null,
    message_hash: input.messageHash,
  })
  if (error) throw new Error(error.message)
}

export async function insertInboxThreadLink(
  admin: SupabaseClient,
  input: {
    inboxThreadId: string
    leadId?: string | null
    sequenceEnrollmentId?: string | null
    deliveryAttemptId?: string | null
    linkReason: string
    confidence: number
  },
): Promise<GrowthInboxThreadLink> {
  const { data, error } = await threadLinksTable(admin)
    .insert({
      inbox_thread_id: input.inboxThreadId,
      lead_id: input.leadId ?? null,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      delivery_attempt_id: input.deliveryAttemptId ?? null,
      link_reason: input.linkReason.slice(0, 120),
      confidence: input.confidence,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Row
  return {
    id: asString(row.id),
    inboxThreadId: asString(row.inbox_thread_id),
    leadId: asString(row.lead_id) || null,
    sequenceEnrollmentId: asString(row.sequence_enrollment_id) || null,
    deliveryAttemptId: asString(row.delivery_attempt_id) || null,
    linkReason: asString(row.link_reason),
    confidence: asNumber(row.confidence),
    createdAt: asString(row.created_at),
  }
}

export async function loadInboxSyncDedupeState(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): Promise<GrowthInboxDedupeState> {
  const state = createInboxDedupeState()
  const { data, error } = await messageMapTable(admin)
    .select("provider_family, provider_message_id, message_hash")
    .eq("mailbox_connection_id", mailboxConnectionId)
    .limit(5000)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const record = row as Row
    state.existingProviderMessageIds.add(`${asString(record.provider_family)}:${asString(record.provider_message_id)}`)
    state.existingMessageHashes.add(`${mailboxConnectionId}:${asString(record.message_hash)}`)
  }
  return state
}

export async function loadInboxThreadMatchContext(admin: SupabaseClient): Promise<GrowthInboxThreadMatchContext> {
  const context: GrowthInboxThreadMatchContext = {
    providerThreadMap: new Map(),
    providerMessageMap: new Map(),
    deliveryAttemptByReference: new Map(),
    deliveryAttemptByThreadId: new Map(),
    leadIdByEmailHash: new Map(),
    threadSubjectById: new Map(),
    threadLeadById: new Map(),
    activeEnrollmentByLeadId: new Map(),
  }

  const [maps, threads, attempts, leads, enrollments] = await Promise.all([
    messageMapTable(admin).select("provider_thread_id, provider_message_id, inbox_thread_id").limit(5000),
    admin.schema("growth").from("inbox_threads").select("id, lead_id, subject").limit(5000),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id, lead_id, sequence_enrollment_id, provider_message_id, metadata")
      .not("provider_message_id", "is", null)
      .limit(5000),
    admin.schema("growth").from("leads").select("id, contact_email").not("contact_email", "is", null).limit(5000),
    admin.schema("growth").from("sequence_enrollments").select("id, lead_id").eq("status", "active").limit(5000),
  ])

  for (const row of maps.data ?? []) {
    const record = row as Row
    const threadId = asString(record.inbox_thread_id)
    const providerThreadId = asString(record.provider_thread_id)
    const providerMessageId = asString(record.provider_message_id)
    if (providerThreadId) context.providerThreadMap.set(providerThreadId, threadId)
    if (providerMessageId) context.providerMessageMap.set(providerMessageId, threadId)
  }

  for (const row of threads.data ?? []) {
    const record = row as Row
    const threadId = asString(record.id)
    context.threadSubjectById.set(threadId, asString(record.subject))
    context.threadLeadById.set(threadId, asString(record.lead_id))
  }

  for (const row of attempts.data ?? []) {
    const record = row as Row
    const providerMessageId = asString(record.provider_message_id)
    if (!providerMessageId) continue

    const attemptRef = {
      attemptId: asString(record.id),
      leadId: asString(record.lead_id) || null,
      enrollmentId: asString(record.sequence_enrollment_id) || null,
    }
    context.deliveryAttemptByReference.set(providerMessageId, attemptRef)

    const metadata =
      record.metadata && typeof record.metadata === "object" ? (record.metadata as Record<string, unknown>) : {}
    const providerThreadId = asString(metadata.provider_thread_id)
    if (providerThreadId) {
      context.deliveryAttemptByThreadId.set(providerThreadId, attemptRef)
    }
    const rfcMessageId = normalizeRfcMessageId(asString(metadata.rfc_message_id))
    if (rfcMessageId) {
      context.deliveryAttemptByReference.set(rfcMessageId, attemptRef)
    }
  }

  for (const row of leads.data ?? []) {
    const record = row as Row
    const email = asString(record.contact_email)
    if (!email) continue
    context.leadIdByEmailHash.set(hashEmailAddress(email), asString(record.id))
  }

  for (const row of enrollments.data ?? []) {
    const record = row as Row
    context.activeEnrollmentByLeadId.set(asString(record.lead_id), asString(record.id))
  }

  return context
}

export async function fetchInboxThreadSyncDetail(
  admin: SupabaseClient,
  threadId: string,
): Promise<GrowthInboxThreadSyncDetail | null> {
  const [mapRes, linkRes] = await Promise.all([
    messageMapTable(admin)
      .select("provider_thread_id, delivery_attempt_id")
      .eq("inbox_thread_id", threadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    threadLinksTable(admin)
      .select("*")
      .eq("inbox_thread_id", threadId)
      .order("confidence", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const mapRow = mapRes.data as Row | null
  const linkRow = linkRes.data as Row | null
  if (!mapRow && !linkRow) return null

  return {
    providerThreadId: mapRow ? asString(mapRow.provider_thread_id) || null : null,
    matchedBy: linkRow ? asString(linkRow.link_reason) || null : null,
    confidence: linkRow ? asNumber(linkRow.confidence) : 0,
    sequenceEnrollmentId: linkRow ? asString(linkRow.sequence_enrollment_id) || null : null,
    deliveryAttemptId: (linkRow ? asString(linkRow.delivery_attempt_id) : asString(mapRow?.delivery_attempt_id)) || null,
    sequenceExitCandidate: Boolean(linkRow?.sequence_enrollment_id),
  }
}

export async function findLeadByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .ilike("contact_email", normalized)
    .limit(1)
    .maybeSingle()
  return data ? asString((data as Row).id) : null
}
