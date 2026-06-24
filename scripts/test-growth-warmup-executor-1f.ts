/**
 * GS-GROWTH-WARMUP-EXECUTOR-1F — daily target pacing (no one-send-per-day cap) regression.
 * Run: pnpm test:growth-warmup-executor-1f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  describeWarmupExecutorProfileDiagnostic,
  buildWarmupExecutorPacingMessage,
  GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER,
} from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER as EXECUTOR_1F_MARKER,
  previewWarmupSendExecutor,
  runWarmupSendExecutor,
} from "../lib/growth/warmup/warmup-send-executor"
import { selectWarmupRecipientForSend } from "../lib/growth/warmup/warmup-recipient-selector"
import type { GrowthWarmupRecipient } from "../lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockProfile(overrides: Partial<GrowthWarmupProfile> = {}): GrowthWarmupProfile {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    sender_email: "sender@equipify.ai",
    sender_display_name: "Sender",
    status: "warming",
    target_daily_volume: 50,
    current_daily_volume: 5,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 100,
    warmup_health: "healthy",
    started_at: new Date().toISOString(),
    completed_at: null,
    last_progress_at: null,
    current_warmup_day: 1,
    sends_today: 0,
    sends_today_date: today,
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    schedule: [{ id: "sched-1", day_number: 1, planned_volume: 5, actual_volume: 0, completed: false, completed_at: null }],
    ...overrides,
  }
}

function mockProfileRow(input: {
  id: string
  senderAccountId: string
  sendsToday?: number
}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: input.id,
    sender_account_id: input.senderAccountId,
    status: "warming",
    target_daily_volume: 50,
    current_daily_volume: 5,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 100,
    warmup_health: "healthy",
    started_at: new Date().toISOString(),
    completed_at: null,
    last_progress_at: null,
    current_warmup_day: 1,
    sends_today: input.sendsToday ?? 0,
    sends_today_date: today,
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
  sendRuns: Array<{ idempotency_key: string }>
}

function buildMockDb(profileCount: number, input?: { sendsToday?: number }): MockWarmupDb {
  const profiles = Array.from({ length: profileCount }, (_, index) =>
    mockProfileRow({
      id: `profile-${index + 1}`,
      senderAccountId: `sender-${index + 1}`,
      sendsToday: input?.sendsToday ?? 0,
    }),
  )
  const schedules = profiles.map((profile) => ({
    id: `schedule-${profile.id}`,
    warmup_profile_id: profile.id,
    day_number: 1,
    planned_volume: 5,
    actual_volume: 0,
    completed: false,
    completed_at: null,
    created_at: new Date().toISOString(),
  }))
  const senders = Object.fromEntries(
    profiles.map((profile) => [
      String(profile.sender_account_id),
      {
        id: String(profile.sender_account_id),
        email_address: `${String(profile.sender_account_id)}@equipify.ai`,
        display_name: "Warmup Sender",
        status: "connected",
        health_status: "healthy",
        daily_send_limit: 1,
        daily_send_used: input?.sendsToday ?? 0,
        deleted_at: null,
      },
    ]),
  )
  const recipients = Array.from({ length: Math.max(3, profileCount) }, (_, index) => ({
    id: `recipient-${index + 1}`,
    email: `warmup.partner${index + 1}@example.com`,
    display_name: `Warmup Partner ${index + 1}`,
    active: true,
    approved: true,
    max_emails_per_day: 10,
    max_emails_per_week: 50,
    last_sent_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  }))
  return {
    profiles,
    schedules,
    recipients,
    senders,
    recipientSendCounts: {},
    profileRecipientEmails: {},
    sendRuns: [],
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
    let insertPayload: Record<string, unknown> | null = null

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
        insertPayload = Array.isArray(payload) ? payload[0] : payload
        return {
          select: () => ({
            single: async () => {
              if (table === "warmup_send_runs" && insertPayload?.idempotency_key) {
                db.sendRuns.push({ idempotency_key: String(insertPayload.idempotency_key) })
              }
              return { data: { id: "run-test-1" }, error: null }
            },
          }),
        }
      },
      update: () => ({
        eq: async () => ({ error: null }),
      }),
      resolveRows: async (): Promise<Record<string, unknown>[]> => {
        if (countHead) return []
        let rows: Record<string, unknown>[] = []
        if (table === "warmup_profiles") rows = [...db.profiles]
        if (table === "warmup_schedule") rows = [...db.schedules]
        if (table === "warmup_recipients") rows = [...db.recipients]
        if (table === "sender_accounts") rows = Object.values(db.senders)
        if (table === "warmup_send_runs") {
          rows = db.sendRuns.map((run, index) => ({
            id: `run-${index + 1}`,
            idempotency_key: run.idempotency_key,
            finished_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
          }))
        }
        if (table === "warmup_send_attempts") {
          const profileId = filters.find((f) => f.column === "warmup_profile_id")?.value
          if (profileId) {
            rows = (db.profileRecipientEmails[String(profileId)] ?? []).map((email, index) => ({
              id: `attempt-${index}`,
              recipient_email: email,
              created_at: new Date().toISOString(),
            }))
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
          const profileId = filters.find((f) => f.column === "warmup_profile_id")?.value
          if (profileId) {
            const count = (db.profileRecipientEmails[String(profileId)] ?? []).length
            return Promise.resolve({ data: null, error: null, count }).then(onFulfilled, onRejected)
          }
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
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1F ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER, "growth-warmup-executor-1f-v1")
  assert.equal(EXECUTOR_1F_MARKER, "growth-warmup-executor-1f-v1")
  console.log("  ✓ 1F QA marker")

  const infraSource = readSource("lib/growth/compliance/pre-send-infrastructure-guards.ts")
  const executionSource = readSource("lib/growth/warmup/warmup-execution.ts")
  const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
  assert.match(infraSource, /warmupPacesSenderDailyCap/)
  assert.match(executionSource, /syncSenderWarmupCapacity/)
  assert.doesNotMatch(executionSource, /incrementSenderDailySendUsed/)
  assert.match(executorSource, /getWarmupProfile/)
  assert.match(executorSource, /sortWarmupSendCandidateProfiles/)
  console.log("  ✓ Source guards against stale sender daily cap + reloads profiles between runs")

  for (const sendsToday of [0, 1, 4]) {
    const diag = describeWarmupExecutorProfileDiagnostic({
      profile: mockProfile({ sends_today: sendsToday }),
      remainingCapacity: 5 - sendsToday,
      approvedRecipientCount: 3,
    })
    assert.equal(diag.eligibility, "eligible", `sendsToday=${sendsToday} should stay eligible`)
  }
  const cappedDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({ sends_today: 5 }),
    remainingCapacity: 0,
    approvedRecipientCount: 3,
  })
  assert.equal(cappedDiag.eligibility, "skipped")
  assert.equal(cappedDiag.skipCode, "warmup_cap_exhausted")
  console.log("  ✓ Eligibility uses remaining daily target, not one-send-per-day")

  const afterFirstRunCopy = buildWarmupExecutorPacingMessage({
    eligibleProfiles: 6,
    plannedSendsThisRun: 6,
    representativeRemainingToday: 4,
  })
  assert.match(afterFirstRunCopy, /6 profile\(s\) eligible/)
  assert.match(afterFirstRunCopy, /Each mailbox has 4 remaining today/)
  const afterTargetCopy = buildWarmupExecutorPacingMessage({
    eligibleProfiles: 0,
    plannedSendsThisRun: 0,
  })
  assert.match(afterTargetCopy, /All eligible profiles reached today's warmup target/)
  console.log("  ✓ Preview pacing copy reflects remaining today")

  const pacingDb = buildMockDb(1)
  const pacingAdmin = createWarmupExecutorMockAdmin(pacingDb)
  for (let run = 1; run <= 5; run += 1) {
    const result = await runWarmupSendExecutor(pacingAdmin, {
      runKind: "manual",
      previewOnly: true,
      enforceSendingWindow: false,
    })
    assert.equal(result.sendsSucceeded, 1, `manual run ${run} should plan 1 send`)
    pacingDb.profiles[0].sends_today = run
  }
  const manualAfterTarget = await runWarmupSendExecutor(pacingAdmin, {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(manualAfterTarget.sendsSucceeded, 0)
  assert.equal(manualAfterTarget.runSummary?.eligibleProfiles, 0)
  console.log("  ✓ Repeated manual runs advance 0→5 then stop at daily target")

  const cronDb = buildMockDb(1)
  const cronAdmin = createWarmupExecutorMockAdmin(cronDb)
  for (let hour = 1; hour <= 5; hour += 1) {
    const result = await runWarmupSendExecutor(cronAdmin, {
      runKind: "cron",
      previewOnly: true,
      enforceSendingWindow: false,
    })
    assert.equal(result.sendsSucceeded, 1, `cron hour ${hour} should plan 1 send`)
    cronDb.profiles[0].sends_today = hour
  }
  console.log("  ✓ Cron hourly runs advance 0→5")

  const manualKeys = new Set<string>()
  for (let index = 0; index < 3; index += 1) {
    const result = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(2)), {
      runKind: "manual",
      previewOnly: true,
      enforceSendingWindow: false,
    })
    manualKeys.add(result.idempotencyKey)
  }
  assert.equal(manualKeys.size, 3)
  assert.ok([...manualKeys].every((key) => key.startsWith("warmup-manual:")))
  console.log("  ✓ Manual idempotency keys are unique per run")

  const cronDbIdempotent = buildMockDb(1)
  const cronAdminIdempotent = createWarmupExecutorMockAdmin(cronDbIdempotent)
  const firstCron = await runWarmupSendExecutor(cronAdminIdempotent, {
    runKind: "cron",
    previewOnly: false,
    confirmed: true,
    enforceSendingWindow: false,
  })
  cronDbIdempotent.sendRuns.push({ idempotency_key: firstCron.idempotencyKey })
  const duplicateCron = await runWarmupSendExecutor(cronAdminIdempotent, {
    runKind: "cron",
    previewOnly: false,
    confirmed: true,
    enforceSendingWindow: false,
  })
  assert.equal(duplicateCron.status, "skipped")
  assert.ok(duplicateCron.skipReasons.some((skip) => skip.code === "idempotent_skip"))
  console.log("  ✓ Cron idempotency blocks duplicate same-hour execution only")

  const recipients: GrowthWarmupRecipient[] = [
    {
      id: "recipient-a",
      email: "a@example.com",
      name: "A",
      label: "A",
      recipient_type: "internal",
      active: true,
      approved: true,
      max_emails_per_day: 3,
      max_emails_per_week: 10,
      last_sent_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: "recipient-b",
      email: "b@example.com",
      name: "B",
      label: "B",
      recipient_type: "internal",
      active: true,
      approved: true,
      max_emails_per_day: 3,
      max_emails_per_week: 10,
      last_sent_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]
  const recipientDb = buildMockDb(1)
  recipientDb.recipientSendCounts["recipient-a"] = { daily: 3, weekly: 3 }
  recipientDb.recipients = recipients.map((recipient) => ({
    id: recipient.id,
    email: recipient.email,
    display_name: recipient.name,
    active: true,
    approved: true,
    max_emails_per_day: recipient.max_emails_per_day,
    max_emails_per_week: recipient.max_emails_per_week,
    last_sent_at: null,
    notes: null,
    created_at: recipient.created_at,
    updated_at: recipient.updated_at,
    deleted_at: null,
  }))
  const recipientSelection = await selectWarmupRecipientForSend(createWarmupExecutorMockAdmin(recipientDb), {
    recipients,
    senderAccountId: "sender-1",
    profileId: "profile-1",
  })
  assert.equal(recipientSelection.ok, true)
  if (recipientSelection.ok) {
    assert.equal(recipientSelection.recipient.email, "b@example.com")
  }
  console.log("  ✓ Recipient caps rotate to alternate recipients instead of blocking sender")

  const sixAfterOne = await previewWarmupSendExecutor(
    createWarmupExecutorMockAdmin(buildMockDb(6, { sendsToday: 1 })),
  )
  assert.equal(sixAfterOne.runSummary?.eligibleProfiles, 6)
  assert.equal(sixAfterOne.runSummary?.plannedSendsThisRun, 6)
  assert.match(sixAfterOne.runSummary?.pacingMessage ?? "", /Each mailbox has 4 remaining today/)
  console.log("  ✓ Six profiles with 1/5 sends today remain eligible for next run")

  assert.match(infraSource, /profile_status === "warming"/)
  console.log("  ✓ Pre-send infrastructure defers daily cap to warmup profile for warming mailboxes")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1F passed.\n")
}

void runTests()
