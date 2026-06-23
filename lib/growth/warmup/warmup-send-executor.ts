import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { GROWTH_CRON_ACTOR_EMAIL } from "@/lib/growth/actor-user-id"
import { GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER } from "@/lib/growth/warmup/warmup-executor-api-response"
import { assertPreSendAllowed } from "@/lib/growth/compliance/pre-send-assertion"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { createWarmupEvent } from "@/lib/growth/warmup/warmup-events"
import {
  getWarmupProfileForSender,
  resolveWarmupDailyCapacity,
} from "@/lib/growth/warmup/warmup-execution"
import { evaluateWarmupPreSendAllowed } from "@/lib/growth/warmup/warmup-pre-send-guard"
import { listWarmupProfiles } from "@/lib/growth/warmup/warmup-repository"
import { isGrowthWarmupExecutorSchemaReady } from "@/lib/growth/warmup/warmup-executor-schema-health"
import {
  countExecutorSendsForProfileToday,
  getLatestWarmupSendRun,
  listWarmupRecipients,
  updateWarmupRecipient,
} from "@/lib/growth/warmup/warmup-recipient-repository"
import { selectWarmupRecipientForSend } from "@/lib/growth/warmup/warmup-recipient-selector"
import { pickWarmupMessageTemplate } from "@/lib/growth/warmup/warmup-message-templates"
import {
  describeWarmupExecutorProfileDiagnostic,
  isWarmupExecutorScannableProfile,
  isWarmupExecutorSendEligibleStatus,
  summarizeWarmupExecutorRun,
} from "@/lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  isWithinWarmupSendingWindow,
  type GrowthWarmupExecutorRunResult,
  type GrowthWarmupExecutorSenderResult,
  type GrowthWarmupExecutorSkipCode,
  type GrowthWarmupProfileExecutorStats,
  type GrowthWarmupSendRunKind,
  type WarmupExecutorProfileDiagnostic,
} from "@/lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "@/lib/growth/warmup/warmup-types"

export const GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER = "growth-warmup-executor-1d-v1" as const

const MAX_SENDS_PER_CRON_RUN = 1
const MAX_SENDS_PER_MANUAL_RUN = 5

function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function utcDayStartIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

function buildIdempotencyKey(kind: GrowthWarmupSendRunKind, now = new Date()): string {
  if (kind === "cron") {
    return `warmup-cron:${utcDateString(now)}:${now.getUTCHours()}`
  }
  return `warmup-manual:${now.toISOString()}`
}

async function findExistingRun(
  admin: SupabaseClient,
  idempotencyKey: string,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_send_runs")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return null
  if (error) throw new Error(error.message)
  return data ? { id: String((data as Record<string, unknown>).id) } : null
}

async function createSendRun(
  admin: SupabaseClient,
  input: { runKind: GrowthWarmupSendRunKind; idempotencyKey: string; actorEmail?: string | null },
): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("warmup_send_runs")
    .insert({
      run_kind: input.runKind,
      idempotency_key: input.idempotencyKey,
      status: "running",
      actor_email: input.actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  return String((data as Record<string, unknown>).id)
}

async function finalizeSendRun(
  admin: SupabaseClient,
  runId: string,
  result: GrowthWarmupExecutorRunResult,
): Promise<void> {
  await admin
    .schema("growth")
    .from("warmup_send_runs")
    .update({
      status: result.status,
      profiles_scanned: result.profilesScanned,
      sends_attempted: result.sendsAttempted,
      sends_succeeded: result.sendsSucceeded,
      sends_failed: result.sendsFailed,
      sends_skipped: result.sendsSkipped,
      skip_reasons: result.skipReasons,
      finished_at: new Date().toISOString(),
    })
    .eq("id", runId)
}

async function assertSenderHealthy(
  admin: SupabaseClient,
  senderAccountId: string,
): Promise<{ ok: true } | { ok: false; code: GrowthWarmupExecutorSkipCode; message: string }> {
  const sender = await getSenderAccount(admin, senderAccountId)
  if (!sender) {
    return { ok: false, code: "sender_not_connected", message: "Sender account not found." }
  }
  if (sender.status !== "connected") {
    return { ok: false, code: "sender_not_connected", message: `Sender not connected (${sender.status}).` }
  }
  if (sender.health_status === "critical" || sender.health_status === "degraded") {
    return { ok: false, code: "sender_unhealthy", message: `Sender health is ${sender.health_status}.` }
  }
  return { ok: true }
}

async function executeWarmupSendForProfile(
  admin: SupabaseClient,
  input: {
    profile: GrowthWarmupProfile
    runId: string | null
    previewOnly: boolean
    actorUserId?: string | null
    actorEmail?: string | null
    excludeRecipientEmails?: string[]
  },
): Promise<GrowthWarmupExecutorSenderResult> {
  const { profile, runId, previewOnly, actorUserId, actorEmail, excludeRecipientEmails } = input
  const skipReasons: GrowthWarmupExecutorSenderResult["skipReasons"] = []
  const today = utcDateString()
  const dayStart = utcDayStartIso()
  const sendsToday = profile.sends_today_date === today ? profile.sends_today : 0
  const plannedToday = resolveWarmupDailyCapacity(profile)
  const executorSendsToday = await countExecutorSendsForProfileToday(admin, profile.id, dayStart)
  const remainingCapacity = Math.max(0, plannedToday - sendsToday)

  const base: GrowthWarmupExecutorSenderResult = {
    senderAccountId: profile.sender_account_id,
    senderEmail: profile.sender_email,
    profileId: profile.id,
    plannedToday,
    sendsToday,
    executorSendsToday,
    remainingCapacity,
    attempted: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    skipReasons,
  }

  if (profile.status === "paused") {
    skipReasons.push({
      code: "warmup_paused",
      message: "Warmup profile is paused by operator.",
    })
    base.skipped = 1
    return base
  }

  if (profile.status === "throttled") {
    skipReasons.push({
      code: "warmup_throttled",
      message: profile.throttle_reason ?? "Warmup throttled — reputation protection active.",
    })
    base.skipped = 1
    return base
  }

  if (profile.status !== "warming") {
    skipReasons.push({
      code: "pre_send_blocked",
      message: `Profile status is ${profile.status} — executor only sends from warming profiles.`,
    })
    base.skipped = 1
    return base
  }

  if (remainingCapacity <= 0) {
    skipReasons.push({ code: "warmup_cap_exhausted", message: "Daily warmup cap already met." })
    base.skipped = 1
    return base
  }

  const warmupGuard = await evaluateWarmupPreSendAllowed(admin, {
    senderAccountId: profile.sender_account_id,
  })
  if (!warmupGuard.allowed) {
    skipReasons.push({
      code: (warmupGuard.blockCode as GrowthWarmupExecutorSkipCode) ?? "pre_send_blocked",
      message: warmupGuard.reason ?? "Warmup pre-send guard blocked.",
    })
    base.skipped = 1
    return base
  }

  const senderHealth = await assertSenderHealthy(admin, profile.sender_account_id)
  if (!senderHealth.ok) {
    skipReasons.push({ code: senderHealth.code, message: senderHealth.message })
    base.skipped = 1
    return base
  }

  const recipients = await listWarmupRecipients(admin, { activeOnly: true, approvedOnly: true })
  const selection = await selectWarmupRecipientForSend(admin, {
    recipients,
    senderAccountId: profile.sender_account_id,
    excludeEmails: excludeRecipientEmails,
  })
  if (!selection.ok) {
    skipReasons.push({ code: selection.code, message: selection.message })
    base.skipped = 1
    return base
  }

  const template = pickWarmupMessageTemplate({
    seed: `${profile.id}:${selection.recipient.email}:${sendsToday}`,
  })

  if (previewOnly) {
    base.attempted = 1
    base.sent = 1
    return base
  }

  base.attempted = 1

  const preSend = await assertPreSendAllowed(admin, {
    email: selection.recipient.email,
    senderAccountId: profile.sender_account_id,
    actingUserEmail: actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
    actingUserId: actorUserId ?? null,
  })
  if (!preSend.allowed) {
    skipReasons.push({ code: "pre_send_blocked", message: preSend.reason ?? "Pre-send blocked." })
    base.skipped = 1
    await recordAttempt(admin, {
      runId,
      profile,
      recipient: selection.recipient,
      template,
      status: "skipped",
      skipReason: preSend.reason,
    })
    return base
  }

  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId: profile.sender_account_id,
    subject: template.subject,
    bodyText: template.body,
  })

  const transport = await executeTransportSend(admin, {
    sender_account_id: profile.sender_account_id,
    to: selection.recipient.email,
    subject: prepared.subject,
    text: prepared.textBody,
    html: prepared.htmlBody,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: actorUserId ?? "",
    actorEmail: actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
    is_test: false,
    metadata: {
      warmup_executor: true,
      warmup_profile_id: profile.id,
      warmup_recipient_id: selection.recipient.id,
      warmup_template_id: template.id,
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      governance_audit_recorded: false,
    },
  })

  if (!transport.ok) {
    logGrowthEngine("warmup_executor_transport_failed", {
      qa_marker: GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
      profile_id: profile.id,
      sender_account_id: profile.sender_account_id,
      recipient_id: selection.recipient.id,
      recipient_email: selection.recipient.email,
      run_id: runId,
      skip_reason: "transport_failed",
      transport_error: transport.error ?? "Transport send failed.",
    })
    skipReasons.push({
      code: "transport_failed",
      message: transport.error ?? "Transport send failed.",
    })
    base.failed = 1
    await recordAttempt(admin, {
      runId,
      profile,
      recipient: selection.recipient,
      template,
      status: "failed",
      skipReason: transport.error,
      deliveryAttemptId: transport.attempt?.id ?? null,
    })
    return base
  }

  base.sent = 1
  await updateWarmupRecipient(admin, selection.recipient.id, {
    last_sent_at: new Date().toISOString(),
  })
  await recordAttempt(admin, {
    runId,
    profile,
    recipient: selection.recipient,
    template,
    status: "sent",
    deliveryAttemptId: transport.attempt?.id ?? null,
  })

  await createWarmupEvent(admin, {
    warmup_profile_id: profile.id,
    event_type: "warmup_executor_send",
    severity: "low",
    title: "Warmup executor send",
    description: `Sent warmup message to ${selection.recipient.email} (${base.sent}/${remainingCapacity} remaining before send).`,
    metadata: {
      recipient_id: selection.recipient.id,
      template_id: template.id,
      delivery_attempt_id: transport.attempt?.id ?? null,
    },
  }).catch(() => undefined)

  return base
}

async function recordAttempt(
  admin: SupabaseClient,
  input: {
    runId: string | null
    profile: GrowthWarmupProfile
    recipient: { id: string; email: string }
    template: { id: string; subject: string }
    status: "sent" | "failed" | "skipped"
    skipReason?: string | null
    deliveryAttemptId?: string | null
  },
): Promise<void> {
  if (!input.runId) return
  await admin.schema("growth").from("warmup_send_attempts").insert({
    warmup_send_run_id: input.runId,
    warmup_profile_id: input.profile.id,
    sender_account_id: input.profile.sender_account_id,
    warmup_recipient_id: input.recipient.id,
    recipient_email: input.recipient.email,
    subject: input.template.subject,
    status: input.status,
    skip_reason: input.skipReason ?? null,
    delivery_attempt_id: input.deliveryAttemptId ?? null,
    template_id: input.template.id,
    metadata: { qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER },
  })
}

export async function runWarmupSendExecutor(
  admin: SupabaseClient,
  input?: {
    runKind?: GrowthWarmupSendRunKind
    previewOnly?: boolean
    confirmed?: boolean
    actorUserId?: string | null
    actorEmail?: string | null
    maxSends?: number
    enforceSendingWindow?: boolean
  },
): Promise<GrowthWarmupExecutorRunResult> {
  const runKind = input?.runKind ?? "cron"
  const previewOnly = Boolean(input?.previewOnly)
  const now = new Date()
  const idempotencyKey = buildIdempotencyKey(runKind, now)
  const skipReasons: GrowthWarmupExecutorRunResult["skipReasons"] = []

  const schemaReady = await isGrowthWarmupExecutorSchemaReady(admin)
  if (!schemaReady) {
    return {
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      runId: null,
      runKind,
      idempotencyKey,
      status: "skipped",
      profilesScanned: 0,
      sendsAttempted: 0,
      sendsSucceeded: 0,
      sendsFailed: 0,
      sendsSkipped: 0,
      senderResults: [],
      skipReasons: [{ code: "schema_not_ready", message: "Warmup executor schema not applied." }],
      previewOnly,
    }
  }

  if (runKind === "manual" && !previewOnly && !input?.confirmed) {
    return {
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      runId: null,
      runKind,
      idempotencyKey,
      status: "skipped",
      profilesScanned: 0,
      sendsAttempted: 0,
      sendsSucceeded: 0,
      sendsFailed: 0,
      sendsSkipped: 0,
      senderResults: [],
      skipReasons: [{ code: "idempotent_skip", message: "Manual run requires confirmation." }],
      previewOnly,
    }
  }

  if (runKind === "cron" && input?.enforceSendingWindow !== false && !isWithinWarmupSendingWindow(now)) {
    return {
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      runId: null,
      runKind,
      idempotencyKey,
      status: "skipped",
      profilesScanned: 0,
      sendsAttempted: 0,
      sendsSucceeded: 0,
      sendsFailed: 0,
      sendsSkipped: 0,
      senderResults: [],
      skipReasons: [{ code: "outside_sending_window", message: "Outside conservative sending window." }],
      previewOnly,
    }
  }

  if (runKind === "cron" && !previewOnly) {
    const existing = await findExistingRun(admin, idempotencyKey)
    if (existing) {
      return {
        qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
        runId: existing.id,
        runKind,
        idempotencyKey,
        status: "skipped",
        profilesScanned: 0,
        sendsAttempted: 0,
        sendsSucceeded: 0,
        sendsFailed: 0,
        sendsSkipped: 0,
        senderResults: [],
        skipReasons: [{ code: "idempotent_skip", message: "Cron batch already ran for this hour." }],
        previewOnly,
      }
    }
  }

  const allProfiles = await listWarmupProfiles(admin)
  const scannableProfiles = allProfiles.filter(isWarmupExecutorScannableProfile)
  const approvedRecipients = await listWarmupRecipients(admin, { activeOnly: true, approvedOnly: true })

  const profileDiagnostics: WarmupExecutorProfileDiagnostic[] = scannableProfiles.map((profile) => {
    const sendsToday = profile.sends_today_date === utcDateString(now) ? profile.sends_today : 0
    const plannedToday = resolveWarmupDailyCapacity(profile)
    const remainingCapacity = Math.max(0, plannedToday - sendsToday)
    return describeWarmupExecutorProfileDiagnostic({
      profile,
      remainingCapacity,
      approvedRecipientCount: approvedRecipients.length,
      enforceSendingWindow: runKind === "cron" && input?.enforceSendingWindow !== false,
      now,
    })
  })

  const runSummary = summarizeWarmupExecutorRun({
    allProfiles,
    scannableProfiles,
    diagnostics: profileDiagnostics,
    approvedRecipientCount: approvedRecipients.length,
  })

  if (allProfiles.length === 0) {
    return {
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      runId: null,
      runKind,
      idempotencyKey,
      status: "skipped",
      profilesScanned: 0,
      sendsAttempted: 0,
      sendsSucceeded: 0,
      sendsFailed: 0,
      sendsSkipped: 0,
      senderResults: [],
      skipReasons: [{ code: "no_warming_profiles", message: runSummary.primaryMessage }],
      previewOnly,
      profileDiagnostics,
      runSummary,
    }
  }

  if (approvedRecipients.length === 0) {
    skipReasons.push({ code: "no_approved_recipients", message: "No approved warmup recipients configured." })
  } else if (runSummary.eligibleProfiles === 0) {
    skipReasons.push({
      code: "no_warming_profiles",
      message: runSummary.primaryMessage,
    })
  }

  const sendCandidateProfiles = scannableProfiles.filter((profile) =>
    isWarmupExecutorSendEligibleStatus(profile.status),
  )

  const maxSends =
    input?.maxSends ?? (runKind === "manual" ? MAX_SENDS_PER_MANUAL_RUN : MAX_SENDS_PER_CRON_RUN)

  logGrowthEngine("warmup_executor_send_plan", {
    qa_marker: GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER,
    preview_only: previewOnly,
    run_kind: runKind,
    profile_count: sendCandidateProfiles.length,
    profile_ids: sendCandidateProfiles.map((row) => row.id),
    sender_account_ids: sendCandidateProfiles.map((row) => row.sender_account_id),
    remaining_sends: sendCandidateProfiles.map((row) => {
      const sendsToday = row.sends_today_date === utcDateString(now) ? row.sends_today : 0
      return Math.max(0, resolveWarmupDailyCapacity(row) - sendsToday)
    }),
    approved_recipient_count: approvedRecipients.length,
    max_sends: maxSends,
  })

  let runId: string | null = null
  if (!previewOnly && sendCandidateProfiles.length > 0) {
    runId = await createSendRun(admin, {
      runKind,
      idempotencyKey,
      actorEmail: input?.actorEmail,
    })
  }

  const senderResults: GrowthWarmupExecutorSenderResult[] = []
  let sendsAttempted = 0
  let sendsSucceeded = 0
  let sendsFailed = 0
  let sendsSkipped = 0
  let totalSentThisRun = 0

  for (const profile of sendCandidateProfiles) {
    if (totalSentThisRun >= maxSends) {
      skipReasons.push({ code: "batch_limit_reached", message: "Batch send limit reached for this run." })
      break
    }

    try {
      const result = await executeWarmupSendForProfile(admin, {
        profile,
        runId,
        previewOnly,
        actorUserId: input?.actorUserId,
        actorEmail: input?.actorEmail,
      })
      senderResults.push(result)
      sendsAttempted += result.attempted
      sendsSucceeded += result.sent
      sendsFailed += result.failed
      sendsSkipped += result.skipped
      totalSentThisRun += result.sent
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile send failed unexpectedly."
      const stack = error instanceof Error ? error.stack : undefined
      logGrowthEngine("warmup_executor_profile_failed", {
        qa_marker: GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER,
        profileId: profile.id,
        senderAccountId: profile.sender_account_id,
        run_id: runId,
        skip_reason: "profile_execution_failed",
        error: message,
        stack,
      })
      skipReasons.push({ code: "profile_execution_failed", message })
      sendsFailed += 1
      senderResults.push({
        senderAccountId: profile.sender_account_id,
        senderEmail: profile.sender_email,
        profileId: profile.id,
        plannedToday: resolveWarmupDailyCapacity(profile),
        sendsToday: profile.sends_today_date === utcDateString(now) ? profile.sends_today : 0,
        executorSendsToday: 0,
        remainingCapacity: 0,
        attempted: 1,
        sent: 0,
        failed: 1,
        skipped: 0,
        skipReasons: [{ code: "profile_execution_failed", message }],
      })
    }
  }

  const status: GrowthWarmupExecutorRunResult["status"] =
    sendsFailed > 0 && sendsSucceeded > 0
      ? "partial"
      : sendsFailed > 0
        ? "failed"
        : sendsSucceeded > 0
          ? "completed"
          : "skipped"

  const finalResult: GrowthWarmupExecutorRunResult = {
    qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
    runId,
    runKind,
    idempotencyKey,
    status,
    profilesScanned: scannableProfiles.length,
    sendsAttempted,
    sendsSucceeded,
    sendsFailed,
    sendsSkipped,
    senderResults,
    skipReasons,
    previewOnly,
    profileDiagnostics,
    runSummary,
  }

  if (runId) {
    try {
      await finalizeSendRun(admin, runId, finalResult)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not finalize warmup send run."
      logGrowthEngine("warmup_executor_finalize_failed", {
        qa_marker: GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
        run_id: runId,
        error: message,
        sends_succeeded: finalResult.sendsSucceeded,
        sends_failed: finalResult.sendsFailed,
      })
    }
  }

  return finalResult
}

export async function buildWarmupExecutorDashboardStats(
  admin: SupabaseClient,
  profiles: GrowthWarmupProfile[],
): Promise<GrowthWarmupProfileExecutorStats[]> {
  const today = utcDateString()
  const dayStart = utcDayStartIso()
  const recipients = await listWarmupRecipients(admin, { activeOnly: true, approvedOnly: true }).catch(
    () => [],
  )
  const latestRun = await getLatestWarmupSendRun(admin)

  const stats = []
  for (const profile of profiles) {
    const plannedToday = resolveWarmupDailyCapacity(profile)
    const sendsToday = profile.sends_today_date === today ? profile.sends_today : 0
    const executorSendsToday = await countExecutorSendsForProfileToday(admin, profile.id, dayStart)
    const remainingToday = Math.max(0, plannedToday - sendsToday)
    const diagnostic = describeWarmupExecutorProfileDiagnostic({
      profile,
      remainingCapacity: remainingToday,
      approvedRecipientCount: recipients.length,
      enforceSendingWindow: false,
    })
    stats.push({
      profileId: profile.id,
      senderEmail: profile.sender_email,
      profileStatus: profile.status,
      plannedToday,
      sendsToday,
      executorSendsToday,
      realOutboundCounted: Math.max(0, sendsToday - executorSendsToday),
      remainingToday,
      lastExecutorRunAt: latestRun?.finished_at ?? latestRun?.started_at ?? null,
      pausedOrThrottled: profile.status === "paused" || profile.status === "throttled",
      recipientPoolActive: recipients.length,
      eligibility: diagnostic.eligibility,
      skipReason: diagnostic.eligibility === "skipped" ? diagnostic.reason : null,
      nextAction: diagnostic.nextAction,
      throttleReason: profile.throttle_reason,
    })
  }
  return stats
}

export async function previewWarmupSendExecutor(
  admin: SupabaseClient,
): Promise<GrowthWarmupExecutorRunResult> {
  return runWarmupSendExecutor(admin, { runKind: "manual", previewOnly: true, enforceSendingWindow: false })
}
