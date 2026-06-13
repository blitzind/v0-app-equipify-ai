/**
 * Production-tree scan for Supabase builder-direct `.catch()` / `.finally()`.
 *
 * Run: pnpm test:growth-supabase-builder-catch
 * Also runs in prebuild before `pnpm build`.
 */
export {
  collectViolations,
  type SupabaseBuilderCatchViolation,
} from "../lib/growth/guardrails/supabase-builder-catch-scanner"

import {
  formatSupabaseBuilderCatchViolations,
  GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER,
  scanSupabaseBuilderCatchProductionTree,
} from "../lib/growth/guardrails/supabase-builder-catch-scanner"

function main(): void {
  const violations = scanSupabaseBuilderCatchProductionTree()

  if (violations.length === 0) {
    console.log(
      `${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: OK (no builder-direct .catch/.finally in production tree).`,
    )
    return
  }

  console.error(`${GROWTH_SUPABASE_BUILDER_CATCH_QA_MARKER}: PRODUCTION TREE FAILED`)
  for (const line of formatSupabaseBuilderCatchViolations(violations)) {
    console.error(line)
  }
  process.exit(1)
}

main()
