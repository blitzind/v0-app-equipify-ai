/**
 * GE-AIOS-REVENUE-2H/2I — SV1-5 investment gate production certification (read-only).
 *
 * Run:
 *   pnpm validate:ge-aios-revenue-2h-investment-gate-production
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  GE_AIOS_REVENUE_2H_INVESTMENT_GATE_QA_MARKER,
  isBillableDraftingAuthorized,
} from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import { evaluateGrowthPipelinePromotionIntegrity } from "@/lib/growth/draft-factory/growth-pipeline-promotion-integrity-2a"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { VERCEL_PRODUCTION_ENV_RUN_QA_MARKER } from "./vercel-production-env-run"

export const GE_AIOS_REVENUE_2H_PRODUCTION_VALIDATION_QA_MARKER =
  "ge-aios-revenue-2h-investment-gate-production-v1" as const

const PHASE = "GE-AIOS-REVENUE-2I" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

const PACKAGE_DOWNSTREAM_STATES = new Set([
  "waiting_for_personalization",
  "waiting_for_generation",
  "draft_ready",
  "waiting_for_approval",
])

type Sv11Projection = {
  investmentState: string
  spendAuthorized: boolean
  billableAuthorized: boolean
  qualificationRecommendation: string | null
  evidenceConfidence: number | null
  reason: string
}

type WaitingRowAudit = {
  leadId: string
  companyName: string | null
  admissionState: string | null
  dfState: string
  earliestIncompleteStage: string | null
  sv11: Sv11Projection
  authorized: boolean
}

function readWorkspaceSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function resolveLatestProductionDeploymentSha(): string | null {
  try {
    const raw = execSync(
      'gh api repos/:owner/:repo/deployments --jq \'[.[] | select(.environment == "Production")][0].sha\'',
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim()
    return raw || null
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.trim() || null
  }
}

function workspaceHasRevenue2HImplementation(): {
  qaMarker: string
  engineGate: boolean
  liveSignals: boolean
  liveSpendAuthorized: boolean
  serviceGate: boolean
} {
  const engine = readWorkspaceSource("lib/growth/draft-factory/draft-factory-durable-engine.ts")
  const live = readWorkspaceSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
  const service = readWorkspaceSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
  return {
    qaMarker: GE_AIOS_REVENUE_2H_INVESTMENT_GATE_QA_MARKER,
    engineGate: engine.includes("isBillableDraftingAuthorized") &&
      engine.includes("Investment gate — billable drafting not authorized by SV1-1"),
    liveSignals:
      live.includes("budgetAvailable: true") &&
      live.includes("killSwitchActive: false") &&
      !live.includes("approvalRequired: true"),
    liveSpendAuthorized: live.includes("spendAuthorized: resource.spend_authorized"),
    serviceGate: service.includes("isBillableDraftingAuthorized(nextEvidence)"),
  }
}

function projectSv11ForLead(
  organizationId: string,
  lead: NonNullable<Awaited<ReturnType<typeof fetchGrowthLeadById>>>,
): Sv11Projection {
  const signals = buildResourceAllocationSignalsFromLead(lead, {
    budgetAvailable: true,
    killSwitchActive: false,
  })
  const resource = evaluateResourceAllocationFacade({
    organizationId,
    accountId: lead.id,
    resourceClass: "email_drafting",
    signals,
  })
  const evidenceConfidence =
    typeof signals.evidenceConfidence === "number" ? signals.evidenceConfidence : null
  return {
    investmentState: resource.investment_state,
    spendAuthorized: resource.spend_authorized,
    billableAuthorized: isBillableDraftingAuthorized({
      investmentState: resource.investment_state,
      spendAuthorized: resource.spend_authorized,
    }),
    qualificationRecommendation: signals.qualificationRecommendation ?? null,
    evidenceConfidence,
    reason: resource.reason,
  }
}

async function auditLeadDetail(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<Record<string, unknown>> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return { leadId, error: "lead_not_found" }

  const { data: df } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .maybeSingle()

  const { data: receipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("wake_fingerprint, outcome, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(10)

  const metadata = (lead.metadata ?? {}) as Record<string, unknown>
  const sv11 = projectSv11ForLead(organizationId, lead)
  const staleWaitingForGeneration =
    String((df as { state?: string } | null)?.state ?? "") === "waiting_for_generation" &&
    !sv11.billableAuthorized

  const { data: preparationRuns } = await admin
    .schema("growth")
    .from("autonomous_outreach_preparation_runs")
    .select("id, package_id, status, completed_at, lead_id")
    .eq("organization_id", organizationId)
    .eq("lead_id", leadId)
    .order("completed_at", { ascending: false })
    .limit(5)

  return {
    leadId,
    company: lead.companyName,
    admissionState: resolveLeadAdmissionStateFromMetadata(metadata),
    sv11,
    draftFactory: df ?? null,
    preparationRunCount: preparationRuns?.length ?? 0,
    preparationRuns: preparationRuns ?? [],
    mostRecentWakeReceipt: receipts?.[0] ?? null,
    recentWakeReceipts: receipts ?? [],
    staleWaitingForGeneration,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] SV1-5 investment gate production certification (read-only)`)
  console.log(`  QA marker: ${GE_AIOS_REVENUE_2H_PRODUCTION_VALIDATION_QA_MARKER}`)
  console.log(`  Implementation marker: ${GE_AIOS_REVENUE_2H_INVESTMENT_GATE_QA_MARKER}`)
  console.log(`  Env runner: ${VERCEL_PRODUCTION_ENV_RUN_QA_MARKER}`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({
    requireVercelProductionEnvRun: true,
  })
  if (!bootstrap) {
    console.error("Bootstrap failed — run via vercel-production-env-run.ts")
    process.exit(1)
  }

  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    console.error("GROWTH_ENGINE_AI_ORG_ID not configured")
    process.exit(1)
  }

  const observedAt = new Date().toISOString()
  const workspace = workspaceHasRevenue2HImplementation()
  const deployedSha = resolveLatestProductionDeploymentSha()
  const workspaceHead = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim()
  const workspaceDirty = execSync("git status --porcelain lib/growth/draft-factory", { encoding: "utf8" }).trim()

  console.log(`  ✓ org: ${organizationId}`)
  console.log(`  ✓ observed_at: ${observedAt}`)

  console.log("\n=== Phase 1 — Deployment confirmation ===")
  console.log(
    JSON.stringify(
      {
        deployedProductionSha: deployedSha,
        workspaceHeadSha: workspaceHead,
        workspaceDirtyDraftFactory: workspaceDirty.length > 0,
        revenue2HImplementationInWorkspace: workspace,
        vercelProductionEnvRun: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
        envLocalUsed: false,
        outboundEnabled: false,
        note:
          workspaceDirty.length > 0
            ? "Revenue-2H implementation exists locally but is not committed/deployed until user pushes."
            : deployedSha === workspaceHead
              ? "Workspace HEAD matches latest Production deployment SHA."
              : "Workspace HEAD differs from latest Production deployment SHA.",
      },
      null,
      2,
    ),
  )

  const { data: waitingRows, error: waitingError } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, package_id, updated_at")
    .eq("organization_id", organizationId)
    .eq("state", "waiting_for_generation")
  if (waitingError) {
    console.error(`waiting_for_generation query failed: ${waitingError.message}`)
    process.exit(1)
  }

  const waitingAudits: WaitingRowAudit[] = []
  for (const row of waitingRows ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    const lead = await fetchGrowthLeadById(admin, leadId)
    if (!lead) continue
    const metadata = (lead.metadata ?? {}) as Record<string, unknown>
    const sv11 = projectSv11ForLead(organizationId, lead)
    waitingAudits.push({
      leadId,
      companyName: lead.companyName,
      admissionState: resolveLeadAdmissionStateFromMetadata(metadata),
      dfState: String((row as { state: string }).state),
      earliestIncompleteStage:
        ((row as { earliest_incomplete_stage?: string | null }).earliest_incomplete_stage ?? null),
      sv11,
      authorized: sv11.billableAuthorized,
    })
  }

  const unauthorizedWaiting = waitingAudits.filter((row) => !row.authorized)

  console.log("\n=== Phase 2 — Production invariant scan (waiting_for_generation) ===")
  console.log(
    JSON.stringify(
      {
        totalWaitingForGeneration: waitingAudits.length,
        authorizedRows: waitingAudits.filter((row) => row.authorized).length,
        unauthorizedRows: unauthorizedWaiting.length,
        violations: unauthorizedWaiting,
        allWaitingRows: waitingAudits,
      },
      null,
      2,
    ),
  )

  const { data: dfRows } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, earliest_incomplete_stage, paused_reason, updated_at")
    .eq("organization_id", organizationId)
    .limit(5000)

  const leadIds = [...new Set((dfRows ?? []).map((row) => String((row as { lead_id: string }).lead_id)))]
  const { data: leads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, metadata")
    .in("id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"])

  const metadataByLead = new Map(
    (leads ?? []).map((row) => [
      String((row as { id: string }).id),
      ((row as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>,
    ]),
  )

  const acceptedWithoutBillableInGeneration: Array<Record<string, unknown>> = []
  for (const row of dfRows ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    const dfState = String((row as { state: string }).state)
    const metadata = metadataByLead.get(leadId) ?? null
    const admissionState = resolveLeadAdmissionStateFromMetadata(metadata)
    if (admissionState !== "accepted") continue

    const lead = await fetchGrowthLeadById(admin, leadId)
    if (!lead) continue
    const sv11 = projectSv11ForLead(organizationId, lead)
    if (sv11.billableAuthorized) continue

    if (dfState === "waiting_for_generation") {
      acceptedWithoutBillableInGeneration.push({
        leadId,
        company: lead.companyName,
        dfState,
        earliestIncompleteStage:
          ((row as { earliest_incomplete_stage?: string | null }).earliest_incomplete_stage ?? null),
        admissionState,
        sv11,
        violation: "accepted_unauthorized_in_waiting_for_generation",
      })
    }
  }

  console.log("\n=== Phase 3 — Investment-gate state validation ===")
  console.log(
    JSON.stringify(
      {
        acceptedUnauthorizedInWaitingForGeneration: acceptedWithoutBillableInGeneration.length,
        violations: acceptedWithoutBillableInGeneration,
      },
      null,
      2,
    ),
  )

  const blitz = await auditLeadDetail(admin, organizationId, BLITZ_LEAD_ID)
  console.log("\n=== Phase 4 — Blitz validation ===")
  console.log(JSON.stringify(blitz, null, 2))

  const block = await auditLeadDetail(admin, organizationId, BLOCK_LEAD_ID)
  console.log("\n=== Phase 5 — Block Imaging regression ===")
  console.log(JSON.stringify(block, null, 2))

  const sinceDeployIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentReceipts } = await admin
    .schema("growth")
    .from("draft_factory_wake_receipts")
    .select("lead_id, wake_fingerprint, outcome, transition_summary, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceDeployIso)
    .order("created_at", { ascending: false })
    .limit(100)

  const generationReceipts = (recentReceipts ?? []).filter((row) => {
    const fp = String((row as { wake_fingerprint?: string }).wake_fingerprint ?? "")
    return (
      fp.includes(":generation_required:") ||
      fp.includes(":capacity_available:") ||
      fp.includes(":generation_completed:")
    )
  })

  const blitzRecent = (recentReceipts ?? []).filter(
    (row) => String((row as { lead_id: string }).lead_id) === BLITZ_LEAD_ID,
  )

  console.log("\n=== Phase 6 — Scheduler behavior (24h wake receipts) ===")
  console.log(
    JSON.stringify(
      {
        receiptsLast24h: recentReceipts?.length ?? 0,
        generationRelatedReceipts: generationReceipts.length,
        blitzRecentReceipts: blitzRecent,
        sampleGenerationReceipts: generationReceipts.slice(0, 5),
      },
      null,
      2,
    ),
  )

  const packageViolations: Array<Record<string, unknown>> = []
  for (const row of dfRows ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    const dfState = String((row as { state: string }).state)
    if (!PACKAGE_DOWNSTREAM_STATES.has(dfState)) continue
    const integrity = evaluateGrowthPipelinePromotionIntegrity({
      metadata: metadataByLead.get(leadId) ?? null,
      boundary: "package",
    })
    if (!integrity.ok) {
      packageViolations.push({
        leadId,
        dfState,
        violation: integrity.violation,
        admissionState: resolveLeadAdmissionStateFromMetadata(metadataByLead.get(leadId) ?? null),
      })
    }
  }

  const blockHealthy =
    String((block.draftFactory as { state?: string } | null)?.state ?? "") === "waiting_for_approval" &&
    Boolean((block.draftFactory as { package_id?: string } | null)?.package_id)

  const blitzExpected =
    !blitz.staleWaitingForGeneration &&
    String((blitz.draftFactory as { state?: string } | null)?.state ?? "") !== "waiting_for_generation" &&
    (blitz.sv11 as Sv11Projection).investmentState === "maintain_investment" &&
    (blitz.sv11 as Sv11Projection).spendAuthorized === false

  const staleRowDecision =
    unauthorizedWaiting.length === 0
      ? {
          outcome: "A",
          label: "No reconciliation needed",
          reason:
            "No unauthorized waiting_for_generation rows remain in Production durable store.",
        }
      : {
          outcome: "B",
          label: "Narrow reconciliation justified",
          reason:
            "Production still contains waiting_for_generation rows where SV1-1 denies billable drafting. Plan smallest repair via existing durable transition authority after deploy.",
          violationLeadIds: unauthorizedWaiting.map((row) => row.leadId),
        }

  console.log("\n=== Phase 7 — Stale-row decision ===")
  console.log(JSON.stringify(staleRowDecision, null, 2))

  const checks = {
    noUnauthorizedWaitingForGeneration: unauthorizedWaiting.length === 0,
    blockWaitingForApproval: blockHealthy,
    blitzNotWaitingForGeneration: blitzExpected,
    promotionIntegrityViolations: packageViolations.length,
    revenue2HCodePresentInWorkspace:
      workspace.engineGate && workspace.liveSignals && workspace.liveSpendAuthorized && workspace.serviceGate,
  }

  console.log("\n=== Phase 8 — Certification checks ===")
  console.log(JSON.stringify({ checks, packageViolations }, null, 2))

  console.log("\n=== Certification verdict ===")
  const pass =
    checks.noUnauthorizedWaitingForGeneration &&
    checks.blockWaitingForApproval &&
    checks.blitzNotWaitingForGeneration &&
    checks.promotionIntegrityViolations === 0

  if (pass) {
    console.log("PASS — Production durable store satisfies SV1-5 investment gate invariant.")
    if (!checks.revenue2HCodePresentInWorkspace) {
      console.log(
        "INFO — Revenue-2H implementation markers missing from workspace; deploy gate code to enforce on future transitions.",
      )
    } else if (workspaceDirty.length > 0 || deployedSha !== workspaceHead) {
      console.log(
        "INFO — Revenue-2H code is present locally but not yet deployed to Vercel Production. Invariant holds on current store; deploy required to certify runtime transitions.",
      )
    }
  } else {
    console.log("FAIL — see Phase 2/3/5/8 sections for blocking violations.")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
