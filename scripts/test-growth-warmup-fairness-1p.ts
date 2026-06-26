/**
 * GS-GROWTH-WARMUP-FAIRNESS-1P — profile starvation + skip observability regression.
 * Run: pnpm test:growth-warmup-fairness-1p
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  compareWarmupSendCandidateProfiles,
  GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER,
  mergeWarmupExecutorRunSkipReasons,
  sortWarmupSendCandidateProfiles,
  WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY,
} from "../lib/growth/warmup/warmup-executor-fairness"
import { computeWarmupExecutorRunSendPlan } from "../lib/growth/warmup/warmup-executor-diagnostics"
import { runWarmupSendExecutor } from "../lib/growth/warmup/warmup-send-executor"
import { selectWarmupRecipientForSend } from "../lib/growth/warmup/warmup-recipient-selector"
import type { GrowthWarmupRecipient } from "../lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockProfile(input: {
  id: string
  senderAccountId: string
  senderEmail: string
  sendsToday?: number
  createdAt?: string
  updatedAt?: string
}): GrowthWarmupProfile {
  const today = new Date().toISOString().slice(0, 10)
  const createdAt = input.createdAt ?? new Date().toISOString()
  return {
    id: input.id,
    sender_account_id: input.senderAccountId,
    sender_email: input.senderEmail,
    sender_display_name: input.senderEmail,
    status: "warming",
    target_daily_volume: 75,
    current_daily_volume: 8,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 100,
    warmup_health: "healthy",
    started_at: createdAt,
    completed_at: null,
    last_progress_at: null,
    current_warmup_day: 2,
    sends_today: input.sendsToday ?? 0,
    sends_today_date: today,
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: createdAt,
    updated_at: input.updatedAt ?? createdAt,
    deleted_at: null,
    schedule: [],
  }
}

function mockProfileRow(input: {
  id: string
  senderAccountId: string
  senderEmail: string
  sendsToday?: number
  createdAt?: string
  updatedAt?: string
}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10)
  const createdAt = input.createdAt ?? new Date().toISOString()
  return {
    id: input.id,
    sender_account_id: input.senderAccountId,
    status: "warming",
    target_daily_volume: 75,
    current_daily_volume: 8,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 100,
    warmup_health: "healthy",
    started_at: createdAt,
    completed_at: null,
    last_progress_at: null,
    current_warmup_day: 2,
    sends_today: input.sendsToday ?? 0,
    sends_today_date: today,
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: createdAt,
    updated_at: input.updatedAt ?? createdAt,
    deleted_at: null,
  }
}

type MockWarmupDb = {
  profiles: Record<string, unknown>[]
  schedules: Record<string, unknown>[]
  recipients: Record<string, unknown>[]
  senders: Record<string, Record<string, unknown>>
  recipientSendCounts: Record<string, { daily: number; weekly: number }>
  profileRecipientEmails: Record<string, string[]>
  sendAttempts: Record<string, unknown>[]
}

function buildMockDb(input: {
  profileCount: number
  recipientCount?: number
  sendsTodayByProfile?: Record<string, number>
  lastSendAtBySender?: Record<string, string | null>
}): MockWarmupDb {
  const profiles = Array.from({ length: input.profileCount }, (_, index) => {
    const id = `profile-${index + 1}`
    const senderAccountId = `sender-${index + 1}`
    return mockProfileRow({
      id,
      senderAccountId,
      senderEmail: `sender${index + 1}@example.com`,
      sendsToday: input.sendsTodayByProfile?.[id] ?? 0,
      createdAt: new Date(Date.UTC(2026, 5, 22, 10, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 5, 22, 11, index)).toISOString(),
    })
  })

  const senders = Object.fromEntries(
    profiles.map((profile) => {
      const senderId = String(profile.sender_account_id)
      return [
        senderId,
        {
          id: senderId,
          email_address: `${senderId}@example.com`,
          display_name: "Warmup Sender",
          status: "connected",
          health_status: "warming",
          last_send_at: input.lastSendAtBySender?.[senderId] ?? null,
        },
      ]
    }),
  )

  const recipientCount = input.recipientCount ?? 4
  const recipients = Array.from({ length: recipientCount }, (_, index) => ({
    id: `recipient-${index + 1}`,
    email: `recipient${index + 1}@example.com`,
    name: `Recipient ${index + 1}`,
    label: "",
    recipient_type: "internal",
    active: true,
    approved: true,
    max_emails_per_day: 20,
    max_emails_per_week: 140,
    last_sent_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  }))

  return {
    profiles,
    schedules: profiles.map((profile) => ({
      id: `schedule-${profile.id}`,
      warmup_profile_id: profile.id,
      day_number: 2,
      planned_volume: 8,
      actual_volume: 0,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    })),
    recipients,
    senders,
    recipientSendCounts: {},
    profileRecipientEmails: {},
    sendAttempts: [],
  }
}

function createWarmupExecutorMockAdmin(db: MockWarmupDb): SupabaseClient {
  type Filter = { type: "eq" | "is" | "gte" | "in"; column: string; value: unknown }

  function applyFilters(rows: Record<string, unknown>[], filters: Filter[]): Record<string, unknown>[] {
    return rows.filter((row) =>
      filters.every((filter) => {
        if (filter.type === "is") {
          return filter.value === null ? row[filter.column] == null : row[filter.column] === filter.value
        }
        if (filter.type === "gte") {
          return String(row[filter.column] ?? "") >= String(filter.value)
        }
        if (filter.type === "in") {
          return Array.isArray(filter.value) && filter.value.includes(row[filter.column])
        }
        return row[filter.column] === filter.value
      }),
    )
  }

  function makeBuilder(table: string) {
    let filters: Filter[] = []
    let countHead = false
    let limitN: number | null = null
    let orderSpec: { column: string; ascending: boolean } | null = null
    let pendingInsert: Record<string, unknown> | null = null

    const builder = {
      select: (_columns?: string, opts?: { count?: string; head?: boolean }) => {
        countHead = Boolean(opts?.count && opts?.head)
        return builder
      },
      eq: (column: string, value: unknown) => {
        filters.push({ type: "eq", column, value })
        return builder
      },
      is: (column: string, value: unknown) => {
        filters.push({ type: "is", column, value })
        return builder
      },
      in: (column: string, value: unknown) => {
        filters.push({ type: "in", column, value })
        return builder
      },
      gte: (column: string, value: unknown) => {
        filters.push({ type: "gte", column, value })
        return builder
      },
      order: (column: string, opts?: { ascending?: boolean }) => {
        orderSpec = { column, ascending: opts?.ascending ?? true }
        return builder
      },
      limit: (n: number) => {
        limitN = n
        return builder
      },
      maybeSingle: async () => {
        const rows = await builder.resolveRows()
        return { data: rows[0] ?? null, error: null }
      },
      single: async () => {
        const rows = await builder.resolveRows()
        if (!rows[0]) return { data: null, error: { message: "not found" } }
        return { data: rows[0], error: null }
      },
      insert: (payload: Record<string, unknown> | Record<string, unknown>[]) => {
        pendingInsert = Array.isArray(payload) ? payload[0] : payload
        return {
          select: () => ({
            single: async () => {
              if (table === "warmup_send_attempts" && pendingInsert) {
                db.sendAttempts.push({ ...pendingInsert, id: `attempt-${db.sendAttempts.length + 1}` })
              }
              if (table === "warmup_send_runs") {
                return { data: { id: "run-test-1" }, error: null }
              }
              return { data: { id: "insert-1" }, error: null }
            },
          }),
        }
      },
      update: () => ({
        eq: async () => ({ error: null }),
      }),
      resolveRows: async (): Promise<Record<string, unknown>[]> => {
        if (countHead) {
          if (table === "warmup_send_attempts") {
            const profileId = filters.find((f) => f.column === "warmup_profile_id")?.value
            if (profileId) {
              const emails = db.profileRecipientEmails[String(profileId)] ?? []
              return emails.map((email) => ({ recipient_email: email }))
            }
            const recipientId = filters.find((f) => f.column === "warmup_recipient_id")?.value
            const counts = recipientId ? db.recipientSendCounts[String(recipientId)] : undefined
            void counts
          }
          return []
        }

        let rows: Record<string, unknown>[] = []
        if (table === "warmup_profiles") rows = [...db.profiles]
        if (table === "warmup_schedule") rows = [...db.schedules]
        if (table === "warmup_recipients") rows = [...db.recipients]
        if (table === "sender_accounts") rows = Object.values(db.senders)
        if (table === "warmup_send_attempts") {
          const profileId = filters.find((f) => f.column === "warmup_profile_id")?.value
          if (profileId) {
            const emails = db.profileRecipientEmails[String(profileId)] ?? []
            rows = emails.map((email) => ({
              recipient_email: email,
              warmup_profile_id: profileId,
              status: "sent",
              created_at: new Date().toISOString(),
            }))
          } else {
            rows = [...db.sendAttempts]
          }
        }

        rows = applyFilters(rows, filters)
        if (orderSpec) {
          rows.sort((a, b) => {
            const av = a[orderSpec!.column]
            const bv = b[orderSpec!.column]
            if (av === bv) return 0
            return av! > bv! ? (orderSpec!.ascending ? 1 : -1) : orderSpec!.ascending ? -1 : 1
          })
        }
        if (limitN != null) rows = rows.slice(0, limitN)
        return rows
      },
      then: (
        onFulfilled?: (value: { data: unknown; error: null; count?: number }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => {
        if (countHead && table === "warmup_send_attempts") {
          const recipientId = filters.find((f) => f.column === "warmup_recipient_id")?.value
          const counts = recipientId ? db.recipientSendCounts[String(recipientId)] : undefined
          const gteFilter = filters.find((f) => f.type === "gte")
          const count =
            gteFilter && String(gteFilter.value).includes("T")
              ? counts?.daily ?? 0
              : counts?.weekly ?? 0
          return Promise.resolve({ data: null, error: null, count }).then(onFulfilled, onRejected)
        }
        if (countHead) {
          return Promise.resolve({ data: null, error: null, count: 0 }).then(onFulfilled, onRejected)
        }
        return builder.resolveRows().then((rows) => Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected))
      },
    }

    return builder
  }

  return {
    schema: () => ({
      from: (table: string) => makeBuilder(table),
    }),
  } as unknown as SupabaseClient
}

async function runTests(): Promise<void> {
  console.log("\n=== GS-GROWTH-WARMUP-FAIRNESS-1P ===\n")

  assert.equal(GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER, "growth-warmup-fairness-1p-v1")
  assert.equal(WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY, "per_sender_daily")
  console.log("  ✓ Fairness QA marker + dedup policy")

  const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
  assert.match(executorSource, /sortWarmupSendCandidateProfiles/)
  assert.doesNotMatch(executorSource, /recipientsUsedThisRun/)
  assert.doesNotMatch(executorSource, /excludeRecipientEmails/)
  assert.match(executorSource, /mergeWarmupExecutorRunSkipReasons/)
  assert.match(executorSource, /fairness_qa_marker: GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER/)
  console.log("  ✓ Executor uses fairness ordering and per-sender recipient dedup")

  const panelSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
  assert.match(panelSource, /poolPressureMessage/)
  assert.match(panelSource, /waitingProfilesThisRun/)
  console.log("  ✓ Dashboard shows recipient pool pressure")

  const starved = mockProfile({
    id: "profile-starved",
    senderAccountId: "sender-starved",
    senderEmail: "mike@equipifyai.com",
    sendsToday: 0,
    createdAt: "2026-06-22T17:31:39.000Z",
  })
  const fed = mockProfile({
    id: "profile-fed",
    senderAccountId: "sender-fed",
    senderEmail: "mike@goequipify.com",
    sendsToday: 6,
    createdAt: "2026-06-22T18:16:26.000Z",
  })
  const sorted = sortWarmupSendCandidateProfiles([fed, starved], {
    senderLastSendAt: new Map([
      ["sender-starved", null],
      ["sender-fed", "2026-06-24T20:00:00.000Z"],
    ]),
  })
  assert.equal(sorted[0]?.id, "profile-starved")
  assert.equal(sorted[1]?.id, "profile-fed")
  assert.ok(compareWarmupSendCandidateProfiles(starved, fed, { senderLastSendAt: new Map() }) < 0)
  console.log("  ✓ Profiles with sends_today = 0 sort before sends_today = 6")

  const sixFourDb = buildMockDb({ profileCount: 6, recipientCount: 4 })
  const sixFourPreview = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(sixFourDb), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(sixFourPreview.runSummary?.plannedSendsThisRun, 6)
  assert.equal(sixFourPreview.sendsSucceeded, 6)
  assert.equal(sixFourPreview.sendsSkipped, 0)
  assert.match(
    sixFourPreview.runSummary?.poolPressureMessage ?? "",
    /4 approved recipient\(s\) available for 6 eligible sender\(s\)/,
  )
  console.log("  ✓ 6 profiles + 4 recipients plans 6 sends (no permanent starvation)")

  const cappedDb = buildMockDb({ profileCount: 1, recipientCount: 1 })
  cappedDb.recipientSendCounts["recipient-1"] = { daily: 20, weekly: 140 }
  cappedDb.recipients[0] = {
    ...cappedDb.recipients[0],
    max_emails_per_day: 20,
    max_emails_per_week: 140,
  }
  const cappedPreview = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(cappedDb), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(cappedPreview.sendsSucceeded, 0)
  assert.ok(cappedPreview.sendsSkipped >= 1)
  console.log("  ✓ Recipient caps still block sends when exhausted")

  const skipDb = buildMockDb({ profileCount: 1, recipientCount: 1 })
  skipDb.recipientSendCounts["recipient-1"] = { daily: 20, weekly: 140 }
  skipDb.recipients[0] = {
    ...skipDb.recipients[0],
    max_emails_per_day: 20,
    max_emails_per_week: 140,
  }
  const skipRun = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(skipDb), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(skipRun.sendsSkipped, 1)
  assert.equal(skipRun.sendsAttempted, 1)
  assert.ok(skipRun.senderResults[0]?.skipReasons.some((row) => row.code === "recipient_daily_cap"))
  assert.ok(
    skipRun.skipReasons.some(
      (row) => row.code === "recipient_daily_cap" && row.count === 1 && row.profiles?.length === 1,
    ),
  )
  assert.match(
    executorSource,
    /if \(!selection\.ok\) \{[\s\S]*base\.attempted = 1[\s\S]*recordAttempt\(admin, \{/,
  )
  console.log("  ✓ Recipient selection failure marks attempted/skipped and records audit row in executor")

  const noRecipientDb = buildMockDb({ profileCount: 1, recipientCount: 0 })
  const noRecipientRun = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(noRecipientDb), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(noRecipientRun.sendsSkipped, 1)
  assert.ok(
    noRecipientRun.senderResults[0]?.skipReasons.some((row) => row.code === "no_approved_recipients"),
  )
  console.log("  ✓ no_approved_recipients skip reason surfaced on profile result")

  const merged = mergeWarmupExecutorRunSkipReasons([], [
    {
      senderAccountId: "sender-a",
      senderEmail: "mike@getequipify.com",
      profileId: "profile-a",
      plannedToday: 8,
      sendsToday: 0,
      executorSendsToday: 0,
      remainingCapacity: 8,
      attempted: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
      skipReasons: [{ code: "no_approved_recipients", message: "No active approved warmup recipients available." }],
    },
    {
      senderAccountId: "sender-b",
      senderEmail: "mike@equipifyai.com",
      profileId: "profile-b",
      plannedToday: 8,
      sendsToday: 0,
      executorSendsToday: 0,
      remainingCapacity: 8,
      attempted: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
      skipReasons: [{ code: "no_approved_recipients", message: "No active approved warmup recipients available." }],
    },
  ])
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.count, 2)
  assert.deepEqual(merged[0]?.profiles, ["mike@getequipify.com", "mike@equipifyai.com"])
  console.log("  ✓ Run-level skip_reasons aggregates profile emails")

  const plan = computeWarmupExecutorRunSendPlan({ eligibleProfileCount: 6, maxSendsOverride: 4 })
  assert.equal(plan.plannedSendsThisRun, 4)
  assert.equal(plan.waitingProfilesThisRun, 2)
  console.log("  ✓ Plan math exposes waiting profiles when batch cap applies")

  const recipient: GrowthWarmupRecipient = {
    id: "recipient-1",
    email: "shared@example.com",
    name: "Shared",
    label: "",
    recipient_type: "internal",
    active: true,
    approved: true,
    max_emails_per_day: 20,
    max_emails_per_week: 140,
    last_sent_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const dedupDb = buildMockDb({ profileCount: 2, recipientCount: 1 })
  dedupDb.profileRecipientEmails["profile-1"] = ["shared@example.com"]
  const blockedForSameSender = await selectWarmupRecipientForSend(createWarmupExecutorMockAdmin(dedupDb), {
    recipients: [recipient],
    senderAccountId: "sender-1",
    profileId: "profile-1",
  })
  assert.equal(blockedForSameSender.ok, false)
  if (!blockedForSameSender.ok) {
    assert.equal(blockedForSameSender.code, "per_sender_dedup_exhausted")
  }
  const allowedForDifferentSender = await selectWarmupRecipientForSend(createWarmupExecutorMockAdmin(dedupDb), {
    recipients: [recipient],
    senderAccountId: "sender-2",
    profileId: "profile-2",
  })
  assert.equal(allowedForDifferentSender.ok, true)
  console.log("  ✓ Per-sender/recipient daily dedup preserved")

  console.log("\nGS-GROWTH-WARMUP-FAIRNESS-1P passed.\n")
}

void runTests()
