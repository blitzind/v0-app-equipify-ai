/**
 * GS-RG-2C — Enrollment budget certification (local static).
 * Run: pnpm test:growth-audience-enrollment-budgets
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_LIMITS } from "../lib/growth/audiences/growth-audience-config"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2C Enrollment Budget Certification ===\n")

  assert.equal(
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_DAY,
    GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_DAY,
  )
  assert.equal(
    GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN,
    GROWTH_RUNTIME_GUARDRAIL_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN,
  )

  const guardrails = readSource("lib/growth/audiences/growth-audience-guardrails.ts")
  assert.match(guardrails, /checkAudiencePreviewEnabled/)
  assert.match(guardrails, /checkAudienceEnrollmentEnabled/)
  assert.match(guardrails, /consumeAudiencePreviewBudget/)
  assert.match(guardrails, /audience_enrollment_previews/)

  const config = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(config, /audience_preview_enabled/)
  assert.match(config, /audience_enrollment_enabled/)
  assert.match(config, /MAX_AUDIENCE_PREVIEW_MEMBERS/)

  console.log("  ✓ Preview + enrollment budgets and kill switches")
  console.log("\nGS-RG-2C enrollment budget certification passed.\n")
}

main()
