/**
 * GE-AIOS-21C-4 — Legacy lead cleanup (dry-run by default).
 *
 * Dry-run (default, zero writes):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/cleanup-ge-aios-21c-legacy-leads-production.ts
 *
 * Explicit write mode (requires BOTH flags):
 *   ... scripts/cleanup-ge-aios-21c-legacy-leads-production.ts --write --confirm=GE_AIOS_21C_LEGACY_CLEANUP
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import {
  applyGrowthLeadAdmissionCleanup,
  buildGrowthLeadAdmissionCleanupPlan,
  GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN,
  GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-cleanup"
import { loadSuppressedLeadIds } from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { redactLeadSample } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import type { GrowthLeadAdmissionState } from "@/lib/growth/revenue-workflow/growth-lead-admission-types"

export const GE_AIOS_21C_LEGACY_CLEANUP_QA_MARKER =
  "ge-aios-21c-legacy-leads-cleanup-v1" as const

const PHASE = "GE-AIOS-21C-4" as const

type CliOptions = {
  write: boolean
  confirm: string | null
  leadId: string | null
  limit: number
  states: GrowthLeadAdmissionState[]
}

function parseCli(argv: string[]): CliOptions {
  const write = argv.includes("--write")
  const confirmArg = argv.find((arg) => arg.startsWith("--confirm="))
  const leadIdArg = argv.find((arg) => arg.startsWith("--lead-id="))
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))
  const stateArgs = argv
    .filter((arg) => arg.startsWith("--state="))
    .map((arg) => arg.split("=")[1] ?? "")
    .filter(Boolean) as GrowthLeadAdmissionState[]

  const limitParsed = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : 100

  return {
    write,
    confirm: confirmArg ? confirmArg.split("=")[1] ?? null : null,
    leadId: leadIdArg ? leadIdArg.split("=")[1] ?? null : null,
    limit: Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : 100,
    states: stateArgs,
  }
}

function growthLeadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("leads")
}

async function main(): Promise<void> {
  const cli = parseCli(process.argv)
  const writeAllowed =
    cli.write && cli.confirm === GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN

  console.log(`[${PHASE}] Legacy Lead Cleanup`)
  console.log(`Script: ${GE_AIOS_21C_LEGACY_CLEANUP_SCRIPT_ID}`)
  console.log(`QA marker: ${GE_AIOS_21C_LEGACY_CLEANUP_QA_MARKER}`)
  console.log(
    writeAllowed
      ? "MODE: WRITE (operator confirmed)"
      : "MODE: DRY-RUN ONLY — zero writes will be made",
  )

  if (cli.write && !writeAllowed) {
    console.error(
      `Write refused — both --write and --confirm=${GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN} are required.`,
    )
    process.exit(1)
  }

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

  const admissionContext = await loadGrowthLeadAdmissionContext(admin, organizationId)
  const suppressedLeadIds = await loadSuppressedLeadIds(admin)

  let query = growthLeadsTable(admin)
    .select(
      "id, company_name, contact_name, contact_email, website, status, metadata, created_at",
    )
    .not("status", "in", '("archived","converted")')
    .order("created_at", { ascending: false })

  if (cli.leadId) {
    query = query.eq("id", cli.leadId)
  } else {
    query = query.limit(cli.limit)
  }

  const { data, error } = await query
  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const leads = data ?? []
  const proposed: Array<Record<string, unknown>> = []
  let applied = 0
  let skipped = 0

  for (const lead of leads) {
    const row = {
      ...lead,
      metadata:
        lead.metadata && typeof lead.metadata === "object"
          ? (lead.metadata as Record<string, unknown>)
          : {},
    }
    const plan = buildGrowthLeadAdmissionCleanupPlan({
      lead: row,
      admissionContext,
      suppressed: suppressedLeadIds.has(lead.id),
    })

    if (cli.states.length > 0 && !cli.states.includes(plan.evaluatedState)) {
      continue
    }

    if (plan.proposedChanges.length === 0) {
      skipped += 1
      continue
    }

    proposed.push({
      ...redactLeadSample(row),
      evaluated_state: plan.evaluatedState,
      drift: plan.driftClassification,
      idempotent: plan.idempotent,
      proposed_changes: plan.proposedChanges,
    })

    if (writeAllowed && !plan.idempotent) {
      const result = await applyGrowthLeadAdmissionCleanup({
        admin,
        lead: row,
        admissionContext,
        suppressed: suppressedLeadIds.has(lead.id),
        operatorConfirmed: true,
      })
      if (result.applied) applied += 1
      else skipped += 1
    }
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GE_AIOS_21C_LEGACY_CLEANUP_QA_MARKER,
        mode: writeAllowed ? "write" : "dry_run",
        leads_scanned: leads.length,
        proposed_actions: proposed.length,
        applied,
        skipped,
        filters: {
          lead_id: cli.leadId,
          limit: cli.limit,
          states: cli.states,
        },
        proposed,
      },
      null,
      2,
    ),
  )

  if (!writeAllowed) {
    console.log(
      `\n[${PHASE}] DRY-RUN complete — review proposed actions before running with --write --confirm=${GE_AIOS_21C_LEGACY_CLEANUP_CONFIRM_TOKEN}`,
    )
  } else {
    console.log(`\n[${PHASE}] WRITE complete — applied ${applied}, skipped ${skipped}`)
  }

  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
