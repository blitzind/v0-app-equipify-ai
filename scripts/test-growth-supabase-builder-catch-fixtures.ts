/**
 * Fixture-only self-test for Supabase builder `.catch()` guardrail scanner.
 *
 * Run: pnpm test:growth-supabase-builder-catch-fixtures
 */
import {
  formatSupabaseBuilderCatchViolations,
  GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER,
  runSupabaseBuilderCatchFixtureSuite,
} from "../lib/growth/guardrails/supabase-builder-catch-scanner"

function main(): void {
  const result = runSupabaseBuilderCatchFixtureSuite()

  if (result.badFailures.length > 0) {
    console.error(`${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: FIXTURE SUITE FAILED (bad fixtures)`)
    for (const failure of result.badFailures) {
      console.error(`  ${failure}`)
    }
    process.exit(1)
  }

  if (result.goodFailures.length > 0) {
    console.error(`${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: FIXTURE SUITE FAILED (good fixtures)`)
    for (const entry of result.goodFailures) {
      console.error(`  ${entry.fixture} should PASS but failed:`)
      for (const line of formatSupabaseBuilderCatchViolations(entry.violations)) {
        console.error(line)
      }
    }
    process.exit(1)
  }

  if (!result.ok) {
    console.error(`${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: FIXTURE SUITE FAILED (setup)`)
    process.exit(1)
  }

  console.log("✓ builder-direct .catch() detected in bad fixtures")
  console.log("✓ safe patterns ignored in good fixtures")
  console.log(`${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: fixture suite OK`)
}

main()
