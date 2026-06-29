/**
 * GE-AVA-FRESH-SLATE-1A — Clear Ava/Growth Engine operational data for Precision Biomedical.
 *
 *   pnpm tsx scripts/reset-growth-engine-operational-data.ts
 *   pnpm tsx scripts/reset-growth-engine-operational-data.ts --execute
 *
 * Credentials (shell env at runtime — export production vars before --execute):
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   Project ref is derived from NEXT_PUBLIC_SUPABASE_URL automatically.
 *
 * Non-interactive by default. Pass --prompt to allow interactive credential entry.
 */
import { createClient } from "@supabase/supabase-js"
import { formatGrowthProductionTargetBanner } from "../lib/growth/canonical-companies/load-growth-production-supabase-env"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV,
  GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import {
  GROWTH_RESET_CREDENTIALS_HELP,
  describeGrowthResetShellEnvGap,
  resolveGrowthResetSupabaseConfig,
} from "../lib/growth/reset/growth-test-data-reset-credentials"
import {
  formatGrowthEngineOperationalResetDryRun,
  runGrowthEngineOperationalReset,
} from "../lib/growth/reset/growth-engine-operational-reset-service"
import { getGrowthEngineOperationalResetTableEntries } from "../lib/growth/reset/growth-engine-operational-reset-table-inventory"

function wantsHelp(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h")
}

function logOperationalResetSafetyConfirmation(input: {
  projectRef: string | null
  supabaseUrlHost: string
  organizationId: string
  execute: boolean
  credentialSource: string
}): void {
  const inventory = getGrowthEngineOperationalResetTableEntries()
  console.error(
    JSON.stringify(
      {
        qa_marker: GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
        confirmation: "growth_operational_reset_target",
        supabase_project_ref: input.projectRef,
        supabase_url_host: input.supabaseUrlHost,
        organization_id: input.organizationId,
        execute: input.execute,
        credential_source: input.credentialSource,
        tables_in_inventory: inventory.length,
        inventory_tables: inventory.map((entry) => entry.table),
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)

  if (wantsHelp(argv)) {
    console.log(`${GROWTH_RESET_CREDENTIALS_HELP}

GE-AVA-FRESH-SLATE-1A operational reset:
  pnpm tsx scripts/reset-growth-engine-operational-data.ts
  pnpm tsx scripts/reset-growth-engine-operational-data.ts --execute

Flags:
  --execute           Apply deletes (default is dry-run)
  --org-id <uuid>     Override target org (default: ${PRECISION_BIOMEDICAL_AI_OS_ORG_ID})
  --prompt            Allow interactive credential prompt (default is non-interactive)
  --local             Allow localhost Supabase URLs

Env:
  ${GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV}  Optional org override
  NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY  Required for non-interactive runs
`)
    return
  }

  const execute = argv.includes("--execute")
  const allowLocal = argv.includes("--local")
  const allowPrompt = argv.includes("--prompt")

  const orgFlagIndex = argv.indexOf("--org-id")
  const organizationId =
    (orgFlagIndex >= 0 ? argv[orgFlagIndex + 1]?.trim() : null) ||
    process.env[GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV]?.trim() ||
    PRECISION_BIOMEDICAL_AI_OS_ORG_ID

  let config
  try {
    config = await resolveGrowthResetSupabaseConfig({ allowLocal, allowPrompt })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        error: "growth_operational_reset_supabase_config",
        message,
        shell_env_hint: describeGrowthResetShellEnvGap(),
      }),
    )
    process.exit(1)
  }

  logOperationalResetSafetyConfirmation({
    projectRef: config.projectRef,
    supabaseUrlHost: config.urlHost,
    organizationId,
    execute,
    credentialSource: config.credentialSource,
  })

  console.error(
    JSON.stringify(formatGrowthProductionTargetBanner(config, execute ? "apply" : "dry_run")),
  )

  const admin = createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const result = await runGrowthEngineOperationalReset(admin, {
    organizationId,
    execute,
  })

  console.log(formatGrowthEngineOperationalResetDryRun(result.audit_before))

  if (result.audit_after) {
    console.log("Post-reset summary:")
    console.log(
      JSON.stringify(
        {
          qa_marker: GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
          organization_id: organizationId,
          rows_removed: Object.values(result.deleted_by_table).reduce((sum, count) => sum + count, 0),
          deleted_by_table: result.deleted_by_table,
          verification: result.verification,
        },
        null,
        2,
      ),
    )
  }

  if (execute && !result.verification.ok) {
    process.exitCode = 2
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
