/**
 * GE-EI-IMP-3B — forward-only suppression dual-write (shadow mode).
 * Run: pnpm test:growth-suppression-dual-write
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key"

async function main(): Promise<void> {
  const {
    GROWTH_SUPPRESSION_DUAL_WRITE_QA_MARKER,
    isGrowthSuppressionDualWriteEnabled,
    mapLegacySuppressionReasonToComplianceReason,
    mirrorLegacySuppressionToCompliance,
  } = await import("../lib/growth/compliance/suppression-dual-write")
  const { GROWTH_SUPPRESSION_REASONS } = await import("../lib/growth/outbound/types")

  assert.equal(GROWTH_SUPPRESSION_DUAL_WRITE_QA_MARKER, "growth-suppression-dual-write-v1")
  const previousFlag = process.env.GROWTH_SUPPRESSION_DUAL_WRITE

  function restoreFlag(): void {
    if (previousFlag === undefined) delete process.env.GROWTH_SUPPRESSION_DUAL_WRITE
    else process.env.GROWTH_SUPPRESSION_DUAL_WRITE = previousFlag
  }

  // Feature flag default off
  delete process.env.GROWTH_SUPPRESSION_DUAL_WRITE
  assert.equal(isGrowthSuppressionDualWriteEnabled(), false)

  process.env.GROWTH_SUPPRESSION_DUAL_WRITE = "true"
  assert.equal(isGrowthSuppressionDualWriteEnabled(), true)

  process.env.GROWTH_SUPPRESSION_DUAL_WRITE = "false"
  assert.equal(isGrowthSuppressionDualWriteEnabled(), false)

  process.env.GROWTH_SUPPRESSION_DUAL_WRITE = "TRUE"
  assert.equal(isGrowthSuppressionDualWriteEnabled(), true)

  restoreFlag()

  // Reason mapping — deterministic legacy → canonical
  assert.equal(mapLegacySuppressionReasonToComplianceReason("unsubscribe"), "Unsubscribe (global)")
  assert.equal(mapLegacySuppressionReasonToComplianceReason("bounce_hard"), "Hard bounce (hard)")
  assert.equal(mapLegacySuppressionReasonToComplianceReason("spam_complaint"), "Complaint (spam_complaint)")
  assert.equal(mapLegacySuppressionReasonToComplianceReason("manual"), "Manual suppression")
  assert.equal(mapLegacySuppressionReasonToComplianceReason("legal"), "Legal hold")

  for (const reason of GROWTH_SUPPRESSION_REASONS) {
    const canonical = mapLegacySuppressionReasonToComplianceReason(reason)
    assert.ok(canonical.length > 0, `canonical reason for ${reason}`)
    assert.equal(mapLegacySuppressionReasonToComplianceReason(reason), canonical, "mapping must be stable")
  }

  // Flag off → mirror is a no-op (never throws, no admin access required)
  delete process.env.GROWTH_SUPPRESSION_DUAL_WRITE
  await assert.doesNotReject(async () => {
    await mirrorLegacySuppressionToCompliance({} as SupabaseClient, {
      email: "lead@example.com",
      reason: "manual",
      source: "manual",
    })
  })

  // Flag on → mirror delegates to applyDeliverySuppression; failures never throw
  process.env.GROWTH_SUPPRESSION_DUAL_WRITE = "true"

  await assert.doesNotReject(async () => {
    await mirrorLegacySuppressionToCompliance({} as SupabaseClient, {
      email: "lead@example.com",
      reason: "bounce_hard",
      source: "provider_webhook",
      leadId: "lead-1",
    })
  })

  await assert.doesNotReject(async () => {
    await mirrorLegacySuppressionToCompliance({} as SupabaseClient, {
      email: "not-an-email",
      reason: "legal",
      source: "manual",
    })
  })

  restoreFlag()

  // Compliance helper invoked from mirror module
  const dualWriteSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/suppression-dual-write.ts"),
    "utf8",
  )
  assert.match(dualWriteSource, /applyDeliverySuppression/)
  assert.match(dualWriteSource, /isGrowthSuppressionDualWriteEnabled/)
  assert.match(dualWriteSource, /LEGACY_TO_COMPLIANCE_REASON|mapLegacySuppressionReasonToComplianceReason/)

  // Duplicate suppression safe — delegated to applyDeliverySuppression dedupe
  const suppressionEngine = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/suppression-engine.ts"),
    "utf8",
  )
  assert.match(suppressionEngine, /if \(existing\) return/)

  // Wiring — legacy writers mirror forward only
  const suppressionRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/suppression-repository.ts"),
    "utf8",
  )
  assert.match(suppressionRepo, /mirrorLegacySuppressionToCompliance/)

  const processEvent = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/outbound/process-event.ts"),
    "utf8",
  )
  assert.match(processEvent, /upsertGrowthSuppressionEntry/)

  const manualApi = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/suppression/route.ts"),
    "utf8",
  )
  assert.match(manualApi, /upsertGrowthSuppressionEntry/)

  const replyRouting = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/reply-intelligence/reply-routing-workflows.ts"),
    "utf8",
  )
  assert.match(replyRouting, /upsertGrowthSuppressionEntry/)

  // No reverse mirroring from compliance writers
  assert.doesNotMatch(suppressionEngine, /suppression-dual-write|mirrorLegacySuppressionToCompliance|suppression_entries/)

  const complaintEngine = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/complaint-engine.ts"),
    "utf8",
  )
  assert.doesNotMatch(complaintEngine, /suppression-dual-write|mirrorLegacySuppressionToCompliance|suppression_entries/)

  const complianceRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/compliance-repository.ts"),
    "utf8",
  )
  assert.doesNotMatch(complianceRepo, /suppression-dual-write|mirrorLegacySuppressionToCompliance/)

  // Logging must not expose plaintext email or hashes
  assert.match(dualWriteSource, /email_present/)
  assert.doesNotMatch(dualWriteSource, /console\.(log|debug|info|warn|error)\([^)]*\bemail\b[^_]/i)
  assert.doesNotMatch(dualWriteSource, /email_hash|hashComplianceEmail/)

  console.log(`${GROWTH_SUPPRESSION_DUAL_WRITE_QA_MARKER}: all checks passed`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
