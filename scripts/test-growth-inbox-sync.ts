/**
 * Regression checks for Inbox Sync + Thread Continuity (Phase 2I).
 * Run: pnpm test:growth-inbox-sync
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CRON_ACTOR_EMAIL,
  isGrowthActorUserIdUuid,
  normalizeGrowthActorUserIdForDb,
  resolveGrowthActorForDb,
} from "../lib/growth/actor-user-id"
import {
  buildInboxPreviewDedupeKey,
  createInboxDedupeState,
  shouldSkipInboxDuplicate,
} from "../lib/growth/inbox-sync/message-dedupe"
import {
  buildInboxMessageHash,
  buildMessagePreview,
  hashEmailAddress,
  normalizeProviderMessage,
  subjectSimilarityScore,
} from "../lib/growth/inbox-sync/provider-message-normalizer"
import {
  resolveThreadMatchFromContext,
  resolveThreadMatchOrder,
  shouldCreateNewInboxThread,
} from "../lib/growth/inbox-sync/thread-matcher"
import {
  GROWTH_INBOX_SYNC_PRIVACY_NOTE,
  GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER,
  GROWTH_INBOX_THREAD_MATCH_CONFIDENCE,
  maskInboxSyncEmail,
} from "../lib/growth/inbox-sync/inbox-sync-types"
import { GROWTH_INBOX_SYNC_SCHEMA_MIGRATION } from "../lib/growth/inbox-sync/inbox-sync-schema-health"
import { classifyReply } from "../lib/growth/inbox/reply-classifier"
import {
  normalizeRfcMessageId,
  parseEmailAddress,
  parseReferencesHeader,
} from "../lib/growth/inbox-sync/gmail-message-utils"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_INBOX_SYNC_THREAD_CONTINUITY_QA_MARKER, "growth-inbox-sync-thread-continuity-v1")
  assert.match(GROWTH_INBOX_SYNC_PRIVACY_NOTE, /no autonomous replies/i)

  const migration = readSource(`supabase/migrations/${GROWTH_INBOX_SYNC_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.inbox_sync_runs/)
  assert.match(migration, /growth\.inbox_provider_message_map/)
  assert.match(migration, /growth\.inbox_thread_links/)
  assert.match(migration, /inbox_sync_started/)
  assert.match(migration, /inbox_reply_imported/)
  assert.match(migration, /service role only/)

  const normalized = normalizeProviderMessage(
    {
      provider_message_id: "msg-1",
      provider_thread_id: "thread-1",
      from_email: "Prospect@Example.com",
      subject: "Re: Pricing",
      body_preview: "Can you share pricing?",
    },
    "mailbox-1",
  )
  assert.equal(normalized.fromEmail, "prospect@example.com")
  assert.ok(normalized.messageHash)
  assert.equal(buildMessagePreview("  hello   world  "), "hello world")
  assert.ok(hashEmailAddress("a@b.com"))
  assert.equal(subjectSimilarityScore("Re: Demo", "Demo"), 1)

  const dedupeState = createInboxDedupeState()
  dedupeState.existingProviderMessageIds.add("google:msg-1")
  const dup = shouldSkipInboxDuplicate(
    {
      providerFamily: "google",
      providerMessageId: "msg-1",
      messageHash: "hash",
      mailboxConnectionId: "mailbox-1",
      fromEmail: "a@b.com",
      messageTimestamp: new Date().toISOString(),
      bodyPreview: "Hi",
    },
    dedupeState,
  )
  assert.equal(dup.skip, true)
  assert.equal(dup.reason, "provider_message_id")

  const context = {
    providerThreadMap: new Map([["thread-1", "inbox-thread-1"]]),
    providerMessageMap: new Map(),
    deliveryAttemptByReference: new Map([
      ["transport-1", { attemptId: "attempt-1", leadId: "lead-1", enrollmentId: "enroll-1" }],
    ]),
    deliveryAttemptByThreadId: new Map([
      ["gmail-thread-outbound-1", { attemptId: "attempt-2", leadId: "lead-3", enrollmentId: "enroll-3" }],
    ]),
    leadIdByEmailHash: new Map([[hashEmailAddress("buyer@acme.com"), "lead-2"]]),
    threadSubjectById: new Map([["inbox-thread-2", "Demo request"]]),
    threadLeadById: new Map([
      ["inbox-thread-1", "lead-1"],
      ["inbox-thread-2", "lead-2"],
    ]),
    activeEnrollmentByLeadId: new Map([["lead-1", "enroll-1"]]),
  }

  assert.deepEqual(resolveThreadMatchOrder(), [
    "provider_thread_id",
    "delivery_thread_id",
    "provider_message_id",
    "message_reference",
    "email_hash",
    "subject_similarity",
    "unknown",
  ])

  const threadMatch = resolveThreadMatchFromContext(
    {
      providerThreadId: "thread-1",
      providerMessageId: "msg-2",
      inReplyTo: null,
      references: [],
      fromEmail: "prospect@example.com",
      fromEmailHash: hashEmailAddress("prospect@example.com"),
      subject: "Re: follow up",
    },
    context,
  )
  assert.equal(threadMatch.matchedBy, "provider_thread_id")
  assert.equal(threadMatch.confidence, GROWTH_INBOX_THREAD_MATCH_CONFIDENCE.provider_thread)

  const referenceMatch = resolveThreadMatchFromContext(
    {
      providerThreadId: null,
      providerMessageId: "msg-3",
      inReplyTo: "transport-1",
      references: [],
      fromEmail: "prospect@example.com",
      fromEmailHash: hashEmailAddress("prospect@example.com"),
      subject: "Re: follow up",
    },
    context,
  )
  assert.equal(referenceMatch.matchedBy, "message_reference")
  assert.equal(referenceMatch.deliveryAttemptId, "attempt-1")

  const deliveryThreadMatch = resolveThreadMatchFromContext(
    {
      providerThreadId: "gmail-thread-outbound-1",
      providerMessageId: "msg-4",
      inReplyTo: null,
      references: [],
      fromEmail: "prospect@example.com",
      fromEmailHash: hashEmailAddress("prospect@example.com"),
      subject: "Re: follow up",
    },
    context,
  )
  assert.equal(deliveryThreadMatch.matchedBy, "delivery_thread_id")
  assert.equal(deliveryThreadMatch.leadId, "lead-3")
  assert.equal(deliveryThreadMatch.deliveryAttemptId, "attempt-2")

  assert.equal(maskInboxSyncEmail("prospect@example.com"), "pr…@example.com")

  const runnerSource = readSource("lib/growth/inbox-sync/inbox-sync-runner.ts")
  assert.match(runnerSource, /addInboxMessage/)
  assert.match(runnerSource, /reply_received/)
  assert.match(runnerSource, /ingestGrowthReplyFromInboxSync/)
  assert.match(runnerSource, /finalizeIngestedReplyIntelligence/)
  assert.match(runnerSource, /pauseSequenceEnrollmentOnInboundReply/)
  assert.doesNotMatch(runnerSource, /autoReply|sendMail|executeTransportSend/)

  const bridgeSource = readSource("lib/growth/replies/finalize-ingested-reply-intelligence.ts")
  assert.match(bridgeSource, /processReplyIntelligence/)
  assert.match(bridgeSource, /recomputeGrowthLeadWorkflowSignals/)

  const googleAdapterSource = readSource("lib/growth/inbox-sync/provider-sync-adapters/google-inbox-sync-adapter.ts")
  assert.match(googleAdapterSource, /gmailApiFetch/)
  assert.match(googleAdapterSource, /in:inbox/)

  const gmailApiSource = readSource("lib/growth/inbox-sync/gmail-api-utils.ts")
  assert.match(gmailApiSource, /gmail\.googleapis\.com/)

  const oauthSource = readSource("lib/growth/provider-setup/google-oauth.ts")
  assert.match(oauthSource, /gmail\.readonly/)

  const cronSource = readSource("app/api/cron/growth-inbox-sync/route.ts")
  assert.match(cronSource, /runGrowthCronJob/)
  assert.match(cronSource, /runInboxSyncForEnabledMailboxes/)
  assert.doesNotMatch(cronSource, /sendMail|autoReply|executeTransportSend/)

  const runRouteSource = readSource("app/api/platform/growth/inbox/sync/run/route.ts")
  assert.match(runRouteSource, /requireGrowthEnginePlatformAccess/)

  const uiSource = readSource("components/growth/growth-unified-inbox-dashboard.tsx")
  assert.match(uiSource, /Sync Health/)
  assert.match(uiSource, /Sync Runs/)
  assert.match(uiSource, /Thread continuity/)
  assert.match(uiSource, /Coming Soon/)
  assert.doesNotMatch(uiSource, /api_key|secret|password/i)

  assert.equal(classifyReply({ body: "What is pricing?" }).classification, "budget")

  assert.equal(normalizeRfcMessageId("<abc@gmail.com>"), "abc@gmail.com")
  assert.deepEqual(parseReferencesHeader("<one@test.com> <two@test.com>"), ["one@test.com", "two@test.com"])
  assert.equal(parseEmailAddress("Jane Doe <jane@acme.com>"), "jane@acme.com")

  const validActorUuid = "43b6b778-8a1e-4c6b-9163-148fde7becad"
  assert.equal(normalizeGrowthActorUserIdForDb(undefined), null)
  assert.equal(normalizeGrowthActorUserIdForDb(null), null)
  assert.equal(normalizeGrowthActorUserIdForDb("system"), null)
  assert.equal(normalizeGrowthActorUserIdForDb(validActorUuid), validActorUuid)
  assert.ok(isGrowthActorUserIdUuid(validActorUuid))
  assert.equal(normalizeGrowthActorUserIdForDb("not-a-uuid"), null)

  assert.deepEqual(resolveGrowthActorForDb(undefined), {
    actorUserId: null,
    actorEmail: GROWTH_CRON_ACTOR_EMAIL,
  })
  assert.deepEqual(resolveGrowthActorForDb({ actorUserId: null }), {
    actorUserId: null,
    actorEmail: GROWTH_CRON_ACTOR_EMAIL,
  })
  assert.deepEqual(resolveGrowthActorForDb({ actorUserId: "system", actorEmail: "cron@test.internal" }), {
    actorUserId: null,
    actorEmail: "cron@test.internal",
  })
  assert.deepEqual(
    resolveGrowthActorForDb({ actorUserId: validActorUuid, actorEmail: "qa@equipify.ai" }),
    { actorUserId: validActorUuid, actorEmail: "qa@equipify.ai" },
  )

  assert.doesNotMatch(runnerSource, /\?\?\s*"system"/)
  assert.doesNotMatch(runnerSource, /actorUserId:\s*"system"/)

  const replyEventsSource = readSource("lib/growth/inbox/reply-events.ts")
  assert.match(replyEventsSource, /normalizeGrowthActorUserIdForDb/)
  assert.match(replyEventsSource, /resolveGrowthActorForDb/)

  const timelineSource = readSource("lib/growth/timeline-repository.ts")
  assert.match(timelineSource, /normalizeGrowthActorUserIdForDb/)

  assert.doesNotMatch(cronSource, /actingUserId/)
  assert.match(cronSource, /actorEmail:\s*"cron@growth\.equipify\.internal"/)

  console.log("growth-inbox-sync: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
