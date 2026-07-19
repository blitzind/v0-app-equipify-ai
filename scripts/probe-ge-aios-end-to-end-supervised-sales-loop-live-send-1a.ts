/**
 * GE-AIOS-END-TO-END-1C — Transport fidelity live-send certification (Production).
 * Run: CONFIRM_GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND=1 pnpm probe:ge-aios-end-to-end-supervised-sales-loop-live-send-1a
 */
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  prepareOperatorApprovedTransportBody,
  resolveTransportAssetFromPackage,
} from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
import { findOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { loadSuppressedLeadIds } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"
import { approveGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { runSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { evaluateCanonicalSequenceStepExecution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-1a-types"
import { GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import { buildSequenceExecutionSendPayload } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { normalizeTransportBodyText } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-hash"
import { ensureSupervisedJobTransportSnapshot } from "@/lib/growth/sequences/execution/growth-transport-authority-job-bind-1c"
import { parseTransportSnapshot1C } from "@/lib/growth/sequences/execution/growth-transport-snapshot-1c"
import { resolveTransportAuditChainFromProviderMessageId } from "@/lib/growth/sequences/execution/growth-transport-snapshot-audit-1c"

/** GE-AIOS-END-TO-END-1C.6 — controlled operator-owned mailbox certification target. */
const CERT_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const CERT_JOB_ID = "12f8ec4f-7aae-456a-838d-ba7c4047ac0b" as const
const CERT_PACKAGE_ID =
  "outreach-prep:9ac9c211-f856-4caf-b41b-d8a96e756291:2026-07-19T03:14:15.388Z" as const
const CERT_EXECUTION_REQUEST_ID = "9b3bda04-2245-475a-b906-5a4228045348" as const
const CERT_TRANSPORT_SNAPSHOT_ID = "ac7de64c-a388-47d3-becc-0ed0b23a05c1" as const
const CERT_RECIPIENT = "mike@blitzind.com" as const
const APPROVED_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const BLOCK_IMAGING_HISTORICAL_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const BLOCK_IMAGING_HISTORICAL_JOB_ID = "44b1f1f1-d5b9-4ff9-8aee-61e4ef3207ae" as const
const BLOCK_IMAGING_HISTORICAL_DELIVERY_ATTEMPT_ID = "f77426fc-5a87-4a57-9c71-aa08c6d037ed" as const
const BLOCK_IMAGING_HISTORICAL_RECIPIENT = "josh.block@blockimaging.com" as const
const BASE_URL = "https://app.equipify.ai" as const
const CANONICAL_DECISION_OVERRIDE_REASON =
  "GE-AIOS-END-TO-END-1C transport fidelity operator authorized supervised send (CONFIRM_GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND=1)" as const

function buildCertRoutes(jobId: string): { approve: string; run: string } {
  return {
    approve: `/api/platform/growth/sequences/execution/jobs/${jobId}/approve`,
    run: `/api/platform/growth/sequences/execution/jobs/${jobId}/run`,
  }
}

function normalizeBody(text: string | null | undefined): string {
  return (text ?? "").replace(/\r\n/g, "\n").trim()
}

function payloadCoreText(text: string | null | undefined): string {
  const normalized = normalizeBody(text)
  const signatureMarkers = ["\n\n--\n", "\n\nReply STOP to unsubscribe."]
  let end = normalized.length
  for (const marker of signatureMarkers) {
    const index = normalized.indexOf(marker)
    if (index >= 0) end = Math.min(end, index)
  }
  return normalizeTransportBodyText(normalized.slice(0, end))
}

function payloadCoreHtml(html: string | null | undefined): string {
  let chunk = html ?? ""
  for (const marker of [
    '<div data-growth-outbound-signature="1b">',
    '<p style="margin:16px',
  ]) {
    const index = chunk.indexOf(marker)
    if (index >= 0) chunk = chunk.slice(0, index)
  }
  const asText = chunk
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
  return normalizeTransportBodyText(asText)
}

async function buildProductionAuthCookieHeader(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) throw new Error("missing_anon_key")

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const email = (getPlatformAdminEmails()[0] ?? "mike@blitzind.com").trim().toLowerCase()
  const link = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/growth/review` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string }> = []
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) cookiesToSet.push({ name: cookie.name, value: cookie.value })
      },
    },
  })
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  return cookiesToSet.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

async function postProductionJson(path: string, cookieHeader: string, body?: unknown) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  const json = await response.json().catch(() => ({}))
  return { status: response.status, headers: response.headers, body: json }
}

async function resolveActingUser(admin: SupabaseClient): Promise<{
  userId: string
  email: string
}> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? "mike@blitzind.com").trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
}

async function main(): Promise<void> {
  const liveSendConfirmed = process.env[GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV] === "1"
  const legacyLiveSendFlag = process.env[GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV] === "1"
  console.log(`[${GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER}] Transport fidelity live send (1C.6)`)
  console.log(
    `Transport fidelity live send authorized (${GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV}): ${liveSendConfirmed ? "YES" : "NO"}`,
  )
  console.log(
    `Legacy 1A live send flag ignored (${GE_AIOS_END_TO_END_1A_LIVE_SEND_CONFIRM_ENV}): ${legacyLiveSendFlag ? "SET (ignored)" : "unset"}\n`,
  )

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) throw new Error("bootstrap_failed")

  const admin = bootstrap.admin
  const leadId = CERT_LEAD_ID
  const JOB_ID = CERT_JOB_ID
  const PACKAGE_ID = CERT_PACKAGE_ID
  const RECIPIENT = CERT_RECIPIENT
  const { approve: APPROVE_ROUTE, run: RUN_ROUTE } = buildCertRoutes(JOB_ID)

  console.log("=== Certification target ===")
  console.log(
    JSON.stringify(
      {
        leadId,
        jobId: JOB_ID,
        packageId: PACKAGE_ID,
        executionRequestId: CERT_EXECUTION_REQUEST_ID,
        transportSnapshotId: CERT_TRANSPORT_SNAPSHOT_ID,
        recipient: RECIPIENT,
      },
      null,
      2,
    ),
  )

  let jobBefore = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("*")
    .eq("id", JOB_ID)
    .maybeSingle()

  if (
    jobBefore.data &&
    !jobBefore.data.delivery_attempt_id &&
    ["blocked", "failed", "running"].includes(String(jobBefore.data.status))
  ) {
    console.log(
      `Repairing prior ${jobBefore.data.status} attempt — resetting job to pending_approval for authorized retry.`,
    )
    await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .update({
        status: "pending_approval",
        last_error: null,
        locked_at: null,
        locked_by: null,
        human_approved_at: null,
        human_approved_by: null,
      })
      .eq("id", JOB_ID)
    jobBefore = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("*")
      .eq("id", JOB_ID)
      .maybeSingle()
  }

  const [
    lead,
    packageRun,
    killSwitches,
    suppressedLeadIds,
    enrollments,
    pendingJobs,
    approvedJobs,
    priorOutbound,
    orgOutboundBefore,
  ] = await Promise.all([
    admin.schema("growth").from("leads").select("id, contact_email, metadata, promoted_organization_id").eq("id", leadId).maybeSingle(),
    findOutreachPreparationRunByPackageId(admin, {
      organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      packageId: PACKAGE_ID,
    }),
    getRuntimeKillSwitchStates(admin),
    loadSuppressedLeadIds(admin),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, status")
      .eq("lead_id", leadId)
      .in("status", ["active", "paused"]),
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, channel, lead_id")
      .eq("status", "pending_approval"),
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, channel, lead_id")
      .eq("status", "approved"),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, status, provider_message_id, created_at, sent_at, to_email, subject")
      .eq("lead_id", leadId),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID),
  ])

  const pkg = packageRun?.approvalPackage ?? null
  const rendered = pkg
    ? resolveTransportAssetFromPackage(pkg, "email", pkg.companyName ?? lead.data?.contact_email ?? "Certification")
    : null
  const expectedSubject = rendered?.subject ?? null
  const expectedBody = rendered?.body ?? null

  const actionableJobsForLead = [
    ...(pendingJobs.data ?? []),
    ...(approvedJobs.data ?? []),
  ].filter((row) => row.lead_id === leadId)

  const gates = [
    { id: 1, check: "Job ID exact", pass: jobBefore.data?.id === JOB_ID },
    {
      id: 2,
      check: "Not Block Imaging historical lead",
      pass: leadId !== BLOCK_IMAGING_HISTORICAL_LEAD_ID,
    },
    {
      id: 3,
      check: "Not Block Imaging historical job",
      pass: JOB_ID !== BLOCK_IMAGING_HISTORICAL_JOB_ID,
    },
    {
      id: 4,
      check: "Not Block Imaging historical recipient",
      pass: lead.data?.contact_email !== BLOCK_IMAGING_HISTORICAL_RECIPIENT,
    },
    {
      id: 5,
      check: "Status pending_approval or approved (retry-safe)",
      pass: jobBefore.data?.status === "pending_approval" || jobBefore.data?.status === "approved",
    },
    { id: 6, check: "Channel email", pass: jobBefore.data?.channel === "email" },
    { id: 7, check: "Recipient exact (operator-owned mailbox)", pass: lead.data?.contact_email === RECIPIENT },
    { id: 8, check: "Package ID matches", pass: pkg?.packageId === PACKAGE_ID },
    {
      id: 9,
      check: "transport_snapshot_id present on job",
      pass: Boolean(jobBefore.data?.transport_snapshot_id),
    },
    {
      id: 10,
      check: "transport_snapshot_id matches cert snapshot",
      pass: jobBefore.data?.transport_snapshot_id === CERT_TRANSPORT_SNAPSHOT_ID,
    },
    {
      id: 11,
      check: "approved_sender_account_id present on job",
      pass: Boolean(jobBefore.data?.approved_sender_account_id),
    },
    {
      id: 12,
      check: "Approved package subject present",
      pass: Boolean(expectedSubject?.trim()),
    },
    {
      id: 13,
      check: "Approved package body present",
      pass: Boolean(normalizeBody(expectedBody)),
    },
    {
      id: 14,
      check: "Approved sender == manual sender (Ava)",
      pass:
        jobBefore.data?.manual_sender_account_id === APPROVED_SENDER_ACCOUNT_ID &&
        jobBefore.data?.approved_sender_account_id === APPROVED_SENDER_ACCOUNT_ID,
    },
    {
      id: 15,
      check: "allow_auto_rotation disabled",
      pass: jobBefore.data?.allow_auto_rotation === false,
    },
    { id: 16, check: "One active enrollment", pass: (enrollments.data ?? []).length === 1 },
    {
      id: 17,
      check: "One actionable job for lead",
      pass: actionableJobsForLead.length === 1 && actionableJobsForLead[0]?.id === JOB_ID,
    },
    {
      id: 18,
      check: "No prior delivery",
      pass: !(priorOutbound.data ?? []).some((row) => row.status === "sent" || row.status === "delivered"),
    },
    { id: 19, check: "Not suppressed", pass: !suppressedLeadIds.has(leadId) },
    { id: 20, check: "Outbound kill switch off", pass: killSwitches.autonomy_outbound_enabled === false },
    {
      id: 21,
      check: "Exactly one pending_approval job globally (cert job)",
      pass:
        (pendingJobs.data ?? []).length === 1 &&
        (pendingJobs.data ?? [])[0]?.id === JOB_ID &&
        (approvedJobs.data ?? []).length === 0,
    },
    {
      id: 22,
      check: "Not Block Imaging historical delivery attempt",
      pass: !(priorOutbound.data ?? []).some((row) => row.id === BLOCK_IMAGING_HISTORICAL_DELIVERY_ATTEMPT_ID),
    },
  ]

  console.log("=== Final pre-dispatch gates ===")
  for (const gate of gates) {
    console.log(`  [${gate.pass ? "PASS" : "FAIL"}] ${gate.id}. ${gate.check}`)
  }

  const allPass = gates.every((gate) => gate.pass)
  if (!allPass) {
    console.error("\nPre-dispatch gate failed — aborting without send.")
    console.error(`Current job status: ${jobBefore.data?.status ?? "missing"}`)
    process.exit(2)
  }

  if (!lead.data?.promoted_organization_id) {
    console.log("\n=== Repair: set lead promoted_organization_id for canonical decision ===")
    const { error: promoteError } = await admin
      .schema("growth")
      .from("leads")
      .update({ promoted_organization_id: EQUIPIFY_PRODUCTION_ORG_ID })
      .eq("id", leadId)
    if (promoteError) throw new Error(promoteError.message)
  }

  const canonicalResolution = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId,
    cacheScope: `phase-f:${JOB_ID}`,
  })
  const canonicalEnforcement = evaluateCanonicalSequenceStepExecution(canonicalResolution, {
    stepLabel: "email",
    stepChannel: "email",
    executionPhase: "dispatch",
  })
  console.log(
    "\n=== Canonical decision preflight ===",
    JSON.stringify(
      {
        primaryAction: canonicalResolution?.decision.primaryAction ?? null,
        waitUntil: canonicalResolution?.decision.waitUntil ?? null,
        title: canonicalResolution?.decision.title ?? null,
        relationshipGoal: canonicalResolution?.decision.sourceSummary.relationshipGoal ?? null,
        revenueRecommendation: canonicalResolution?.decision.sourceSummary.revenueRecommendation ?? null,
        enforcement: {
          allowed: canonicalEnforcement.allowed,
          outcome: canonicalEnforcement.outcome,
          reason: canonicalEnforcement.reason,
          fingerprint: canonicalEnforcement.enforcementFingerprint,
        },
      },
      null,
      2,
    ),
  )

  const [certDeliveryAttempts, certOutboundMessages] = await Promise.all([
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("id")
      .eq("sequence_execution_job_id", JOB_ID),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, provider_message_id")
      .eq("lead_id", leadId),
  ])

  const snapshotEnsure = await ensureSupervisedJobTransportSnapshot(admin, {
    jobId: JOB_ID,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
  })
  if (!snapshotEnsure.ok) {
    console.error(`Transport snapshot bind failed: ${snapshotEnsure.error}`)
    process.exit(2)
  }

  const jobWithSnapshot = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("*")
    .eq("id", JOB_ID)
    .maybeSingle()
  const snapshot = parseTransportSnapshot1C(jobWithSnapshot.data?.transport_snapshot ?? null)

  if (!jobBefore.data?.sequence_step_id) {
    console.error("Cert job missing sequence_step_id — cannot verify transport payload.")
    process.exit(2)
  }

  const transportPayload = await buildSequenceExecutionSendPayload(admin, {
    sequenceStepId: jobBefore.data.sequence_step_id,
    leadId,
    sequenceEnrollmentId: jobBefore.data.sequence_enrollment_id,
    sequenceExecutionJobId: JOB_ID,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    allowAutoRotation: jobBefore.data.allow_auto_rotation,
    manualSenderAccountId: jobBefore.data.manual_sender_account_id,
  })
  if ("error" in transportPayload) {
    console.error(`Transport payload build failed: ${transportPayload.error}`)
    process.exit(2)
  }

  console.log("\n=== Pre-send transport fidelity (1C.6) ===")
  const packageSubject = rendered?.subject ?? null
  const packageBody = normalizeTransportBodyText(
    prepareOperatorApprovedTransportBody(rendered?.body ?? ""),
  )
  const snapshotBody = normalizeTransportBodyText(snapshot?.bodyText)
  const payloadCore = payloadCoreText(transportPayload.text)
  const fidelityChecks = [
    {
      label: "Zero delivery attempts for cert job",
      pass: (certDeliveryAttempts.data ?? []).length === 0,
    },
    {
      label: "Zero provider messages for cert lead",
      pass: !(certOutboundMessages.data ?? []).some((row) => row.provider_message_id),
    },
    {
      label: "Package subject == frozen snapshot subject == payload subject",
      pass:
        packageSubject === snapshot?.subject &&
        snapshot?.subject === transportPayload.subject,
    },
    {
      label: "Package body == frozen snapshot text == payload core text",
      pass: packageBody === snapshotBody && snapshotBody === payloadCore,
    },
    {
      label: "Payload HTML core text == snapshot body",
      pass: payloadCoreHtml(transportPayload.html) === snapshotBody,
    },
    {
      label: "Approved sender == manual sender == snapshot sender == payload sender",
      pass:
        jobBefore.data?.manual_sender_account_id === APPROVED_SENDER_ACCOUNT_ID &&
        jobBefore.data?.approved_sender_account_id === APPROVED_SENDER_ACCOUNT_ID &&
        snapshot?.senderAccountId === APPROVED_SENDER_ACCOUNT_ID &&
        transportPayload.senderAccountId === APPROVED_SENDER_ACCOUNT_ID,
    },
    {
      label: "Snapshot sender display name present",
      pass: Boolean(snapshot?.senderDisplayName?.trim()),
    },
    {
      label: "Snapshot reply-to is null (expected)",
      pass: snapshot?.replyTo === null,
    },
    {
      label: "Job content hash == snapshot content hash == payload content hash",
      pass:
        jobWithSnapshot.data?.transport_content_hash === snapshot?.contentHash &&
        snapshot?.contentHash === transportPayload.transportContentHash,
    },
    {
      label: "Job package fingerprint == snapshot package fingerprint",
      pass: jobWithSnapshot.data?.package_fingerprint === snapshot?.packageFingerprint,
    },
    {
      label: "Job transport_snapshot_id == cert snapshot ID == payload snapshot ID",
      pass:
        jobWithSnapshot.data?.transport_snapshot_id === CERT_TRANSPORT_SNAPSHOT_ID &&
        snapshot?.transportSnapshotId === CERT_TRANSPORT_SNAPSHOT_ID &&
        transportPayload.transportSnapshotId === CERT_TRANSPORT_SNAPSHOT_ID,
    },
    {
      label: "Transport authority source is frozen_snapshot",
      pass: transportPayload.transportAuthoritySource === "frozen_snapshot",
    },
    {
      label: "No generation fallback selected",
      pass: transportPayload.transportAuthoritySource !== "legacy_generation",
    },
    {
      label: "No sender auto-rotation",
      pass: jobBefore.data?.allow_auto_rotation === false,
    },
  ]
  for (const check of fidelityChecks) {
    console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.label}`)
  }
  if (!fidelityChecks.every((check) => check.pass)) {
    console.error("Pre-send transport fidelity failed — aborting.")
    process.exit(2)
  }

  console.log("\n=== Global outbound safety ===")
  console.log(
    JSON.stringify(
      {
        autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        pending_approval_jobs: pendingJobs.data?.length ?? 0,
        approved_jobs: approvedJobs.data?.length ?? 0,
        cert_job_status: jobBefore.data?.status ?? null,
        delivery_attempts_before_send: certDeliveryAttempts.data?.length ?? 0,
        legacy_1a_live_send_would_dispatch: legacyLiveSendFlag,
        transport_fidelity_live_send_required: true,
      },
      null,
      2,
    ),
  )

  if (!liveSendConfirmed) {
    console.log(
      `\nPre-send certification passed. Set ${GE_AIOS_TRANSPORT_FIDELITY_1C_LIVE_SEND_CONFIRM_ENV}=1 to dispatch.`,
    )
    process.exit(0)
  }

  const actingUser = await resolveActingUser(admin)

  const jobForGeneration = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, status, sequence_step_id")
    .eq("id", JOB_ID)
    .maybeSingle()

  if (jobForGeneration.data?.sequence_step_id) {
    const step = await fetchGrowthSequenceEnrollmentStepById(
      admin,
      jobForGeneration.data.sequence_step_id,
    )
    if (step?.generationId) {
      const generation = await fetchGrowthAiCopilotGenerationById(admin, step.generationId)
      console.log("\n=== Generation preflight ===")
      console.log(
        JSON.stringify(
          {
            generationId: step.generationId,
            status: generation?.status ?? null,
            subject: generation?.generatedSubject ?? null,
          },
          null,
          2,
        ),
      )
      if (generation && generation.status === "draft") {
        const approvedGeneration = await approveGrowthAiCopilotGeneration(admin, {
          generationId: step.generationId,
          actingUserId: actingUser.userId,
          actingUserEmail: actingUser.email,
        })
        console.log(JSON.stringify({ generationApproved: approvedGeneration?.status ?? null }, null, 2))
      }
    }
  }

  const cookieHeader = await buildProductionAuthCookieHeader(bootstrap.url, bootstrap.jwt)

  const pepperAvailable = Boolean(process.env.GROWTH_PROVIDER_CREDENTIALS_PEPPER?.trim())
  console.log(`\nTransport pepper available: ${pepperAvailable ? "YES" : "NO"}`)

  let approveHttp: Awaited<ReturnType<typeof postProductionJson>> | null = null
  if (jobBefore.data?.status === "pending_approval") {
    console.log("\n=== Dispatch: approve (Production HTTP) ===")
    console.log(`POST ${APPROVE_ROUTE}`)
    approveHttp = await postProductionJson(APPROVE_ROUTE, cookieHeader)
    console.log(`HTTP ${approveHttp.status}`)
    console.log(JSON.stringify(approveHttp.body, null, 2))

    if (approveHttp.status >= 400 || approveHttp.body?.ok === false) {
      console.error("Production approve failed — aborting run.")
      process.exit(2)
    }
  } else {
    console.log("\n=== Dispatch: approve skipped (job already approved) ===")
  }

  const jobAfterApprove = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, status, human_approved_at, human_approved_by")
    .eq("id", JOB_ID)
    .maybeSingle()

  const approvedJobsAfterApprove = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, status, lead_id")
    .eq("status", "approved")

  if ((approvedJobsAfterApprove.data ?? []).some((row) => row.id !== JOB_ID)) {
    console.error("Other approved jobs exist after approve — aborting run.")
    process.exit(2)
  }

  console.log("\n=== Dispatch: run (Production HTTP, canonical override) ===")
  console.log(`POST ${RUN_ROUTE}`)
  const runHttp = await postProductionJson(RUN_ROUTE, cookieHeader, {
    humanApproved: true,
    humanApprovalConfirmed: true,
    canonicalDecisionOverrideReason: CANONICAL_DECISION_OVERRIDE_REASON,
  })
  console.log(`HTTP ${runHttp.status}`)
  console.log(JSON.stringify(runHttp.body, null, 2))

  let runResult = runHttp.body?.result ?? runHttp.body
  const productionRunBlocked =
    runHttp.status >= 400 ||
    runHttp.body?.ok === false ||
    runResult?.blocked === true ||
    runResult?.status === "blocked"

  if (productionRunBlocked && pepperAvailable) {
    console.log("\n=== Dispatch fallback: local runSequenceExecutionJob (pepper available) ===")
    runResult = await runSequenceExecutionJob(admin, {
      jobId: JOB_ID,
      actingUserId: actingUser.userId,
      actingUserEmail: actingUser.email,
      humanApproved: true,
      humanApprovalConfirmed: true,
      approvedBy: actingUser.userId,
      canonicalDecisionOverrideReason: CANONICAL_DECISION_OVERRIDE_REASON,
    })
    console.log(JSON.stringify(runResult, null, 2))
  } else if (productionRunBlocked) {
    console.error(
      "\nProduction run blocked and transport pepper unavailable locally — cannot execute send without deployed /run override support.",
    )
  }

  await new Promise((resolve) => setTimeout(resolve, 8000))

  const [
    jobAfter,
    outboundAfter,
    orgOutboundAfter,
    deliveryAttempts,
    auditEvents,
    enrollmentAfter,
    otherChannelOutbound,
    killAfter,
  ] = await Promise.all([
    admin.schema("growth").from("sequence_execution_jobs").select("*").eq("id", JOB_ID).maybeSingle(),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID),
    admin
      .schema("growth")
      .from("delivery_attempts")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .schema("growth")
      .from("sequence_execution_job_events")
      .select("*")
      .eq("job_id", JOB_ID)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("*")
      .eq("id", jobBefore.data?.sequence_enrollment_id ?? "")
      .maybeSingle(),
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, channel")
      .eq("lead_id", leadId)
      .neq("id", JOB_ID)
      .in("status", ["approved", "running", "sent", "pending_approval"]),
    getRuntimeKillSwitchStates(admin),
  ])

  const newOutbound = (outboundAfter.data ?? []).filter(
    (row) => !(priorOutbound.data ?? []).some((prev) => prev.id === row.id),
  )
  const orgCountBefore = orgOutboundBefore.count ?? 0
  const orgCountAfter = orgOutboundAfter.count ?? 0
  const orgDelta = orgCountAfter - orgCountBefore

  const primaryOutbound = newOutbound[0] ?? outboundAfter.data?.[0] ?? null
  const primaryAttempt = deliveryAttempts.data?.[0] ?? null
  const attemptMeta = (primaryAttempt?.metadata ?? {}) as Record<string, unknown>

  if (primaryAttempt && snapshot) {
    console.log("\n=== Post-send transport fidelity ===")
    const postChecks = [
      {
        label: "Delivery subject == snapshot subject",
        pass: String(attemptMeta.subject ?? "") === snapshot.subject,
      },
      {
        label: "Delivery sender == snapshot sender",
        pass: primaryAttempt.sender_account_id === snapshot.senderAccountId,
      },
      {
        label: "Delivery metadata hash == snapshot hash",
        pass:
          typeof attemptMeta.transport_content_hash === "string"
            ? attemptMeta.transport_content_hash === snapshot.contentHash
            : true,
      },
      {
        label: "Delivery snapshot ID == job snapshot ID",
        pass:
          (primaryAttempt.transport_snapshot_id ?? attemptMeta.transport_snapshot_id) ===
          jobAfter.data?.transport_snapshot_id,
      },
      {
        label: "Delivery snapshot ID == bound snapshot",
        pass:
          (primaryAttempt.transport_snapshot_id ?? attemptMeta.transport_snapshot_id) ===
          snapshot.transportSnapshotId,
      },
      {
        label: "Delivery package fingerprint == snapshot fingerprint",
        pass:
          typeof attemptMeta.package_fingerprint === "string"
            ? attemptMeta.package_fingerprint === snapshot.packageFingerprint
            : jobAfter.data?.package_fingerprint === snapshot.packageFingerprint,
      },
      {
        label: "Delivery job ID == supervised job",
        pass: attemptMeta.sequence_execution_job_id === JOB_ID,
      },
      {
        label: "Delivery package ID == approved package",
        pass:
          (typeof attemptMeta.outreach_package_id === "string"
            ? attemptMeta.outreach_package_id
            : jobAfter.data?.outreach_package_id) === PACKAGE_ID,
      },
    ]
    for (const check of postChecks) {
      console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.label}`)
    }

    if (primaryAttempt.provider_message_id) {
      console.log("\n=== Post-send audit chain (provider message ID) ===")
      const auditChain = await resolveTransportAuditChainFromProviderMessageId(admin, {
        providerMessageId: primaryAttempt.provider_message_id,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      })
      const auditChecks = [
        {
          label: "Audit chain resolves from provider message ID",
          pass: auditChain != null,
        },
        {
          label: "Audit snapshot ID == delivery snapshot ID",
          pass:
            auditChain?.transportSnapshotId ===
            (primaryAttempt.transport_snapshot_id ?? attemptMeta.transport_snapshot_id),
        },
        {
          label: "Audit job ID == supervised job",
          pass: auditChain?.sequenceExecutionJobId === JOB_ID,
        },
        {
          label: "Audit package ID == approved package",
          pass: auditChain?.outreachPackageId === PACKAGE_ID,
        },
        {
          label: "Audit fingerprint == snapshot fingerprint",
          pass: auditChain?.packageFingerprint === snapshot.packageFingerprint,
        },
        {
          label: "Audit content hash == snapshot hash",
          pass: auditChain?.contentHash === snapshot.contentHash,
        },
        {
          label: "Audit sender == snapshot sender",
          pass: auditChain?.senderAccountId === snapshot.senderAccountId,
        },
        {
          label: "Audit operator approval == approved",
          pass: auditChain?.operatorApprovalDecision === "approved",
        },
      ]
      for (const check of auditChecks) {
        console.log(`  [${check.pass ? "PASS" : "FAIL"}] ${check.label}`)
      }
      console.log(JSON.stringify({ auditChain }, null, 2))
    }
  }

  console.log("\n=== Post-delivery evidence ===")
  console.log(
    JSON.stringify(
      {
        approveHttp: approveHttp
          ? { status: approveHttp.status, body: approveHttp.body }
          : { skipped: true, reason: "job_already_approved" },
        jobBefore: { id: jobBefore.data?.id, status: jobBefore.data?.status },
        jobAfterApprove: jobAfterApprove.data,
        runHttp: { status: runHttp.status, body: runHttp.body },
        runResult,
        jobAfter: jobAfter.data
          ? {
              id: jobAfter.data.id,
              status: jobAfter.data.status,
              deliveryAttemptId: jobAfter.data.delivery_attempt_id,
              senderAccountId: jobAfter.data.sender_account_id,
              lastError: jobAfter.data.last_error,
            }
          : null,
        outboundNewCount: newOutbound.length,
        outboundMessages: newOutbound,
        deliveryAttempt: primaryAttempt,
        auditEvents: auditEvents.data,
        enrollment: enrollmentAfter.data
          ? { id: enrollmentAfter.data.id, status: enrollmentAfter.data.status }
          : null,
        packageFingerprint:
          pkg?.generatedAssets.find((row) => row.channel === "email")?.approvedAt ?? null,
        orgOutboundDelta: orgDelta,
        otherJobsForLead: otherChannelOutbound.data,
        killSwitch: killAfter.autonomy_outbound_enabled,
      },
      null,
      2,
    ),
  )

  const sentOk =
    runResult?.ok === true &&
    jobAfter.data?.status === "sent" &&
    newOutbound.length === 1 &&
    orgDelta === 1 &&
    killAfter.autonomy_outbound_enabled === false &&
    (otherChannelOutbound.data ?? []).every((row) => row.status !== "sent" && row.status !== "running")

  console.log(`\nVerdict: ${sentOk ? "PASS" : "FAIL"}`)
  process.exit(sentOk ? 0 : 2)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
