import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { GROWTH_CRON_ACTOR_EMAIL, resolveGrowthActorForDb } from "@/lib/growth/actor-user-id"
import { GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER } from "@/lib/growth/warmup/warmup-executor-api-response"
import { assertPreSendAllowed } from "@/lib/growth/compliance/pre-send-assertion"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import { evaluateWarmupExecutorSenderHealthGate } from "@/lib/growth/warmup/warmup-sender-health-gate"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { createWarmupEvent } from "@/lib/growth/warmup/warmup-events"
import {
  getWarmupProfileForSender,
  resolveEffectiveWarmupDailyCapacity,
} from "@/lib/growth/warmup/warmup-execution"
import { evaluateWarmupPreSendAllowed } from "@/lib/growth/warmup/warmup-pre-send-guard"
import { listWarmupProfiles, getWarmupProfile } from "@/lib/growth/warmup/warmup-repository"
import { isGrowthWarmupExecutorSchemaReady } from "@/lib/growth/warmup/warmup-executor-schema-health"
import {
  countExecutorSendsForProfileToday,
  getLatestWarmupSendRun,
  listWarmupRecipients,
  updateWarmupRecipient,
} from "@/lib/growth/warmup/warmup-recipient-repository"
import {
  selectWarmupRecipientForSend,
  countAvailableWarmupRecipients,
  countAvailableWarmupRecipientsForSender,
} from "@/lib/growth/warmup/warmup-recipient-selector"
import {
  summarizeRecipientPoolPressure,
} from "@/lib/growth/warmup/warmup-executor-manual-run-diagnostics"
import { pickWarmupMessageTemplate } from "@/lib/growth/warmup/warmup-message-templates"
import {
  describeWarmupExecutorProfileDiagnostic,
  isWarmupExecutorScannableProfile,
  isWarmupExecutorSendEligibleStatus,
  summarizeWarmupExecutorRun,
  computeWarmupExecutorRunSendPlan,
  buildWarmupExecutorPacingMessage,
  buildWarmupRecipientPoolPressureMessage,
  MAX_SENDS_PER_PROFILE_PER_RUN,
} from "@/lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER,
  mergeWarmupExecutorRunSkipReasons,
  sortWarmupSendCandidateProfiles,
  WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY,
} from "@/lib/growth/warmup/warmup-executor-fairness"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  isWithinWarmupSendingWindow,
  type GrowthWarmupExecutorRunResult,
  type GrowthWarmupExecutorSenderResult,
  type GrowthWarmupExecutorSkipCode,
  type GrowthWarmupProfileExecutorStats,
  type GrowthWarmupSendRunKind,
  type WarmupExecutorProfileDiagnostic,
  type WarmupExecutorRecipientPoolSummary,
} from "@/lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "@/lib/growth/warmup/warmup-types"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { getMailboxConnectionBySender } from "@/lib/growth/mailboxes/mailbox-repository"
import {
  computeWarmupRecipientPoolHealth,
  type WarmupRecipientPoolHealth,
} from "@/lib/growth/warmup/warmup-recipient-pool-health"

export const GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER = "growth-warmup-executor-1d-v1" as const
export const GROWTH_WARMUP_EXECUTOR_1E_QA_MARKER = "growth-warmup-executor-1e-v1" as const
export const GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER = "growth-warmup-executor-1f-v1" as const
export { GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER, WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY } from "@/lib/growth/warmup/warmup-executor-fairness"

export { MAX_SENDS_PER_PROFILE_PER_RUN } from "@/lib/growth/warmup/warmup-executor-diagnostics"

async function buildRecipientPoolSummary(
  admin: SupabaseClient,
  recipients: Awaited<ReturnType<typeof listWarmupRecipients>>,
  input?: {
    warmingSenderCount?: number
    profileId?: string
  },
): Promise<WarmupExecutorRecipientPoolSummary> {
  const availableNow = await countAvailableWarmupRecipients(admin, recipients)
  const activeApprovedRecipients = recipients.filter((row) => row.active && row.approved).length
  const availableForSender =
    input?.profileId != null
      ? await countAvailableWarmupRecipientsForSender(admin, {
          recipients,
          profileId: input.profileId,
        })
      : null
  const health = computeWarmupRecipientPoolHealth({
    approvedRecipients: activeApprovedRecipients,
    availableGlobally: availableNow,
    availableForSender,
    warmingSenderCount: input?.warmingSenderCount ?? 0,
  })
  return summarizeRecipientPoolPressure({
    recipients,
    availableNow,
    availableForSender,
    health,
  })
}

function withExecutorBuildMarker(
  result: GrowthWarmupExecutorRunResult,
  recipientPoolSummary?: WarmupExecutorRecipientPoolSummary,
): GrowthWarmupExecutorRunResult {
  return {
    ...result,
    executorBuildMarker: GROWTH_WARMUP_EXECUTOR_1F_QA_MARKER,
    recipientPoolSummary: recipientPoolSummary ?? result.recipientPoolSummary,
  }
}

function utcDateString(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function utcDayStartIso(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString()
}

async function loadSenderAccountGateContext(
  admin: SupabaseClient,
  senderAccountIds: string[],
): Promise<Map<string, { status: string; health_status: string; last_send_at: string | null }>> {
  const uniqueIds = [...new Set(senderAccountIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, status, health_status, last_send_at")
    .in("id", uniqueIds)
    .is("deleted_at", null)

  if (error) throw new Error(error.message)

  return new Map(
    (data ?? []).map((row) => {
      const record = row as Record<string, unknown>
      const lastSendAt = record.last_send_at
      return [
        String(record.id),
        {
          status: String(record.status ?? ""),
          health_status: String(record.health_status ?? ""),
          last_send_at:
            typeof lastSendAt === "string" && lastSendAt.trim().length > 0 ? lastSendAt.trim() : null,
        },
      ] as const
    }),
  )
}

function buildIdempotencyKey(kind: GrowthWarmupSendRunKind, now = new Date()): string {
  if (kind === "cron") {
    return `warmup-cron:${utcDateString(now)}:${now.getUTCHours()}`
  }
  return `warmup-manual:${now.toISOString()}:${randomUUID()}`
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
  profile: GrowthWarmupProfile,
): Promise<{ ok: true; controlledWarmupAllowed: boolean } | { ok: false; code: GrowthWarmupExecutorSkipCode; message: string }> {
  const sender = await getSenderAccount(admin, profile.sender_account_id)
  const gate = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: sender?.status ?? null,
    senderHealthStatus: sender?.health_status ?? null,
    profileStatus: profile.status,
    warmupHealth: profile.warmup_health,
  })

  if (!gate.allowed) {
    return {
      ok: false,
      code: gate.skipCode ?? "sender_unhealthy",
      message: gate.message ?? "Sender health blocked warmup send.",
    }
  }

  const mailbox = await getMailboxConnectionBySender(admin, profile.sender_account_id).catch(() => null)
  if (mailbox && !["connected", "healthy", "warning"].includes(mailbox.status)) {
    return {
      ok: false,
      code: "pre_send_blocked",
      message: `Mailbox connection unhealthy (${mailbox.status}).`,
    }
  }

  return { ok: true, controlledWarmupAllowed: gate.controlledWarmupAllowed }
}

async function executeWarmupSendForProfile(
  admin: SupabaseClient,
  input: {
    profile: GrowthWarmupProfile
    runId: string | null
    previewOnly: boolean
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthWarmupExecutorSenderResult> {
  const { profile, runId, previewOnly, actorUserId, actorEmail } = input
  const skipReasons: GrowthWarmupExecutorSenderResult["skipReasons"] = []
  const today = utcDateString()
  const dayStart = utcDayStartIso()
  const sendsToday = profile.sends_today_date === today ? profile.sends_today : 0
  const plannedToday = resolveEffectiveWarmupDailyCapacity(profile)
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

  const senderHealth = await assertSenderHealthy(admin, profile)
  if (!senderHealth.ok) {
    skipReasons.push({ code: senderHealth.code, message: senderHealth.message })
    base.skipped = 1
    return base
  }

  const recipients = await listWarmupRecipients(admin, { activeOnly: true, approvedOnly: true })
  const selection = await selectWarmupRecipientForSend(admin, {
    recipients,
    senderAccountId: profile.sender_account_id,
    profileId: profile.id,
    recipientDedupPolicy: WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY,
  })
  if (!selection.ok) {
    const skipCode: GrowthWarmupExecutorSkipCode =
      selection.code === "no_recipients" ? "no_approved_recipients" : selection.code
    skipReasons.push({ code: skipCode, message: selection.message })
    base.skipped = 1
    base.attempted = 1
    await recordAttempt(admin, {
      runId,
      profile,
      status: "skipped",
      skipReason: selection.message,
      skipCode,
      selectionContext: selection.metadata,
    })
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

  const actor = resolveGrowthActorForDb({
    actorUserId,
    actorEmail: actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
  })

  const transport = await executeTransportSend(admin, {
    sender_account_id: profile.sender_account_id,
    to: selection.recipient.email,
    subject: prepared.subject,
    text: prepared.textBody,
    html: prepared.htmlBody,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: actor.actorUserId,
    actorEmail: actor.actorEmail ?? GROWTH_CRON_ACTOR_EMAIL,
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
    description: `Sent warmup message to ${selection.recipient.email} (${Math.max(0, remainingCapacity - 1)} remaining today after send).`,
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
    recipient?: { id: string; email: string } | null
    template?: { id: string; subject: string } | null
    status: "sent" | "failed" | "skipped"
    skipReason?: string | null
    skipCode?: GrowthWarmupExecutorSkipCode | null
    deliveryAttemptId?: string | null
    selectionContext?: Record<string, unknown>
  },
): Promise<void> {
  if (!input.runId) return
  await admin.schema("growth").from("warmup_send_attempts").insert({
    warmup_send_run_id: input.runId,
    warmup_profile_id: input.profile.id,
    sender_account_id: input.profile.sender_account_id,
    warmup_recipient_id: input.recipient?.id ?? null,
    recipient_email: input.recipient?.email ?? "",
    subject: input.template?.subject ?? "",
    status: input.status,
    skip_reason: input.skipReason ?? null,
    delivery_attempt_id: input.deliveryAttemptId ?? null,
    template_id: input.template?.id ?? null,
    metadata: {
      qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
      fairness_qa_marker: GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER,
      skip_code: input.skipCode ?? null,
      ...input.selectionContext,
    },
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
    return withExecutorBuildMarker({
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
    })
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
  const warmingSenderCount = scannableProfiles.filter((profile) => profile.status === "warming").length
  const recipientPoolSummary = await buildRecipientPoolSummary(admin, approvedRecipients, {
    warmingSenderCount,
  })
  const senderGateContext = await loadSenderAccountGateContext(
    admin,
    scannableProfiles.map((profile) => profile.sender_account_id),
  )

  const profileDiagnostics: WarmupExecutorProfileDiagnostic[] = scannableProfiles.map((profile) => {
    const sendsToday = profile.sends_today_date === utcDateString(now) ? profile.sends_today : 0
    const plannedToday = resolveEffectiveWarmupDailyCapacity(profile)
    const remainingCapacity = Math.max(0, plannedToday - sendsToday)
    return describeWarmupExecutorProfileDiagnostic({
      profile,
      remainingCapacity,
      approvedRecipientCount: approvedRecipients.length,
      enforceSendingWindow: runKind === "cron" && input?.enforceSendingWindow !== false,
      now,
      senderAccount: senderGateContext.get(profile.sender_account_id) ?? null,
    })
  })

  const eligibleProfileCount = profileDiagnostics.filter((d) => d.eligibility === "eligible").length
  const sendPlan = computeWarmupExecutorRunSendPlan({
    eligibleProfileCount,
    maxSendsOverride: input?.maxSends,
  })
  const poolPressureMessage = buildWarmupRecipientPoolPressureMessage({
    activeApprovedRecipients: approvedRecipients.length,
    eligibleProfiles: eligibleProfileCount,
    plannedSendsThisRun: sendPlan.plannedSendsThisRun,
    waitingProfilesThisRun: sendPlan.waitingProfilesThisRun,
    availableNow: recipientPoolSummary.availableNow,
  })
  const representativePlannedToday =
    scannableProfiles.find((p) => p.status === "warming") != null
      ? resolveEffectiveWarmupDailyCapacity(
          scannableProfiles.find((p) => p.status === "warming")!,
        )
      : null
  const eligibleRemaining = profileDiagnostics
    .filter((d) => d.eligibility === "eligible")
    .map((d) => d.remainingCapacity)
  const representativeRemainingToday =
    eligibleRemaining.length > 0
      ? eligibleRemaining.every((value) => value === eligibleRemaining[0])
        ? eligibleRemaining[0]
        : Math.min(...eligibleRemaining)
      : null
  const pacingMessage = buildWarmupExecutorPacingMessage({
    eligibleProfiles: eligibleProfileCount,
    plannedSendsThisRun: sendPlan.plannedSendsThisRun,
    waitingProfilesThisRun: sendPlan.waitingProfilesThisRun,
    activeApprovedRecipients: approvedRecipients.length,
    plannedTodayPerMailbox: representativePlannedToday,
    representativeRemainingToday,
  })

  const runSummary = summarizeWarmupExecutorRun({
    allProfiles,
    scannableProfiles,
    diagnostics: profileDiagnostics,
    approvedRecipientCount: approvedRecipients.length,
    plannedSendsThisRun: sendPlan.plannedSendsThisRun,
    waitingProfilesThisRun: sendPlan.waitingProfilesThisRun,
    poolPressureMessage,
    pacingMessage,
  })

  const enrichedRecipientPoolSummary: WarmupExecutorRecipientPoolSummary = {
    ...recipientPoolSummary,
    eligibleProfiles: eligibleProfileCount,
    plannedSendsThisRun: sendPlan.plannedSendsThisRun,
    waitingProfilesThisRun: sendPlan.waitingProfilesThisRun,
    poolPressureMessage,
    message: poolPressureMessage ?? recipientPoolSummary.message,
  }

  if (allProfiles.length === 0) {
    return withExecutorBuildMarker(
      {
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
        recipientPoolSummary: enrichedRecipientPoolSummary,
      },
      enrichedRecipientPoolSummary,
    )
  }

  if (approvedRecipients.length === 0) {
    skipReasons.push({ code: "no_approved_recipients", message: "No approved warmup recipients configured." })
  } else if (runSummary.eligibleProfiles === 0) {
    skipReasons.push({
      code: "no_warming_profiles",
      message: runSummary.primaryMessage,
    })
  }

  const sendCandidateProfiles = sortWarmupSendCandidateProfiles(
    scannableProfiles.filter((profile) => isWarmupExecutorSendEligibleStatus(profile.status)),
    {
      now,
      senderLastSendAt: new Map(
        [...senderGateContext.entries()].map(([id, sender]) => [id, sender.last_send_at]),
      ),
    },
  )

  logGrowthEngine("warmup_executor_send_plan", {
    qa_marker: GROWTH_WARMUP_EXECUTOR_1D_QA_MARKER,
    preview_only: previewOnly,
    run_kind: runKind,
    profile_count: sendCandidateProfiles.length,
    eligible_profile_count: eligibleProfileCount,
    profile_ids: sendCandidateProfiles.map((row) => row.id),
    sender_account_ids: sendCandidateProfiles.map((row) => row.sender_account_id),
    remaining_sends: sendCandidateProfiles.map((row) => {
      const sendsToday = row.sends_today_date === utcDateString(now) ? row.sends_today : 0
      return Math.max(0, resolveEffectiveWarmupDailyCapacity(row) - sendsToday)
    }),
    approved_recipient_count: approvedRecipients.length,
    max_sends_per_profile: sendPlan.maxSendsPerProfile,
    max_total_sends: sendPlan.maxTotalSends,
    planned_sends_this_run: sendPlan.plannedSendsThisRun,
    waiting_profiles_this_run: sendPlan.waitingProfilesThisRun,
    recipient_dedup_policy: WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY,
    fairness_qa_marker: GROWTH_WARMUP_FAIRNESS_1P_QA_MARKER,
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
  let successfulSendsThisRun = 0

  for (const profile of sendCandidateProfiles) {
    if (sendPlan.maxTotalSends > 0 && successfulSendsThisRun >= sendPlan.maxTotalSends) {
      skipReasons.push({
        code: "batch_limit_reached",
        message: "Run safety cap reached for this batch.",
      })
      break
    }

    try {
      const freshProfile = (await getWarmupProfile(admin, profile.id)) ?? profile
      const result = await executeWarmupSendForProfile(admin, {
        profile: freshProfile,
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
      successfulSendsThisRun += result.sent
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
        plannedToday: resolveEffectiveWarmupDailyCapacity(profile),
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

  const mergedSkipReasons = mergeWarmupExecutorRunSkipReasons(skipReasons, senderResults)

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
    skipReasons: mergedSkipReasons,
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

  return withExecutorBuildMarker(finalResult, enrichedRecipientPoolSummary)
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
  const senderGateContext = await loadSenderAccountGateContext(
    admin,
    profiles.map((profile) => profile.sender_account_id),
  )

  const stats = []
  const warmingSenderCount = profiles.filter((profile) => profile.status === "warming").length
  const poolHealth = computeWarmupRecipientPoolHealth({
    approvedRecipients: recipients.length,
    availableGlobally: await countAvailableWarmupRecipients(admin, recipients),
    warmingSenderCount,
  })

  for (const profile of profiles) {
    const plannedToday = resolveEffectiveWarmupDailyCapacity(profile)
    const sendsToday = profile.sends_today_date === today ? profile.sends_today : 0
    const executorSendsToday = await countExecutorSendsForProfileToday(admin, profile.id, dayStart)
    const remainingToday = Math.max(0, plannedToday - sendsToday)
    const recipientsAvailableForSender = await countAvailableWarmupRecipientsForSender(admin, {
      recipients,
      profileId: profile.id,
    })
    const diagnostic = describeWarmupExecutorProfileDiagnostic({
      profile,
      remainingCapacity: remainingToday,
      approvedRecipientCount: recipients.length,
      enforceSendingWindow: false,
      senderAccount: senderGateContext.get(profile.sender_account_id) ?? null,
    })
    const profilePoolHealth = computeWarmupRecipientPoolHealth({
      approvedRecipients: recipients.length,
      availableGlobally: poolHealth.availableGlobally,
      availableForSender: recipientsAvailableForSender,
      warmingSenderCount,
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
      recipientsAvailableForSender,
      recipientPoolHealthTier: profilePoolHealth.tier,
      recipientPoolHealthMessage: profilePoolHealth.message,
      eligibility: diagnostic.eligibility,
      skipReason: diagnostic.eligibility === "skipped" ? diagnostic.reason : null,
      nextAction: diagnostic.nextAction,
      throttleReason: profile.throttle_reason,
      nextRunCanSend:
        diagnostic.eligibility === "eligible" && remainingToday > 0 ? MAX_SENDS_PER_PROFILE_PER_RUN : 0,
      senderHealthStatus: diagnostic.senderHealthStatus ?? null,
      controlledWarmupAllowed: diagnostic.controlledWarmupAllowed ?? false,
      senderHealthNote: diagnostic.senderHealthNote ?? null,
      throttleClearable: diagnostic.throttleClearable ?? false,
    })
  }
  return stats
}

export async function previewWarmupSendExecutor(
  admin: SupabaseClient,
): Promise<GrowthWarmupExecutorRunResult> {
  return runWarmupSendExecutor(admin, { runKind: "manual", previewOnly: true, enforceSendingWindow: false })
}
