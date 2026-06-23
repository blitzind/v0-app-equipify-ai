/**
 * GS-GROWTH-WARMUP-EXECUTOR-1D — profile binding + preview send planning regression.
 * Run: pnpm test:growth-warmup-executor-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  describeWarmupExecutorProfileDiagnostic,
  summarizeWarmupExecutorRun,
} from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER,
  previewWarmupSendExecutor,
  runWarmupSendExecutor,
} from "../lib/growth/warmup/warmup-send-executor"
import { selectWarmupRecipientForSend } from "../lib/growth/warmup/warmup-recipient-selector"
import type { GrowthWarmupRecipient } from "../lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function extractExecuteWarmupSendForProfileBody(source: string): string {
  const start = source.indexOf("async function executeWarmupSendForProfile(")
  const end = source.indexOf("async function recordAttempt(")
  assert.ok(start >= 0 && end > start, "executeWarmupSendForProfile not found")
  return source.slice(start, end)
}

function mockRecipient(overrides: Partial<GrowthWarmupRecipient> = {}): GrowthWarmupRecipient {
  return {
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
    ...overrides,
  }
}

function mockProfileRow(input: {
  id: string
  senderAccountId: string
  status?: string
}): Record<string, unknown> {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: input.id,
    sender_account_id: input.senderAccountId,
    status: input.status ?? "warming",
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
        if (countHead) return []

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

function buildMockDb(profileCount: number): MockWarmupDb {
  const profiles = Array.from({ length: profileCount }, (_, index) =>
    mockProfileRow({
      id: `profile-${index + 1}`,
      senderAccountId: `sender-${index + 1}`,
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
  }
}

async function runTests(): Promise<void> {
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1D ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER, "growth-warmup-executor-1d-v1")
  console.log("  ✓ 1D QA marker")

  const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
  const executeBody = extractExecuteWarmupSendForProfileBody(executorSource)

  assert.match(
    executeBody,
    /const \{ profile, runId, previewOnly, actorUserId, actorEmail, excludeRecipientEmails, runRecipientEmailsUsed \} =/,
  )
  assert.match(executeBody, /profile\.sends_today_date/)
  console.log("  ✓ executeWarmupSendForProfile binds profile from input (ReferenceError fix)")

  assert.match(executorSource, /warmup_executor_send_plan/)
  assert.match(executorSource, /profile_ids:/)
  assert.match(executorSource, /remaining_sends:/)
  assert.match(executorSource, /stack,/)
  console.log("  ✓ Send planning instrumentation logs profile context and stack traces")

  const warmingProfile = mockProfileRow({ id: "p1", senderAccountId: "sender-1" }) as unknown as GrowthWarmupProfile
  warmingProfile.sender_email = "sender@equipify.ai"
  warmingProfile.schedule = [
    {
      id: "s1",
      warmup_profile_id: "p1",
      day_number: 1,
      planned_volume: 5,
      actual_volume: 0,
      completed: false,
      completed_at: null,
      created_at: new Date().toISOString(),
    },
  ]

  const eligibleDiag = describeWarmupExecutorProfileDiagnostic({
    profile: warmingProfile,
    remainingCapacity: 5,
    approvedRecipientCount: 1,
  })
  assert.equal(eligibleDiag.eligibility, "eligible")
  const summary = summarizeWarmupExecutorRun({
    allProfiles: [warmingProfile],
    scannableProfiles: [warmingProfile],
    diagnostics: [eligibleDiag],
    approvedRecipientCount: 1,
  })
  assert.equal(summary.eligibleProfiles, 1)
  assert.match(summary.primaryMessage, /1 profile\(s\) eligible/)
  console.log("  ✓ Diagnostics generation reports eligible profiles")

  const recipientSelection = await selectWarmupRecipientForSend(createWarmupExecutorMockAdmin(buildMockDb(1)), {
    recipients: [mockRecipient()],
    senderAccountId: "sender-1",
  })
  assert.equal(recipientSelection.ok, true)
  console.log("  ✓ Recipient selection returns approved recipient")

  const singlePreview = await previewWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(1)))
  assert.equal(singlePreview.previewOnly, true)
  assert.equal(singlePreview.sendsSucceeded, 1)
  assert.equal(singlePreview.senderResults.length, 1)
  assert.equal(singlePreview.senderResults[0]?.sent, 1)
  assert.equal(singlePreview.runSummary?.eligibleProfiles, 1)
  assert.ok(
    !singlePreview.skipReasons.some((skip) => skip.message.includes("profile is not defined")),
    "preview must not surface profile ReferenceError",
  )
  console.log("  ✓ Preview with 1 warming profile plans 1 send")

  const multiPreview = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(3)), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(multiPreview.sendsSucceeded, 3)
  assert.equal(multiPreview.senderResults.length, 3)
  assert.equal(multiPreview.runSummary?.eligibleProfiles, 3)
  assert.match(multiPreview.runSummary?.primaryMessage ?? "", /3 profile\(s\) eligible/)
  console.log("  ✓ Preview with multiple profiles plans one send per eligible profile")

  const cappedPreview = await runWarmupSendExecutor(createWarmupExecutorMockAdmin(buildMockDb(6)), {
    runKind: "manual",
    previewOnly: true,
    enforceSendingWindow: false,
  })
  assert.equal(cappedPreview.runSummary?.eligibleProfiles, 6)
  assert.equal(cappedPreview.sendsSucceeded, 6, "per-profile pacing plans one send per eligible mailbox")
  assert.equal(cappedPreview.runSummary?.plannedSendsThisRun, 6)
  assert.ok(!cappedPreview.skipReasons.some((skip) => skip.code === "batch_limit_reached"))
  console.log("  ✓ Preview with 6 profiles plans one send per eligible profile")

  assert.doesNotMatch(executorSource, /profiles\.map\(\(\) => \{[\s\S]*profile\.id/)
  console.log("  ✓ No anonymous map callbacks reference unbound profile variable")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1D passed.\n")
}

void runTests()
