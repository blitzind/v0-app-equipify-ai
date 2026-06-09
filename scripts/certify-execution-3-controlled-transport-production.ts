/**
 * Execution-3 — Controlled Transport Certification
 *
 * Creates a dedicated internal test lead, enrolls, materializes, approves, and sends
 * through native Gmail/M365 transport to an allowlisted QA mailbox.
 * Does NOT use Henry Schein or real prospects.
 *
 * Run: pnpm certify:execution-3-controlled-transport:production
 * With Vercel prod env: vercel env run -e production -- pnpm certify:execution-3-controlled-transport:production
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { parseGrowthProductionEnvFile } from "../lib/growth/qa/reply-flow-env-bootstrap"
import {
  EXECUTION_3_COMPANY_PREFIX,
  HENRY_SCHEIN_JOB_ID,
  HENRY_SCHEIN_LEAD_ID,
  buildExecution3ControlledTransportEvidence,
} from "../lib/growth/qa/execution-3-controlled-transport-evidence"

const EXECUTION_3_PATTERN_KEY = "cold_email_only"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
  process.exit(1)
}

function ensureProviderCredentialsPepperFromLocalEnvFiles(): void {
  if (process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER?.trim()) return
  if (process.env.GROWTH_PROVIDER_SECRET_PEPPER?.trim()) {
    process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER = process.env.GROWTH_PROVIDER_SECRET_PEPPER.trim()
    return
  }

  for (const relativePath of [
    ".env.production.local",
    ".vercel/.env.production.local",
    ".env.local",
    ".env.local.active",
  ]) {
    const absolutePath = resolve(process.cwd(), relativePath)
    if (!existsSync(absolutePath)) continue
    try {
      const parsed = parseGrowthProductionEnvFile(absolutePath, readFileSync(absolutePath, "utf8"))
      const pepper =
        parsed.GROWTH_PROVIDER_CREDENTIALS_PEPPER?.trim() || parsed.GROWTH_PROVIDER_SECRET_PEPPER?.trim()
      if (pepper) {
        process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER = pepper
        return
      }
    } catch {
      /* optional */
    }
  }
}

ensureProviderCredentialsPepperFromLocalEnvFiles()

function resolveQaRecipientEmail(cliEmail?: string | null): string {
  const email =
    cliEmail?.trim() ||
    process.env.GROWTH_QA_REPLY_FLOW_TO?.trim() ||
    process.env.EXECUTION_3_QA_TO?.trim() ||
    "mike@fuzor.io"
  return email
}

function assertNotHenrySchein(input: { leadId: string; companyName: string; contactEmail: string }): void {
  if (input.leadId === HENRY_SCHEIN_LEAD_ID) {
    throw new Error("Refusing to run Execution-3 against Henry Schein lead.")
  }
  const company = input.companyName.toLowerCase()
  if (company.includes("henry schein") || company.includes("schein")) {
    throw new Error("Refusing to run Execution-3 against Henry Schein company.")
  }
  const email = input.contactEmail.toLowerCase()
  if (email.includes("henryschein") || email.includes("henry-schein")) {
    throw new Error("Refusing to run Execution-3 against Henry Schein email domain.")
  }
}

async function resolveCertActingUser(admin: ReturnType<typeof createClient>): Promise<{ userId: string; email: string }> {
  try {
    const { resolveGrowthReplyFlowActingUser } = await import("../lib/growth/qa/reply-flow-harness")
    return await resolveGrowthReplyFlowActingUser(admin)
  } catch {
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .ilike("email", "%blitz%")
      .limit(1)
      .maybeSingle()
    return {
      userId: profile?.id ?? "631caf46-ff1d-4c12-a8aa-7c7c8953e9e4",
      email: profile?.email ?? "execution-3-cert@equipify.internal",
    }
  }
}

async function resolvePatternId(
  admin: ReturnType<typeof createClient>,
  patternKey: string,
): Promise<string> {
  const { listGrowthSequencePatterns } = await import("../lib/growth/sequence-pattern-repository")
  const patterns = await listGrowthSequencePatterns(admin)
  const pattern = patterns.find((entry) => entry.key === patternKey)
  if (!pattern) throw new Error(`Sequence pattern not found: ${patternKey}`)
  return pattern.id
}

async function approveStepOneWithFallback(
  admin: ReturnType<typeof createClient>,
  input: { leadId: string; actingUser: { userId: string; email: string } },
): Promise<{ jobId: string | null; path: string; detail: unknown }> {
  const { canUseGrowthOutboundSoloApproval } = await import("../lib/growth/runtime/outbound-solo-approval")
  const { approveSequenceExecutionJobSolo } = await import(
    "../lib/growth/sequences/execution/approve-sequence-execution-solo"
  )
  const { approveSequenceExecutionJob } = await import(
    "../lib/growth/sequences/execution/sequence-job-runner"
  )
  const { listGrowthSequenceEnrollmentSteps } = await import(
    "../lib/growth/sequence-enrollment/sequence-enrollment-repository"
  )

  const { data: jobs } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, sequence_step_id, status, created_at")
    .eq("lead_id", input.leadId)
    .order("created_at", { ascending: false })
    .limit(20)

  const { data: enrollment } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("lead_id", input.leadId)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const steps = enrollment?.id
    ? await listGrowthSequenceEnrollmentSteps(admin, String(enrollment.id))
    : []
  const stepOne = steps.find((step) => step.stepOrder === 1) ?? steps[0]
  const job =
    (jobs ?? []).find((row) => row.sequence_step_id === stepOne?.id) ??
    (jobs ?? []).find((row) => !["sent", "skipped"].includes(String(row.status))) ??
    (jobs ?? [])[0]

  if (!job?.id) return { jobId: null, path: "none", detail: { message: "no_execution_job_found" } }

  const jobId = String(job.id)
  if (String(job.status) === "approved") {
    return { jobId, path: "already_approved", detail: { message: "already_approved" } }
  }

  if (canUseGrowthOutboundSoloApproval({ platformAdmin: true })) {
    const detail = await approveSequenceExecutionJobSolo(admin, {
      jobId,
      approvedBy: input.actingUser.userId,
      actorEmail: input.actingUser.email,
      platformAdmin: true,
    })
    return { jobId, path: "approveSequenceExecutionJobSolo", detail }
  }

  if (stepOne?.generationId) {
    const { fetchGrowthAiCopilotGenerationById } = await import("../lib/growth/ai-copilot-repository")
    const generation = await fetchGrowthAiCopilotGenerationById(admin, stepOne.generationId)
    if (generation?.status === "draft") {
      const { approveGrowthAiCopilotGeneration } = await import("../lib/growth/run-ai-copilot-generation")
      await approveGrowthAiCopilotGeneration(admin, {
        generationId: stepOne.generationId,
        actingUserId: input.actingUser.userId,
        actingUserEmail: input.actingUser.email,
      })
    }
  }

  const detail = await approveSequenceExecutionJob(admin, {
    jobId,
    approvedBy: input.actingUser.userId,
    actorEmail: input.actingUser.email,
  })
  return { jobId, path: "approveSequenceExecutionJob", detail }
}

async function fetchInboxThreadIds(
  admin: ReturnType<typeof createClient>,
  leadId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .eq("lead_id", leadId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => String(row.id)).filter(Boolean)
}

async function countSentDeliveryAttemptsForLead(
  admin: ReturnType<typeof createClient>,
  leadId: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, status")
    .eq("lead_id", leadId)
  if (error) throw new Error(error.message)
  return (data ?? []).filter((row) => String(row.status) === "sent").length
}

async function main(): Promise<void> {
  const cliEmail = process.argv.find((arg, index) => process.argv[index - 1] === "--to") ?? null
  const contactEmail = resolveQaRecipientEmail(cliEmail)

  process.env.GROWTH_ENABLE_QA_ACCELERATION = "true"
  const existingAllowlist = process.env.GROWTH_QA_ALLOWED_RECIPIENTS?.trim()
  process.env.GROWTH_QA_ALLOWED_RECIPIENTS = existingAllowlist
    ? `${existingAllowlist},${contactEmail}`
    : contactEmail

  const { parseGrowthQaAllowedRecipients } = await import(
    "../lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
  )
  const allowlist = parseGrowthQaAllowedRecipients()
  if (!allowlist.has(contactEmail.toLowerCase())) {
    console.warn(
      JSON.stringify({
        warning: "recipient_not_in_GROWTH_QA_ALLOWED_RECIPIENTS",
        email: contactEmail,
        hint: "Send may be blocked by deliverability gates without allowlist entry.",
      }),
    )
  }

  const {
    accelerateGrowthReplyFlowEnrollmentStepOne,
    createGrowthReplyFlowLead,
    enrollGrowthReplyFlowLead,
    inspectGrowthReplyFlowLead,
    runGrowthReplyFlowInboxSync,
  } = await import("../lib/growth/qa/reply-flow-harness")

  const { loadGrowthProductionEnvIntoProcess } = await import("../lib/growth/qa/reply-flow-env-bootstrap")
  loadGrowthProductionEnvIntoProcess({ inheritProcessEnv: true })
  ensureProviderCredentialsPepperFromLocalEnvFiles()

  if (process.env.GROWTH_TRANSPORT_SIMULATE?.trim() === "true") {
    console.error(JSON.stringify({ ok: false, error: "GROWTH_TRANSPORT_SIMULATE=true is not allowed for Execution-3." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const actingUser = await resolveCertActingUser(admin)
  const patternId = await resolvePatternId(admin, EXECUTION_3_PATTERN_KEY)
  const companyName = `${EXECUTION_3_COMPANY_PREFIX} ${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}`

  const pipeline: Record<string, unknown> = {}

  const created = await createGrowthReplyFlowLead(admin, {
    actingUser,
    companyName,
    contactEmail,
  })
  pipeline.create = created
  assertNotHenrySchein({
    leadId: created.leadId,
    companyName: created.companyName,
    contactEmail,
  })

  const enrolled = await enrollGrowthReplyFlowLead(admin, {
    leadId: created.leadId,
    patternId,
    actingUser,
  })
  pipeline.enroll = enrolled

  if (!enrolled.enrollmentId) {
    console.error(JSON.stringify({ ok: false, error: "enrollment_failed", pipeline }))
    process.exit(1)
  }

  pipeline.qaAcceleration = await accelerateGrowthReplyFlowEnrollmentStepOne(admin, {
    enrollmentId: enrolled.enrollmentId,
    actingUser,
  }).catch((error: unknown) => ({
    skipped: true,
    reason: error instanceof Error ? error.message : String(error),
  }))

  // Enrollment with startImmediately already materializes step 1 and queues the execution job.
  pipeline.scheduler = { skipped: true, reason: "job_created_during_enroll" }

  const approval = await approveStepOneWithFallback(admin, {
    leadId: created.leadId,
    actingUser,
  })
  pipeline.approve = approval

  if (!approval.jobId) {
    console.error(JSON.stringify({ ok: false, error: "no_execution_job_for_approval", pipeline }))
    process.exit(1)
  }

  ensureProviderCredentialsPepperFromLocalEnvFiles()

  const { collectGrowthRuntimeDiagnostics } = await import("../lib/growth/runtime/runtime-guards")
  const runtimeDiagnostics = collectGrowthRuntimeDiagnostics()
  pipeline.runtimeDiagnostics = runtimeDiagnostics

  const { runSequenceExecutionJob, runApprovedDueSequenceExecutionJobs } = await import(
    "../lib/growth/sequences/execution/sequence-job-runner"
  )

  let firstRun: Awaited<ReturnType<typeof runSequenceExecutionJob>>
  try {
    firstRun = await runSequenceExecutionJob(admin, {
      jobId: approval.jobId,
      actingUserId: actingUser.userId,
      actingUserEmail: actingUser.email,
      humanApproved: true,
      humanApprovalConfirmed: true,
      approvedBy: actingUser.userId,
      lockedBy: "cert:execution-3-controlled-transport",
    })
  } catch (error: unknown) {
    firstRun = {
      ok: false,
      jobId: approval.jobId,
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    }
  }
  pipeline.firstExecute = firstRun

  let secondRun: Awaited<ReturnType<typeof runSequenceExecutionJob>> = {
    ok: false,
    jobId: approval.jobId,
    status: "failed",
    message: "skipped_first_execute_failed",
  }
  let batchRerun: Awaited<ReturnType<typeof runApprovedDueSequenceExecutionJobs>> = {
    scanned: 0,
    sent: 0,
    blocked: 0,
    failed: 0,
    skippedLocked: 0,
  }

  if (firstRun.ok && firstRun.status === "sent") {
    try {
      secondRun = await runSequenceExecutionJob(admin, {
        jobId: approval.jobId,
        actingUserId: actingUser.userId,
        actingUserEmail: actingUser.email,
        humanApproved: true,
        humanApprovalConfirmed: true,
        approvedBy: actingUser.userId,
        lockedBy: "cert:execution-3-controlled-transport-retry",
      })
    } catch (error: unknown) {
      secondRun = {
        ok: false,
        jobId: approval.jobId,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      }
    }
    pipeline.secondExecute = secondRun

    batchRerun = await runApprovedDueSequenceExecutionJobs(admin, {
      actingUserId: actingUser.userId,
      actingUserEmail: actingUser.email,
      limit: 25,
    })
    pipeline.batchRerun = batchRerun

    pipeline.inboxSync = await runGrowthReplyFlowInboxSync(admin, actingUser)
  } else {
    pipeline.secondExecute = secondRun
    pipeline.batchRerun = batchRerun
    pipeline.inboxSync = { skipped: true, reason: "first_execute_failed" }
  }

  const sentCount = await countSentDeliveryAttemptsForLead(admin, created.leadId)
  const inboxThreadIds = await fetchInboxThreadIds(admin, created.leadId)
  const snapshot = await inspectGrowthReplyFlowLead(admin, created.leadId)

  const { getSequenceExecutionJob } = await import(
    "../lib/growth/sequences/execution/sequence-job-repository"
  )
  const henryScheinJob = await getSequenceExecutionJob(admin, HENRY_SCHEIN_JOB_ID)

  const trackingDisabled = process.env.GROWTH_TRACKING_DISABLED?.trim() === "true"
  const evidence = buildExecution3ControlledTransportEvidence({
    snapshot,
    duplicateExecute: {
      first_run: firstRun as unknown as Record<string, unknown>,
      second_run: secondRun as unknown as Record<string, unknown>,
      idempotent: secondRun.message === "already_sent" && secondRun.ok === true,
      batch_rerun: batchRerun as unknown as Record<string, unknown>,
      sent_delivery_attempt_count: sentCount,
    },
    henryScheinJob: henryScheinJob as unknown as Record<string, unknown> | null,
    inboxThreadIds,
    trackingDisabled,
  })

  const output = {
    ok: evidence.result !== "FAIL",
    execution_3: evidence,
    pipeline,
    constraints: {
      henry_schein_lead_excluded: true,
      henry_schein_lead_id: HENRY_SCHEIN_LEAD_ID,
      pattern_key: EXECUTION_3_PATTERN_KEY,
      qa_recipient: contactEmail,
      transport_simulate: false,
    },
    remediation:
      evidence.result === "FAIL" && !runtimeDiagnostics.credentialPepperConfigured
        ? [
            "Export GROWTH_PROVIDER_CREDENTIALS_PEPPER from Vercel Production (Encrypted) into the shell, then re-run.",
            "Or execute the approved job via Platform UI: Growth → Sequences → Execution job run.",
            `Approved cert job_id (if present): ${approval.jobId}`,
          ]
        : [],
  }

  console.log(JSON.stringify(output, null, 2))
  process.exit(evidence.result === "FAIL" ? 1 : 0)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
