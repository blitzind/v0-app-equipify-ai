/**
 * GE-AIOS-END-TO-END-1C.6 — Materialize controlled Production transport-fidelity cert lineage.
 * Run: pnpm prepare:ge-aios-transport-fidelity-1c6-cert
 */
import { randomUUID } from "node:crypto"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  appendAutonomousOutreachPreparationRun,
  findAutonomousOutreachPreparationRunByPackageId,
  listOutreachPreparationRunsForLead,
  markAutonomousOutreachPackageApprovalDecision,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { publishGrowthLeadResearchWorkflowStatus } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { createGrowthLead, fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { freezeOperatorApprovedPackageAssets } from "@/lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence-service"
import { evaluateAvaOutreachExecutionReadinessForPackage } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f"
import { ensureApprovedPackageSequenceHandoffForLead } from "@/lib/growth/mission-center/growth-ava-outreach-sequence-handoff-service-1f"
import {
  fulfillAvaOutreachExecutionRequestViaSequence,
  normalizeRecommendedChannel,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-fulfillment-service"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY,
  type GrowthAvaOutreachExecutionRequest,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"
import { createClient } from "@supabase/supabase-js"

const QA_MARKER = "ge-aios-transport-fidelity-1c6-cert-v1" as const
const CERT_RECIPIENT = "mike@blitzind.com" as const
const CERT_COMPANY = "Blitz Industries (Transport Fidelity Cert)" as const
const APPROVED_SENDER_ACCOUNT_ID = "6966e8bc-5bbc-4d6a-aeb3-3fcdd4c2d720" as const
const CERT_SUBJECT = "GE-AIOS transport fidelity certification" as const
const CERT_BODY =
  "Hi Mike,\n\nThis is a controlled Production certification message for GE-AIOS-END-TO-END-1C transport fidelity validation. Reply if you received the expected subject and sender.\n\nBest,\nAva Sinclair\nEquipify" as const

async function resolveActingUser(admin: ReturnType<typeof createClient>): Promise<{
  userId: string
  email: string
}> {
  const preferredEmail = (getPlatformAdminEmails()[0] ?? CERT_RECIPIENT).trim().toLowerCase()
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  const match = data.users.find((user) => user.email?.trim().toLowerCase() === preferredEmail)
  if (!match?.id) throw new Error(`acting_user_not_found:${preferredEmail}`)
  return { userId: match.id, email: match.email ?? preferredEmail }
}

function buildCertPackage(input: {
  leadId: string
  packageId: string
  preparedAt: string
}): GrowthAutonomousOutreachApprovalPackage {
  const approvedPreview = `Subject: ${CERT_SUBJECT}\n\n${CERT_BODY}`
  return {
    packageId: input.packageId,
    leadId: input.leadId,
    companyName: CERT_COMPANY,
    preparedAt: input.preparedAt,
    generatedAssets: [
      {
        channel: "email",
        label: "Email",
        preview: approvedPreview,
        draftOnly: true,
        generatedPreview: approvedPreview,
        operatorPreview: approvedPreview,
        approvedPreview: null,
        versionStatus: "generated",
      },
    ],
    personalizationEvidence: [
      "GE-AIOS-END-TO-END-1C.6 controlled operator-owned mailbox certification target.",
    ],
    supportingResearch: ["Operator-approved transport fidelity certification — not autonomous outbound."],
    confidence: 0.95,
    approvalRequirements: [],
    complianceNotes: ["Controlled certification — operator-owned recipient only."],
    recommendedChannel: "email",
    recommendedSequence: "email_first_multichannel",
    expectedOutcome: "transport_fidelity_certification",
    pendingHumanApproval: true,
    transportBlocked: true,
    approvedSenderAccountId: APPROVED_SENDER_ACCOUNT_ID,
  }
}

async function main(): Promise<void> {
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) throw new Error("bootstrap_failed")

  process.env.GROWTH_ENGINE_AI_ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
  process.env.GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_ENABLED = "true"

  const admin = bootstrap.admin
  const now = new Date().toISOString()
  const actingUser = await resolveActingUser(admin)

  const { data: existingLeadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("id, contact_email, metadata")
    .eq("contact_email", CERT_RECIPIENT)
    .maybeSingle()

  let leadId = existingLeadRow?.id ?? null
  if (!leadId) {
    const created = await createGrowthLead(admin, {
      companyName: CERT_COMPANY,
      contactEmail: CERT_RECIPIENT,
      contactName: "Mike",
      website: "https://blitzind.com",
      sourceKind: "manual",
      sourceDetail: QA_MARKER,
      status: "new",
      metadata: {
        admission_state: "accepted",
        admission_evaluated_at: now,
        admission_qa_marker: QA_MARKER,
        ge_aios_transport_fidelity_1c6_cert: true,
      },
      createdBy: actingUser.userId,
    })
    leadId = created.id
  } else {
    const lead = await fetchGrowthLeadById(admin, leadId)
    await updateGrowthLead(admin, leadId, {
      promotedOrganizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      metadata: {
        ...(lead?.metadata ?? {}),
        admission_state: "accepted",
        admission_evaluated_at: now,
        admission_qa_marker: QA_MARKER,
        ge_aios_transport_fidelity_1c6_cert: true,
      },
    })
  }

  const researchRunId = randomUUID()
  await publishGrowthLeadResearchWorkflowStatus(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId,
    researchRunId,
    workflowStatus: "qualified",
    qualification: {
      fitScore: 0.92,
      recommendedNextAction: "supervised_outreach",
      recommendedWorkOrderType: null,
      confidence: 0.9,
      reason: QA_MARKER,
      missingEvidence: [],
    },
    evidenceSummary: {
      verifiedEvidence: ["Operator-owned mailbox certification target for transport fidelity 1C.6."],
      missingEvidence: [],
      assumptions: [],
    },
    detail: QA_MARKER,
  })

  await admin
    .schema("growth")
    .from("leads")
    .update({
      promoted_organization_id: EQUIPIFY_PRODUCTION_ORG_ID,
      latest_prospect_research_run_id: researchRunId,
      last_prospect_researched_at: now,
    })
    .eq("id", leadId)

  const packageId = `outreach-prep:${leadId}:${now.replace(/[:.]/g, "-")}`
  const existingRuns = await listOutreachPreparationRunsForLead(admin, EQUIPIFY_PRODUCTION_ORG_ID, leadId)
  const pendingRun = existingRuns.find(
    (run) =>
      run.approvalPackage &&
      !run.approvalPackage.packageApprovalDecision &&
      run.approvalPackage.pendingHumanApproval,
  )

  let resolvedPackageId = pendingRun?.approvalPackage?.packageId ?? packageId
  if (!pendingRun?.approvalPackage) {
    const approvalPackage = buildCertPackage({ leadId, packageId: resolvedPackageId, preparedAt: now })
    const runId = randomUUID()
    await appendAutonomousOutreachPreparationRun({
      admin,
      organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      now,
      run: {
        runId,
        leadId,
        companyName: CERT_COMPANY,
        wakeCondition: "manual_outreach_preparation_request",
        outcome: "completed",
        startedAt: now,
        completedAt: now,
        durationMs: 0,
        packageId: resolvedPackageId,
        workflowType: "growth5f",
        confidence: approvalPackage.confidence,
        skipReason: null,
        blockReason: null,
        revenueOperatorHandoff: QA_MARKER,
        approvalPackage,
      },
    })
  }

  const run = await findAutonomousOutreachPreparationRunByPackageId(
    admin,
    EQUIPIFY_PRODUCTION_ORG_ID,
    resolvedPackageId,
  )
  const pkg = run?.approvalPackage
  if (!pkg) throw new Error("cert_package_missing")

  const readiness = await evaluateAvaOutreachExecutionReadinessForPackage(admin, {
    leadId,
    recommendedSequence: pkg.recommendedSequence,
    recommendedChannel: pkg.recommendedChannel,
  })
  if (!readiness.executionReady) {
    throw new Error(readiness.blockCode ?? "execution_not_ready")
  }

  await freezeOperatorApprovedPackageAssets(admin, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    packageId: resolvedPackageId,
    approvedAt: now,
    operatorUserId: actingUser.userId,
  })

  const requestId = randomUUID()
  let executionRequest: GrowthAvaOutreachExecutionRequest = {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    requestId,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId,
    packageId: resolvedPackageId,
    approvedBy: actingUser.userId,
    approvedAt: now,
    recommendedChannel: normalizeRecommendedChannel(pkg.recommendedChannel),
    recommendedCadence: pkg.recommendedSequence ?? null,
    sequencePatternId: null,
    executionStatus: "pending_fulfillment",
    sequenceJobId: null,
    sequenceEnrollmentId: null,
    sequenceStepId: null,
    fulfillmentError: null,
    fulfilledAt: null,
    retryHistory: [],
  }

  await markAutonomousOutreachPackageApprovalDecision({
    admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    packageId: resolvedPackageId,
    decision: "approved",
    executionRequestId: requestId,
    now,
  })

  const handoff = await ensureApprovedPackageSequenceHandoffForLead(admin, {
    leadId,
    packageId: resolvedPackageId,
    recommendedSequence: pkg.recommendedSequence,
    recommendedChannel: pkg.recommendedChannel,
    executionRequestId: requestId,
  })

  executionRequest = {
    ...executionRequest,
    sequencePatternId: handoff.patternId,
  }

  executionRequest = await fulfillAvaOutreachExecutionRequestViaSequence(admin, {
    request: executionRequest,
    actingUserId: actingUser.userId,
    actingUserEmail: actingUser.email,
    sequencePatternId: handoff.patternId,
  })

  const leadAfter = await fetchGrowthLeadById(admin, leadId)
  const existingRequests =
    leadAfter?.metadata &&
    typeof leadAfter.metadata === "object" &&
    leadAfter.metadata[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY] &&
    typeof leadAfter.metadata[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY] === "object"
      ? (leadAfter.metadata[GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY] as Record<
          string,
          GrowthAvaOutreachExecutionRequest
        >)
      : {}

  await updateGrowthLead(admin, leadId, {
    metadata: {
      ...(leadAfter?.metadata ?? {}),
      [GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_METADATA_KEY]: {
        ...existingRequests,
        [requestId]: executionRequest,
      },
    },
  })

  const jobId = executionRequest.sequenceJobId ?? null

  const job = jobId
    ? (
        await admin
          .schema("growth")
          .from("sequence_execution_jobs")
          .select("*")
          .eq("id", jobId)
          .maybeSingle()
      ).data
    : null

  console.log(
    JSON.stringify(
      {
        qaMarker: QA_MARKER,
        selectedTarget: {
          recipient: CERT_RECIPIENT,
          companyName: CERT_COMPANY,
          leadId,
          rationale: "operator_owned_mailbox",
        },
        executionRequestId: executionRequest?.requestId ?? null,
        packageId: resolvedPackageId,
        executionJobId: jobId,
        transportSnapshotId: job?.transport_snapshot_id ?? null,
        approvedSenderAccountId: job?.approved_sender_account_id ?? job?.manual_sender_account_id ?? null,
        allowAutoRotation: job?.allow_auto_rotation ?? null,
        jobStatus: job?.status ?? null,
        enrollmentId: executionRequest?.sequenceEnrollmentId ?? null,
        fulfillmentError: executionRequest?.fulfillmentError ?? null,
        executionStatus: executionRequest?.executionStatus ?? null,
      },
      null,
      2,
    ),
  )

  if (!jobId || job?.status !== "pending_approval" || !job.transport_snapshot_id) {
    console.error("Cert lineage incomplete — inspect fulfillmentError and job row.")
    process.exit(2)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
