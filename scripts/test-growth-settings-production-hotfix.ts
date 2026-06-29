/**
 * PROD-HOTFIX — Growth settings production page load certification.
 * Run: pnpm test:growth-settings-production-hotfix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN,
  isGrowthOperatorWorkspaceMissingColumnError,
  isGrowthOrganizationAiTeammateIdentityTableMissingError,
} from "../lib/growth/settings/growth-workspace-settings-column-compat"

export const GROWTH_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER = "growth-settings-production-hotfix-v1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SETTINGS_PRODUCTION_HOTFIX_QA_MARKER, "growth-settings-production-hotfix-v1")

  const migration = readSource(
    "supabase/migrations/20270630120000_growth_operator_workspace_ai_teammate_onboarding_prod_hotfix.sql",
  )
  assert.match(migration, /add column if not exists ai_teammate_onboarding_completed/)
  assert.match(migration, /growth\.operator_workspace_preferences/)

  const repository = readSource("lib/growth/settings/growth-workspace-settings-repository.ts")
  assert.match(repository, /SELECT_WITHOUT_AI_TEAMMATE_ONBOARDING/)
  assert.match(repository, /probeGrowthOperatorWorkspaceAiTeammateOnboardingColumn/)
  assert.match(repository, /isGrowthOperatorWorkspaceMissingColumnError/)

  const teammateRepo = readSource("lib/growth/settings/growth-ai-teammate-identity-repository.ts")
  assert.match(teammateRepo, /isGrowthOperatorWorkspaceMissingColumnError/)
  assert.match(teammateRepo, /isGrowthOrganizationAiTeammateIdentityTableMissingError/)

  const compat = readSource("lib/growth/settings/growth-workspace-settings-column-compat.ts")
  assert.match(compat, /isGrowthOrganizationAiTeammateIdentityTableMissingError/)

  assert.match(migration, /organization_ai_teammate_identity/)
  assert.match(migration, /grant select, insert, update, delete on table growth.organization_ai_teammate_identity to service_role/)

  const liftedPanels = readSource("components/settings/workspace-settings-growth-engine-lifted-panels.tsx")
  assert.match(liftedPanels, /loadLiftedPanel\(/)
  assert.match(liftedPanels, /WORKSPACE_SETTINGS_GROWTH_ENGINE_DYNAMIC_PANEL_QA_MARKER/)
  assert.doesNotMatch(liftedPanels, /^import \{ GrowthDeliverabilityDashboard \}/m)
  assert.match(liftedPanels, /LiftedWarmupPanel/)
  assert.match(liftedPanels, /Suspense/)

  const supabaseClient = readSource("lib/supabase/client.ts")
  assert.doesNotMatch(supabaseClient, /^if \(!supabaseAnonKey\)/m)

  assert.equal(
    isGrowthOperatorWorkspaceMissingColumnError({
      message: `column operator_workspace_preferences.${GROWTH_OPERATOR_WORKSPACE_AI_TEAMMATE_ONBOARDING_COLUMN} does not exist`,
      code: "42703",
    }),
    true,
  )
  assert.equal(isGrowthOperatorWorkspaceMissingColumnError({ message: "permission denied", code: "42501" }), false)

  const resetService = readSource("lib/growth/reset/growth-test-data-reset-service.ts")
  assert.doesNotMatch(resetService, /runGrowthTestDataReset\(\).*confirm/s)

  console.log("growth-settings-production-hotfix: ok")
}

main()
