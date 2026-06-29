/**
 * GE-AVA-FRESH-SLATE-1A — Clear Ava/Growth Engine operational data for Precision Biomedical.
 *
 *   pnpm tsx scripts/reset-growth-engine-operational-data.ts
 *   pnpm tsx scripts/reset-growth-engine-operational-data.ts --execute
 *   pnpm tsx scripts/reset-growth-engine-operational-data.ts --production-env --execute
 *
 * Credentials (default shell env / linked ref; use --production-env for Vercel production env files):
 *   1) NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   2) SUPABASE_PROJECT_REF + SUPABASE_ACCESS_TOKEN
 *   3) Interactive prompt (TTY)
 *   --production-env reads .env.production.local / production env files (same as Vercel app target)
 */
import { createClient } from "@supabase/supabase-js"
import { formatGrowthProductionTargetBanner } from "../lib/growth/canonical-companies/load-growth-production-supabase-env"
import {
  GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV,
  GROWTH_ENGINE_OPERATIONAL_RESET_QA_MARKER,
  PRECISION_BIOMEDICAL_AI_OS_ORG_ID,
} from "../lib/growth/reset/growth-engine-operational-reset-constants"
import { resolveGrowthResetSupabaseConfigWithProductionFlag } from "../lib/growth/reset/growth-reset-env-comparison"
import { GROWTH_RESET_CREDENTIALS_HELP } from "../lib/growth/reset/growth-test-data-reset-credentials"
import {
  formatGrowthEngineOperationalResetDryRun,
  runGrowthEngineOperationalReset,
} from "../lib/growth/reset/growth-engine-operational-reset-service"

function wantsHelp(argv: string[]): boolean {
  return argv.includes("--help") || argv.includes("-h")
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
  --no-prompt         Do not prompt for credentials interactively
  --local             Allow localhost Supabase URLs
  --production-env    Resolve Supabase from production env files (align with Vercel runtime)

Env:
  ${GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV}  Optional org override
`)
    return
  }

  const execute = argv.includes("--execute")
  const allowLocal = argv.includes("--local")
  const allowPrompt = !argv.includes("--no-prompt")

  const orgFlagIndex = argv.indexOf("--org-id")
  const organizationId =
    (orgFlagIndex >= 0 ? argv[orgFlagIndex + 1]?.trim() : null) ||
    process.env[GROWTH_ENGINE_OPERATIONAL_RESET_ORG_ID_ENV]?.trim() ||
    PRECISION_BIOMEDICAL_AI_OS_ORG_ID

  let config
  let envComparison = null
  let usedProductionEnv = false
  try {
    const resolved = await resolveGrowthResetSupabaseConfigWithProductionFlag(argv, {
      allowLocal,
      allowPrompt,
    })
    config = resolved.config
    envComparison = resolved.comparison
    usedProductionEnv = resolved.usedProductionEnv
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error(JSON.stringify({ error: "growth_operational_reset_supabase_config", message }))
    process.exit(1)
  }

  console.error(
    JSON.stringify({
      ...formatGrowthProductionTargetBanner(config, execute ? "apply" : "dry_run"),
      used_production_env: usedProductionEnv,
      env_comparison: envComparison,
    }),
  )

  if (envComparison?.warning) {
    console.error(JSON.stringify({ warning: "growth_reset_env_mismatch", message: envComparison.warning }))
  }

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
