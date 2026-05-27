/**
 * Organization account classification + platform metrics exclusion.
 * Run: pnpm test:organization-account-classification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  accountTypeExcludesFromPlatformMetrics,
  buildOrganizationMetricsClassificationPatch,
  filterOrganizationsForPlatformMetrics,
  isOrganizationIncludedInPlatformMetrics,
  mapOrganizationMetricsClassificationFromRow,
  parseOrganizationAccountType,
  parseOrganizationHardDeleteFailure,
} from "../lib/platform/platform-metrics-organizations"
import { countOrganizationImmutableAuditRecords } from "../lib/platform/organization-immutable-audit-guard"
import type { SupabaseClient } from "@supabase/supabase-js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const ORG = "11111111-1111-4111-8111-111111111111"

function mockAuditAdmin(count: number): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "blitzpay_mobile_audit_log")
      const chain = {
        select() {
          return chain
        },
        eq() {
          return Promise.resolve({ count, error: null })
        },
      }
      return chain
    },
  } as unknown as SupabaseClient
}

async function main(): Promise<void> {
  assert.equal(parseOrganizationAccountType("customer"), "customer")
  assert.equal(parseOrganizationAccountType("INTERNAL"), "internal")
  assert.equal(parseOrganizationAccountType("bad"), null)

  assert.equal(accountTypeExcludesFromPlatformMetrics("customer"), false)
  assert.equal(accountTypeExcludesFromPlatformMetrics("demo"), true)
  assert.equal(accountTypeExcludesFromPlatformMetrics("internal"), true)

  assert.equal(isOrganizationIncludedInPlatformMetrics({ exclude_from_platform_metrics: false }), true)
  assert.equal(isOrganizationIncludedInPlatformMetrics({ exclude_from_platform_metrics: true }), false)
  assert.equal(isOrganizationIncludedInPlatformMetrics({ exclude_from_platform_metrics: null }), true)

  const filtered = filterOrganizationsForPlatformMetrics([
    { exclude_from_platform_metrics: false, id: "a" },
    { exclude_from_platform_metrics: true, id: "b" },
  ])
  assert.deepEqual(filtered.map((r) => (r as { id: string }).id), ["a"])

  const customerPatch = buildOrganizationMetricsClassificationPatch({
    accountType: "customer",
    excludedByUserId: "user-1",
  })
  assert.equal(customerPatch.exclude_from_platform_metrics, false)
  assert.equal(customerPatch.exclusion_reason, null)
  assert.equal(customerPatch.excluded_by, null)

  const internalPatch = buildOrganizationMetricsClassificationPatch({
    accountType: "internal",
    exclusionReason: "Blitz workspace",
    excludedByUserId: "user-1",
    nowIso: "2026-05-26T00:00:00.000Z",
  })
  assert.equal(internalPatch.exclude_from_platform_metrics, true)
  assert.equal(internalPatch.exclusion_reason, "Blitz workspace")
  assert.equal(internalPatch.excluded_by, "user-1")
  assert.equal(internalPatch.excluded_at, "2026-05-26T00:00:00.000Z")

  const mapped = mapOrganizationMetricsClassificationFromRow({
    account_type: "demo",
    exclude_from_platform_metrics: true,
    exclusion_reason: "Sales demo",
  })
  assert.equal(mapped.accountType, "demo")
  assert.equal(mapped.accountTypeBadge, "Demo")
  assert.equal(mapped.excludeFromPlatformMetrics, true)

  const immutableParsed = parseOrganizationHardDeleteFailure("blitzpay_mobile_audit_immutable")
  assert.equal(immutableParsed.code, "immutable_audit_records")
  assert.equal(immutableParsed.suggestMarkInternalOrExclude, true)
  assert.match(immutableParsed.userMessage, /immutable financial audit/i)

  const auditCount = await countOrganizationImmutableAuditRecords(mockAuditAdmin(3), ORG)
  assert.equal(auditCount.immutableAuditRecordCount, 3)
  assert.equal(auditCount.blitzpayMobileAuditCount, 3)

  const migration = read("supabase/migrations/20270421120000_organizations_account_classification.sql")
  assert.match(migration, /account_type text/)
  assert.match(migration, /exclude_from_platform_metrics boolean/)
  assert.match(migration, /organizations_protect_metrics_classification/)

  const accountsRoute = read("app/api/platform/accounts/route.ts")
  assert.match(accountsRoute, /filterOrganizationsForPlatformMetrics|isOrganizationIncludedInPlatformMetrics/)
  assert.match(accountsRoute, /account_type, exclude_from_platform_metrics/)

  const classificationRoute = read("app/api/platform/accounts/[organizationId]/classification/route.ts")
  assert.match(classificationRoute, /isPlatformAdminEmail/)
  assert.match(classificationRoute, /buildOrganizationMetricsClassificationPatch/)

  const deleteGuards = read("lib/platform/organization-delete-guards.ts")
  assert.match(deleteGuards, /immutable_audit_records/)
  assert.match(deleteGuards, /countOrganizationImmutableAuditRecords/)

  const analytics = read("lib/platform-analytics-compute.ts")
  assert.match(analytics, /filterOrganizationsForPlatformMetrics/)

  const adminPage = read("app/(admin)/admin/page.tsx")
  assert.match(adminPage, /Account classification/)
  assert.match(adminPage, /Mark as internal\/excluded/)

  console.log("organization account classification tests passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
