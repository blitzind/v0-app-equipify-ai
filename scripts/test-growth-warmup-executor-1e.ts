/**
 * GS-GROWTH-WARMUP-EXECUTOR-1E — per-mailbox daily target pacing regression.
 * Run: pnpm test:growth-warmup-executor-1e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildWarmupExecutorPacingMessage,
  computeWarmupExecutorRunSendPlan,
  MAX_SENDS_PER_PROFILE_PER_RUN,
} from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_EXECUTOR_1E_QA_MARKER,
  previewWarmupSendExecutor,
  runWarmupSendExecutor,
} from "../lib/growth/warmup/warmup-send-executor"
import { selectWarmupRecipientForSend } from "../lib/growth/warmup/warmup-recipient-selector"
import type { GrowthWarmupRecipient } from "../lib/growth/warmup/warmup-executor-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
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

function mockSenderRow(senderAccountId: string): Record<string, unknown> {
  return {
    id: senderAccountId,
    email_address: `${senderAccountId}@equipify.ai`,
    display_name: "Warmup Sender",
    status: "connected",
    health_status: "healthy",
  }
}

type MockWarmupDb = {
  profiles: Record<string, unknown>[]
  schedules: Record<string, unknown>[]
  recipients: Record<string, unknown>[]
  senders: Record<string, Record<string, unknown>>
  recipientSendCounts: Record<string, { daily: number; weekly: number }>
}

function buildMockDb(profileCount: number, input?: { cappedProfileIndex?: number }): MockWarmupDb {
  const profiles = Array.from({ length: profileCount }, (_, index) =>
    mockProfileRow({
      id: `profile-${index + 1}`,
      senderAccountId: `sender-${index + 1}`,
      sendsToday: input?.cappedProfileIndex === index ? 5 : 0,
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
      mockSenderRow(String(profile.sender_account_id)),
    ]),
  )
  return {
    profiles,
    schedules,
    recipients: [
      {
        id: "recipient-1",
        email: "warmup.partner@example.com",
        display_name: "Warmup Partner",
        active: true,
        approved: true,
        max_emails_per_day: 10,
        max_emails_per_week: 50,
        last_sent_at: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      },
    ],
    senders,
    recipientSendCounts: {},
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
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "run-test-1" }, error: null }),
        }),
      }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
      resolveRows: async (): Promise<Record<string, unknown>[]> => {
        if (countHead) {
          if (table === "warmup_send_attempts") {
            const recipientId = filters.find((f) => f.column === "warmup_recipient_id")?.value
            const counts = recipientId ? db.recipientSendCounts[String(recipientId)] : undefined
            return []
          }
          return []
        }

        let rows: Record<string, unknown>[] = []
        if (table === "warmup_profiles") rows = [...db.profiles]
        if (table === "warmup_schedule") rows = [...db.schedules]
        if (table === "warmup_recipients") rows = [...db.recipients]
        if (table === "sender_accounts") rows = Object.values(db.senders)
        if (table === "warmup_send_attempts") rows = []

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
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1E ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1E_QA_MARKER, "growth-warmup-executor-1e-v1")
  console.log("  ✓ 1E QA marker")

  const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
  const panelSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
  assert.match(executorSource, /MAX_SENDS_PER_PROFILE_PER_RUN/)
  assert.match(executorSource, /computeWarmupExecutorRunSendPlan/)
  assert.doesNotMatch(executorSource, /MAX_SENDS_PER_MANUAL_RUN/)
  assert.match(panelSource, /Next run can send/)
  assert.match(panelSource, /pacingMessage/)
  console.log("  ✓ Executor uses per-profile pacing constants and dashboard copy updated")

  const planSix = computeWarmupExecutorRunSendPlan({ eligibleProfileCount: 6 })
  assert.equal(planSix.maxSendsPerProfile, MAX_SENDS_PER_PROFILE_PER_RUN)
  assert.equal(planSix.plannedSendsThisRun, 6)
  const pacingCopy = buildWarmupExecutorPacingMessage({
    eligibleProfiles: 6,
    plannedSendsThisRun: 6,
    plannedTodayPerMailbox: 5,
  })
  assert.match(pacingCopy, /6 profile\(s\) eligible/)
  assert.match(pacingCopy, /up to 6 warmup message/)
  assert.match(pacingCopy, /1 per eligible mailbox/)
  assert.match(pacingCopy, /Today's target remains 5 per mailbox/)
  console.log("  ✓ Pacing plan + preview copy helpers")

  const sixPreview = await previewWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(6)))
  assert.equal(sixPreview.runSummary?.eligibleProfiles, 6)
  assert.equal(sixPreview.runSummary?.plannedSendsThisRun, 6)
  assert.equal(sixPreview.sendsSucceeded, 6)
  console.log("  ✓ 6 eligible profiles with 5 remaining each → preview plans 6 sends")

  const oneCappedPreview = await runWarmupSendExecutor(
    createWarmupExecutorMockAdmin(buildMockDb(6, { cappedProfileIndex: 0 })),
    { runKind: "manual", previewOnly: true, enforceSendingWindow: false },
  )
  assert.equal(oneCappedPreview.runSummary?.eligibleProfiles, 5)
  assert.equal(oneCappedPreview.runSummary?.plannedSendsThisRun, 5)
  assert.equal(oneCappedPreview.sendsSucceeded, 5)
  console.log("  ✓ 6 profiles with 1 capped → preview plans 5 sends")

  const manualRun = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(4)), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(manualRun.senderResults.length, 4)
  assert.ok(manualRun.senderResults.every((row) => row.sent <= MAX_SENDS_PER_PROFILE_PER_RUN))
  console.log("  ✓ Manual run sends at most 1 per profile")

  const cronRun = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(4)), {
    runKind: "cron",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(cronRun.senderResults.length, 4)
  assert.ok(cronRun.senderResults.every((row) => row.sent <= MAX_SENDS_PER_PROFILE_PER_RUN))
  console.log("  ✓ Cron run sends at most 1 per profile")

  const pacingDb = buildMockDb(1)
  const pacingAdmin = createWarmupExecutorMockAdmin(pacingDb)
  for (let hour = 1; hour <= 5; hour += 1) {
    const result = await runWarmupSendExecutor(pacingAdmin, {
      runKind: "cron",
      previewOnly: true,
      enforceSendingWindow: false,
    })
    assert.equal(result.sendsSucceeded, 1, `hour ${hour} should plan 1 send`)
    pacingDb.profiles[0].sends_today = hour
  }
  const afterTarget = await runWarmupSendExecutor(pacingAdmin, {
    runKind: "cron",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(afterTarget.sendsSucceeded, 0)
  assert.equal(afterTarget.runSummary?.eligibleProfiles, 0)
  assert.ok(afterTarget.senderResults[0]?.skipReasons.some((skip) => skip.code === "warmup_cap_exhausted"))
  console.log("  ✓ Day 1 target of 5 reached after 5 hourly runs; 6th run skips at cap")

  const recipient: GrowthWarmupRecipient = {
    id: "recipient-capped",
    email: "capped@example.com",
    name: "Capped",
    label: "Capped",
    recipient_type: "internal",
    active: true,
    approved: true,
    max_emails_per_day: 1,
    max_emails_per_week: 10,
    last_sent_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const recipientDb = buildMockDb(1)
  recipientDb.recipientSendCounts["recipient-capped"] = { daily: 1, weekly: 1 }
  recipientDb.recipients = [
    {
      id: recipient.id,
      email: recipient.email,
      display_name: recipient.name,
      active: true,
      approved: true,
      max_emails_per_day: 1,
      max_emails_per_week: 10,
      last_sent_at: null,
      notes: null,
      created_at: recipient.created_at,
      updated_at: recipient.updated_at,
      deleted_at: null,
    },
  ]
  const recipientSelection = await selectWarmupRecipientForSend(createWarmupExecutorMockAdmin(recipientDb), {
    recipients: [recipient],
    senderAccountId: "sender-1",
  })
  assert.equal(recipientSelection.ok, false)
  if (!recipientSelection.ok) {
    assert.equal(recipientSelection.code, "recipient_daily_cap")
  }
  console.log("  ✓ Recipient daily caps are respected")

  const safetyPreview = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(6)), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
    maxSends: 3,
  })
  assert.equal(safetyPreview.runSummary?.plannedSendsThisRun, 3)
  assert.equal(safetyPreview.sendsSucceeded, 3)
  assert.ok(safetyPreview.skipReasons.some((skip) => skip.code === "batch_limit_reached"))
  console.log("  ✓ Explicit safety cap limits total sends without changing default per-profile pacing")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1E passed.\n")
}

void runTests()
