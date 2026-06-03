import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"
import { createGrowthLead, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLeadMemoryProfileView } from "@/lib/growth/lead-memory/dashboard"
import { runInboxSyncForEnabledMailboxes } from "@/lib/growth/inbox-sync/inbox-sync-runner"
import {
  bulkEnrollLeadsInGrowthSequence,
} from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment"
import { qaForceGrowthEnrollmentStepDueNow } from "@/lib/growth/sequence-enrollment/qa-acceleration"
import { runGrowthSequenceScheduler } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import { listGrowthSequenceEnrollmentSteps } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listGrowthSequencePatterns } from "@/lib/growth/sequence-pattern-repository"
import { syncGrowthRepRosterFromPlatformAdmins, listGrowthRepRoster } from "@/lib/growth/assignment/rep-roster-repository"
import { approveSequenceExecutionJobSolo } from "@/lib/growth/sequences/execution/approve-sequence-execution-solo"
import { runApprovedDueSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-runner"
import {
  type GrowthReplyFlowHarnessReport,
  type GrowthReplyFlowHarnessStep,
} from "@/lib/growth/qa/reply-flow-harness-types"
import {
  buildGrowthReplyFlowReport,
  formatGrowthReplyFlowReport,
  type GrowthReplyFlowInspectSnapshot,
} from "@/lib/growth/qa/reply-flow-report"

export { buildGrowthReplyFlowReport, formatGrowthReplyFlowReport }

const DEFAULT_COMPANY_PREFIX = "QA Reply Flow Harness"
const DEFAULT_PATTERN_KEY = "email_then_call"

export type GrowthReplyFlowHarnessOptions = {
  step?: GrowthReplyFlowHarnessStep
  leadId?: string | null
  companyName?: string | null
  fresh?: boolean
  patternKey?: string
  contactEmail?: string | null
  actingUserId?: string | null
  actingUserEmail?: string | null
  skipExecute?: boolean
}

type ActingUser = { userId: string; email: string }

type HarnessState = {
  leadId: string
  companyName: string
  enrollmentId: string | null
  patternId: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function resolveGrowthReplyFlowActingUser(admin: SupabaseClient): Promise<ActingUser> {
  const emails = getPlatformAdminEmails()
  if (emails.length === 0) {
    throw new Error("EQUIPIFY_PLATFORM_ADMIN_EMAILS is required for the QA harness.")
  }

  const email = emails[0]!
  await syncGrowthRepRosterFromPlatformAdmins(admin)
  const reps = await listGrowthRepRoster(admin)
  const rep = reps.find((entry) => entry.email.trim().toLowerCase() === email)
  if (rep) return { userId: rep.userId, email: rep.email }

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === email)
  if (match?.id) return { userId: match.id, email: match.email ?? email }

  throw new Error(`Could not resolve auth user id for platform admin ${email}.`)
}

async function resolvePatternId(admin: SupabaseClient, patternKey: string): Promise<string> {
  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.key === patternKey) ?? patterns[0]
  if (!pattern) throw new Error("No growth sequence patterns configured.")
  return pattern.id
}

async function findHarnessLead(
  admin: SupabaseClient,
  input: { leadId?: string | null; companyName?: string | null; fresh?: boolean },
): Promise<{ id: string; company_name: string } | null> {
  if (input.leadId) {
    const { data, error } = await admin
      .schema("growth")
      .from("leads")
      .select("id, company_name")
      .eq("id", input.leadId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as { id: string; company_name: string } | null
  }

  if (input.fresh) return null

  const companyName = input.companyName?.trim()
  let query = admin.schema("growth").from("leads").select("id, company_name").order("created_at", { ascending: false }).limit(1)

  if (companyName) {
    query = query.ilike("company_name", companyName)
  } else {
    query = query.ilike("company_name", `${DEFAULT_COMPANY_PREFIX}%`)
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; company_name: string } | null
}

export async function createGrowthReplyFlowLead(
  admin: SupabaseClient,
  input: {
    actingUser: ActingUser
    companyName?: string
    contactEmail?: string | null
  },
): Promise<{ leadId: string; companyName: string }> {
  const companyName =
    input.companyName?.trim() ||
    `${DEFAULT_COMPANY_PREFIX} ${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`
  const contactEmail = input.contactEmail?.trim() || process.env.GROWTH_QA_REPLY_FLOW_TO?.trim() || "mike@fuzor.io"

  const lead = await createGrowthLead(admin, {
    sourceKind: "manual",
    sourceDetail: "qa_reply_flow_harness",
    companyName,
    contactName: "QA Harness Contact",
    contactEmail,
    status: "new",
    researchPriority: "high",
    notes: "Automated Growth Engine reply-flow QA harness lead.",
    assignedTo: input.actingUser.userId,
    createdBy: input.actingUser.userId,
  })

  return { leadId: lead.id, companyName: lead.companyName }
}

export async function enrollGrowthReplyFlowLead(
  admin: SupabaseClient,
  input: {
    leadId: string
    patternId: string
    actingUser: ActingUser
  },
): Promise<{ enrollmentId: string | null; skipped: boolean; detail: unknown }> {
  const result = await bulkEnrollLeadsInGrowthSequence(admin, {
    leadIds: [input.leadId],
    sequencePatternId: input.patternId,
    startImmediately: true,
    ownerUserId: input.actingUser.userId,
    actingUserId: input.actingUser.userId,
    actingUserEmail: input.actingUser.email,
    dryRun: false,
  })

  const outcome =
    result.enrolled[0] ??
    result.skippedAlreadyEnrolled[0] ??
    result.skippedBlocked[0] ??
    result.failed[0] ??
    null

  const enrollmentId = outcome?.enrollmentId ?? null
  const skipped = result.skippedAlreadyEnrolled.length > 0

  if (!enrollmentId && result.failed.length > 0) {
    throw new Error(`Enrollment failed: ${result.failed[0]?.reason ?? result.failed[0]?.code ?? "unknown"}`)
  }

  if (!enrollmentId && result.skippedBlocked.length > 0) {
    throw new Error(`Enrollment blocked: ${result.skippedBlocked[0]?.reason ?? result.skippedBlocked[0]?.code ?? "unknown"}`)
  }

  return { enrollmentId, skipped, detail: outcome }
}

/** QA-only: force step 1 due now + business-hours bypass (same as platform QA buttons). */
export async function accelerateGrowthReplyFlowEnrollmentStepOne(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    actingUser: ActingUser
  },
) {
  return qaForceGrowthEnrollmentStepDueNow(admin, {
    enrollmentId: input.enrollmentId,
    actingUserId: input.actingUser.userId,
    actingUserEmail: input.actingUser.email,
  })
}

async function resolveHarnessEnrollmentId(
  admin: SupabaseClient,
  input: { leadId: string; enrollmentId: string | null },
): Promise<string | null> {
  if (input.enrollmentId) return input.enrollmentId
  try {
    return await resolveActiveEnrollmentId(admin, input.leadId)
  } catch {
    return null
  }
}

export async function runGrowthReplyFlowScheduler(
  admin: SupabaseClient,
  actingUser: ActingUser,
): Promise<Record<string, unknown>> {
  const result = await runGrowthSequenceScheduler(admin, {
    actingUserId: actingUser.userId,
    actingUserEmail: actingUser.email,
    limit: 25,
    dryRun: false,
  })
  return result as unknown as Record<string, unknown>
}

export async function approveGrowthReplyFlowStepOne(
  admin: SupabaseClient,
  input: { leadId: string; actingUser: ActingUser },
): Promise<{ jobId: string | null; detail: unknown }> {
  const { data: jobs, error } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, sequence_step_id, status, created_at")
    .eq("lead_id", input.leadId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  const steps = await listGrowthSequenceEnrollmentSteps(admin, await resolveActiveEnrollmentId(admin, input.leadId))
  const stepOne = steps.find((step) => step.stepOrder === 1) ?? steps[0]
  const job =
    (jobs ?? []).find((row) => row.sequence_step_id === stepOne?.id) ??
    (jobs ?? []).find((row) => !["sent", "skipped"].includes(String(row.status))) ??
    (jobs ?? [])[0]

  if (!job) return { jobId: null, detail: { message: "no_execution_job_found" } }

  const approval = await approveSequenceExecutionJobSolo(admin, {
    jobId: String(job.id),
    approvedBy: input.actingUser.userId,
    actorEmail: input.actingUser.email,
    platformAdmin: true,
  })

  return { jobId: String(job.id), detail: approval }
}

async function resolveActiveEnrollmentId(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data?.id) throw new Error("No active enrollment found for lead.")
  return String(data.id)
}

export async function executeGrowthReplyFlowApprovedJobs(
  admin: SupabaseClient,
  actingUser: ActingUser,
): Promise<Record<string, unknown>> {
  return runApprovedDueSequenceExecutionJobs(admin, {
    actingUserId: actingUser.userId,
    actingUserEmail: actingUser.email,
    limit: 25,
  })
}

export async function runGrowthReplyFlowInboxSync(
  admin: SupabaseClient,
  actingUser?: ActingUser,
): Promise<Record<string, unknown>> {
  const summary = await runInboxSyncForEnabledMailboxes(admin, {
    actorUserId: actingUser?.userId,
    actorEmail: actingUser?.email,
  })
  return summary as unknown as Record<string, unknown>
}

type InspectSnapshot = GrowthReplyFlowInspectSnapshot

export async function inspectGrowthReplyFlowLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<InspectSnapshot> {
  const lead = await fetchGrowthLeadById(admin, leadId)

  const { data: enrollments } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(5)

  const enrollment = (enrollments ?? [])[0] as Record<string, unknown> | undefined

  const { data: steps } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("*")
    .eq("lead_id", leadId)
    .order("step_order", { ascending: true })

  const { data: jobs } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })

  const jobIds = (jobs ?? []).map((row) => String(row.id))
  const attemptIds = [...new Set((jobs ?? []).map((row) => asString(row.delivery_attempt_id)).filter(Boolean))]

  const { data: jobEvents } =
    jobIds.length > 0
      ? await admin
          .schema("growth")
          .from("sequence_execution_job_events")
          .select("*")
          .in("job_id", jobIds)
          .order("created_at", { ascending: true })
      : { data: [] as Record<string, unknown>[] }

  let deliveryAttempts: Record<string, unknown>[] = []
  if (attemptIds.length > 0) {
    const { data } = await admin.schema("growth").from("delivery_attempts").select("*").in("id", attemptIds)
    deliveryAttempts = (data ?? []) as Record<string, unknown>[]
  } else {
    const { data } = await admin
      .schema("growth")
      .from("delivery_attempts")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10)
    deliveryAttempts = (data ?? []) as Record<string, unknown>[]
  }

  const allAttemptIds = deliveryAttempts.map((row) => asString(row.id)).filter(Boolean)
  const { data: transportEvents } =
    allAttemptIds.length > 0
      ? await admin
          .schema("growth")
          .from("transport_audit_events")
          .select("*")
          .in("delivery_attempt_id", allAttemptIds)
          .order("created_at", { ascending: true })
      : { data: [] as Record<string, unknown>[] }

  const primaryJob = (jobs ?? [])[0] as Record<string, unknown> | undefined
  const primaryAttempt = deliveryAttempts[0] ?? null
  const senderAccountId = asString(primaryJob?.sender_account_id) || asString(primaryAttempt?.sender_account_id)

  const { data: sender } = senderAccountId
    ? await admin.schema("growth").from("sender_accounts").select("*").eq("id", senderAccountId).maybeSingle()
    : { data: null }

  const providerId = asString(primaryJob?.provider_id) || asString(primaryAttempt?.provider_id)
  const { data: provider } = providerId
    ? await admin.schema("growth").from("delivery_providers").select("*").eq("id", providerId).maybeSingle()
    : { data: null }

  const { data: mailbox } = senderAccountId
    ? await admin
        .schema("growth")
        .from("mailbox_connections")
        .select("*")
        .eq("sender_account_id", senderAccountId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const { data: timelineEvents } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("*")
    .eq("lead_id", leadId)
    .order("occurred_at", { ascending: false })
    .limit(50)

  const { data: inboxThreads } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .eq("lead_id", leadId)

  const inboxThreadIds = (inboxThreads ?? [])
    .map((row) => asString((row as Record<string, unknown>).id))
    .filter(Boolean)

  const { data: inboxMessages } =
    inboxThreadIds.length > 0
      ? await admin
          .schema("growth")
          .from("inbox_messages")
          .select("*")
          .in("thread_id", inboxThreadIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [] as Record<string, unknown>[] }

  const { data: replyIngestionEvents } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: outboundReplies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("*")
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(20)

  const { data: replyWorkflowActions } = await admin
    .schema("growth")
    .from("reply_workflow_actions")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: growthNotifications } = await admin
    .schema("growth")
    .from("notifications")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(20)

  const mailboxConnectionId = asString(mailbox?.id)
  const { data: inboxSyncRuns } = mailboxConnectionId
    ? await admin
        .schema("growth")
        .from("inbox_sync_runs")
        .select("*")
        .eq("mailbox_connection_id", mailboxConnectionId)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: [] as Record<string, unknown>[] }

  let leadMemory: Awaited<ReturnType<typeof fetchLeadMemoryProfileView>> | null = null
  try {
    leadMemory = await fetchLeadMemoryProfileView(admin, leadId)
  } catch {
    leadMemory = null
  }

  return {
    lead: lead as unknown as Record<string, unknown> | null,
    enrollment: enrollment ?? null,
    steps: (steps ?? []) as Record<string, unknown>[],
    jobs: (jobs ?? []) as Record<string, unknown>[],
    jobEvents: (jobEvents ?? []) as Record<string, unknown>[],
    deliveryAttempts,
    transportEvents: (transportEvents ?? []) as Record<string, unknown>[],
    sender: (sender as Record<string, unknown> | null) ?? null,
    provider: (provider as Record<string, unknown> | null) ?? null,
    mailbox: (mailbox as Record<string, unknown> | null) ?? null,
    timelineEvents: (timelineEvents ?? []) as Record<string, unknown>[],
    inboxMessages: (inboxMessages ?? []) as Record<string, unknown>[],
    replyIngestionEvents: (replyIngestionEvents ?? []) as Record<string, unknown>[],
    inboxSyncRuns: (inboxSyncRuns ?? []) as Record<string, unknown>[],
    outboundReplies: (outboundReplies ?? []) as Record<string, unknown>[],
    replyWorkflowActions: (replyWorkflowActions ?? []) as Record<string, unknown>[],
    growthNotifications: (growthNotifications ?? []) as Record<string, unknown>[],
    leadMemory,
  }
}

export async function runGrowthReplyFlowHarness(
  admin: SupabaseClient,
  options: GrowthReplyFlowHarnessOptions = {},
): Promise<GrowthReplyFlowHarnessReport> {
  const step = options.step ?? "all"
  const actingUser: ActingUser =
    options.actingUserId && options.actingUserEmail
      ? { userId: options.actingUserId, email: options.actingUserEmail }
      : await resolveGrowthReplyFlowActingUser(admin)

  const patternKey = options.patternKey?.trim() || process.env.GROWTH_QA_REPLY_FLOW_PATTERN?.trim() || DEFAULT_PATTERN_KEY
  const patternId = await resolvePatternId(admin, patternKey)
  const actions: Record<string, unknown> = {}

  let leadId = options.leadId?.trim() || null

  if (step === "inspect") {
    if (!leadId) {
      const existing = await findHarnessLead(admin, {
        leadId: null,
        companyName: options.companyName,
        fresh: false,
      })
      if (!existing) throw new Error("No QA lead found. Run full harness first or pass --lead-id.")
      leadId = existing.id
    }
    const snapshot = await inspectGrowthReplyFlowLead(admin, leadId)
    return buildGrowthReplyFlowReport(snapshot, {
      requireReply: process.env.GROWTH_QA_REPLY_FLOW_REQUIRE_REPLY === "true",
      actions: { step: "inspect" },
    })
  }

  const shouldCreate = step === "all" || step === "create"
  const shouldEnroll = step === "all" || step === "enroll"
  const shouldScheduler = step === "all" || step === "scheduler"
  const shouldApprove = step === "all" || step === "approve"
  const shouldExecute = (step === "all" || step === "execute") && options.skipExecute !== true
  const shouldInboxSync = step === "all" || step === "inbox-sync"

  if (shouldCreate) {
    const existing = options.fresh
      ? null
      : await findHarnessLead(admin, { leadId, companyName: options.companyName, fresh: false })
    if (existing && !options.fresh) {
      leadId = existing.id
      actions.create = { reused: true, leadId: existing.id, companyName: existing.company_name }
    } else {
      const created = await createGrowthReplyFlowLead(admin, {
        actingUser,
        companyName: options.companyName ?? undefined,
        contactEmail: options.contactEmail,
      })
      leadId = created.leadId
      actions.create = created
    }
  }

  if (!leadId) {
    const existing = await findHarnessLead(admin, { leadId: null, companyName: options.companyName, fresh: false })
    if (!existing) throw new Error("No lead available. Run with --fresh or --step create.")
    leadId = existing.id
  }

  const state: HarnessState = { leadId, companyName: options.companyName ?? "", enrollmentId: null, patternId }

  if (shouldEnroll) {
    const enrolled = await enrollGrowthReplyFlowLead(admin, {
      leadId,
      patternId,
      actingUser,
    })
    state.enrollmentId = enrolled.enrollmentId
    actions.enroll = enrolled
  }

  const enrollmentIdForQa = await resolveHarnessEnrollmentId(admin, {
    leadId,
    enrollmentId: state.enrollmentId,
  })

  if ((shouldEnroll || shouldScheduler) && enrollmentIdForQa) {
    actions.qaAcceleration = await accelerateGrowthReplyFlowEnrollmentStepOne(admin, {
      enrollmentId: enrollmentIdForQa,
      actingUser,
    })
  }

  if (shouldScheduler) {
    actions.scheduler = await runGrowthReplyFlowScheduler(admin, actingUser)
  }

  if (shouldApprove) {
    actions.approve = await approveGrowthReplyFlowStepOne(admin, { leadId, actingUser })
  }

  if (shouldExecute) {
    actions.execute = await executeGrowthReplyFlowApprovedJobs(admin, actingUser)
  }

  if (shouldInboxSync || process.env.GROWTH_QA_REPLY_FLOW_RUN_INBOX_SYNC === "true") {
    actions.inboxSync = await runGrowthReplyFlowInboxSync(admin, actingUser)
  }

  const snapshot = await inspectGrowthReplyFlowLead(admin, leadId)
  return buildGrowthReplyFlowReport(snapshot, {
    requireReply: process.env.GROWTH_QA_REPLY_FLOW_REQUIRE_REPLY === "true",
    actions: { ...actions, step, patternKey, actingUserEmail: actingUser.email },
  })
}
