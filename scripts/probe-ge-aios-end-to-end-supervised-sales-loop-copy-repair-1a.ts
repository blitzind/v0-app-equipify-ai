/**
 * GE-AIOS-END-TO-END-1A PHASE E2 — Production copy repair probe (mutation, no send).
 * Run: CONFIRM_GE_AIOS_END_TO_END_1A_COPY_REPAIR=1 pnpm probe:ge-aios-end-to-end-supervised-sales-loop-copy-repair-1a
 */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID,
  GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-1a-types"
import {
  GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_REPAIRED_EMAIL,
  GE_AIOS_END_TO_END_1A_COPY_REPAIR_CONFIRM_ENV,
  repairSupervisedSalesLoopApprovedEmailCopy,
} from "@/lib/growth/training/end-to-end-supervised-sales-loop-copy-repair-1a"

const PACKAGE_ID =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-16T00:20:44.387Z" as const
const OPERATOR_USER_ID = "f24f76d0-c093-4bb0-a982-292548ee9926" as const

const EVIDENCE_CLASSIFICATION = [
  {
    claim: "Block Imaging supports depot-based refurbishment",
    classification: "strongly_inferred",
    evidence:
      "Prior approved personalization cited refurb + field imaging ops; Block Imaging publicly markets parts/refurbishment services for imaging equipment.",
  },
  {
    claim: "Block Imaging provides field service for medical imaging equipment",
    classification: "verified",
    evidence:
      "Website https://blockimaging.com and package supportingResearch describe field + depot imaging service operations.",
  },
  {
    claim: "Medical imaging equipment service context",
    classification: "verified",
    evidence: "Company website, industry positioning, and research run 63ac44f1-25b0-41ff-8ea7-9db49388db4c.",
  },
  {
    claim: "Dispatch / close-out friction question",
    classification: "weakly_inferred",
    evidence:
      "Conversational hypothesis aligned with equipment-service ICP; framed as a question, not an asserted fact.",
  },
  {
    claim: "Equipify manages customers, assets, field work, service history, and follow-up",
    classification: "verified",
    evidence: "Approved Equipify business profile and canonical seller knowledge capabilities.",
  },
] as const

async function main(): Promise<void> {
  const confirmed = process.env[GE_AIOS_END_TO_END_1A_COPY_REPAIR_CONFIRM_ENV] === "1"
  console.log(`[${GE_AIOS_END_TO_END_SUPERVISED_SALES_LOOP_1A_QA_MARKER}] Phase E2 copy repair probe`)
  console.log(`Copy repair authorized: ${confirmed ? "YES" : "NO"}\n`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    console.error("Bootstrap failed")
    process.exit(1)
  }

  const admin = bootstrap.admin
  const leadId = GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_LEAD_ID

  const [research, runs, killSwitches] = await Promise.all([
    fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
      organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
      leadId,
    }),
    listOutreachPreparationRunsForLead(admin, EQUIPIFY_PRODUCTION_ORG_ID, leadId),
    getRuntimeKillSwitchStates(admin),
  ])

  console.log("=== Evidence classification ===")
  for (const row of EVIDENCE_CLASSIFICATION) {
    console.log(`  [${row.classification.toUpperCase()}] ${row.claim}`)
    console.log(`    ${row.evidence}`)
  }
  console.log(`  Research run: ${research?.researchRunId ?? "none"}`)
  console.log(`  Sample research evidence: ${(research?.evidenceSummary?.verifiedEvidence ?? []).slice(0, 3).join(" | ")}`)

  if (!confirmed) {
    console.log("\nDry run only — set CONFIRM_GE_AIOS_END_TO_END_1A_COPY_REPAIR=1 to apply copy repair.")
    console.log(`Target package: ${PACKAGE_ID}`)
    console.log("\nProposed email:\n")
    console.log(GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_REPAIRED_EMAIL)
    process.exit(0)
  }

  const targetRun = runs.find((run) => run.approvalPackage?.packageId === PACKAGE_ID)
  if (!targetRun?.approvalPackage) {
    console.error("Target package not found")
    process.exit(1)
  }

  const repair = await repairSupervisedSalesLoopApprovedEmailCopy({
    admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    packageId: PACKAGE_ID,
    leadId,
    operatorUserId: OPERATOR_USER_ID,
    emailDraft: GE_AIOS_END_TO_END_1A_BLOCK_IMAGING_REPAIRED_EMAIL,
  })

  const [{ data: job }, { data: outbound }] = await Promise.all([
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, status, channel, requires_human_approval")
      .eq("id", repair.pendingJobId ?? "")
      .maybeSingle(),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, status")
      .eq("lead_id", leadId)
      .limit(5),
  ])

  console.log("\n=== Copy repair result ===")
  console.log(JSON.stringify(repair, null, 2))

  console.log("\n=== Post-repair job state ===")
  console.log(JSON.stringify(job, null, 2))

  console.log("\n=== Final rendered email ===")
  console.log(`Subject: ${repair.renderedEmail.subject ?? "(none)"}`)
  console.log(repair.renderedEmail.body ?? "(none)")

  console.log("\n=== Safety confirmations ===")
  console.log(`  Nothing sent: ${(outbound ?? []).every((row) => row.status !== "sent" && row.status !== "delivered") ? "YES" : "NO"}`)
  console.log(`  Outbound kill switch off: ${killSwitches.autonomy_outbound_enabled === false ? "YES" : "NO"}`)
  console.log(`  Duplicate enrollments: ${repair.duplicateEnrollmentCount}`)
  console.log(`  Duplicate pending jobs: ${repair.duplicatePendingJobCount}`)
  console.log(`  Job action: ${repair.pendingJobAction}`)

  const pass =
    repair.operatorReapproved &&
    repair.pendingJobId != null &&
    repair.duplicateEnrollmentCount <= 1 &&
    repair.duplicatePendingJobCount === 1 &&
    !repair.outboundDelivered &&
    Boolean(repair.renderedEmail.body?.includes("depot-based refurbishment"))

  console.log(`\nVerdict: ${pass ? "PASS" : "FAIL"}`)
  process.exit(pass ? 0 : 2)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
