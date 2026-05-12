/**
 * BlitzPay Phase 6A — mobile financial ops foundations (deterministic helpers + route presence).
 * Run: pnpm test:blitzpay-phase-6a-mobile-financial-ops
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hashBlitzpayMobileAudit } from "../lib/blitzpay/blitzpay-mobile-audit"
import { hashMobileSignatureAuthorization } from "../lib/blitzpay/blitzpay-mobile-signatures"
import { detectMobileIntentSyncConflict, orderMobileIntentIdsForSync } from "../lib/blitzpay/blitzpay-mobile-sync"
import { nextPayrollApprovalStatus } from "../lib/blitzpay/blitzpay-mobile-payroll-approvals"
import {
  buildPhase6aMobileReportingSlice,
  filterMobileIntentsForTechnician,
  isBlitzpayMobileFinancePrivilegedRole,
  sanitizeMobileMetadataForResponse,
  sanitizeMobileTreasurySnapshotForFieldRole,
  validateMobileIntentCreate,
} from "../lib/blitzpay/blitzpay-mobile-financial-ops"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

const ORG = "11111111-1111-4111-8111-111111111111"

function mockAdmin(rows: Record<string, unknown[]>): SupabaseClient {
  return {
    from(table: string) {
      const data = rows[table] ?? []
      const chain = {
        select() {
          return chain
        },
        eq() {
          return chain
        },
        order() {
          return chain
        },
        limit() {
          return Promise.resolve({ data, error: null })
        },
      }
      return chain
    },
  } as unknown as SupabaseClient
}

async function main(): Promise<void> {
  assert.equal(orderMobileIntentIdsForSync(["b", "a", "b"]).join(","), "a,b")

  assert.equal(detectMobileIntentSyncConflict("2026-02-02T00:00:00.000Z", "2026-02-01T00:00:00.000Z"), true)
  assert.equal(detectMobileIntentSyncConflict("2026-02-01T00:00:00.000Z", "2026-02-02T00:00:00.000Z"), false)
  assert.equal(detectMobileIntentSyncConflict("2026-02-01T00:00:00.000Z", null), false)

  assert.ok(validateMobileIntentCreate({ intent_type: "payment_collection" }).ok)
  assert.equal(validateMobileIntentCreate({ intent_type: "bad" }).ok, false)

  const uid = "11111111-1111-4111-8111-111111111111"
  assert.deepEqual(
    filterMobileIntentsForTechnician(
      [
        { technician_id: uid, id: "1" },
        { technician_id: "22222222-2222-4222-8222-222222222222", id: "2" },
      ],
      uid,
    ).map((r) => r.id),
    ["1"],
  )

  assert.equal(nextPayrollApprovalStatus("pending", "approve", "manager"), "approved")
  assert.equal(nextPayrollApprovalStatus("pending", "dispute", "technician"), "disputed")
  assert.equal(nextPayrollApprovalStatus("pending", "approve", "technician"), null)

  const h1 = hashBlitzpayMobileAudit({
    audit_type: "intent_captured",
    organization_id: ORG,
    audit_summary: "x",
    actor_type: "system",
    actor_id: null,
    metadata: { a: 1 },
  })
  const h2 = hashBlitzpayMobileAudit({
    audit_type: "intent_captured",
    organization_id: ORG,
    audit_summary: "x",
    actor_type: "system",
    actor_id: null,
    metadata: { a: 1 },
  })
  assert.equal(h1, h2)
  assert.equal(h1.length, 64)

  const sh = hashMobileSignatureAuthorization({
    organizationId: ORG,
    authorizationType: "payment_approval",
    signedAtIso: "2026-01-01T00:00:00.000Z",
    signerEmailNorm: "a@b.co",
    signerNameNorm: "Pat",
    opaqueClientReference: "opaque-ref-12345678",
  })
  assert.equal(sh.length, 64)

  const meta = sanitizeMobileMetadataForResponse({ ok: 1, stripe_customer_id: "x" })
  assert.equal(Object.prototype.hasOwnProperty.call(meta, "stripe_customer_id"), false)

  const tre = sanitizeMobileTreasurySnapshotForFieldRole({
    snapshot_date: "2026-05-01",
    visible_to_role: "technician",
    available_cash_cents: -100,
    upcoming_payables_cents: 50,
    upcoming_payroll_cents: null,
    collections_due_cents: 10,
    treasury_health_score: 120,
  })
  assert.equal(tre.available_cash_cents, 0)
  assert.equal(tre.treasury_health_score, 100)

  assert.equal(isBlitzpayMobileFinancePrivilegedRole("manager"), true)
  assert.equal(isBlitzpayMobileFinancePrivilegedRole("tech"), false)

  const admin = mockAdmin({
    blitzpay_mobile_financial_intents: [
      { id: "i1", intent_status: "draft", intent_type: "payment_collection", captured_offline: true, amount_cents: 100 },
    ],
    blitzpay_mobile_signature_authorizations: [{ id: "s1", authorization_status: "synced" }],
    blitzpay_mobile_sync_batches: [{ id: "b1", batch_status: "completed" }],
    blitzpay_mobile_payroll_approval_items: [{ id: "p1", approval_status: "pending" }],
    blitzpay_mobile_treasury_snapshots: [{ treasury_health_score: 80, visible_to_role: "technician" }],
    blitzpay_mobile_audit_log: [{ id: "a1" }],
  })
  const slice = await buildPhase6aMobileReportingSlice(admin, ORG, {
    treasuryFailedPayoutCount30d: 0,
    estimatedOperatingCashCents: 1000,
  })
  assert.equal(slice.mobileFinancialIntentCount, 1)
  assert.ok(slice.mobileTreasuryVisibilityScore >= 0)

  const routePaths = [
    "organizations/[organizationId]/blitzpay/mobile/intents/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/signatures/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/payroll-approvals/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/payroll-approvals/[id]/approve/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/payroll-approvals/[id]/dispute/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/treasury-summary/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/sync-batches/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/sync/route.ts",
    "organizations/[organizationId]/blitzpay/mobile/health/route.ts",
  ]
  for (const p of routePaths) {
    const src = read(path.join("app/api", p))
    assert.ok(src.includes("requireAnyOrgPermission") || src.includes("requireOrgPermission"), p)
    assert.ok(src.includes("blitzpaySchemaGuardNextResponse"), p)
    assert.ok(src.includes(".limit("), p)
  }

  const healthSrc = read(path.join("app/api", "organizations/[organizationId]/blitzpay/mobile/health/route.ts"))
  assert.ok(healthSrc.includes("skipMobilePhase6a: true"), "health nested snapshot skip")

  const schema = read("lib/blitzpay/blitzpay-schema-health.ts")
  for (const t of [
    "blitzpay_mobile_financial_intents",
    "blitzpay_mobile_signature_authorizations",
    "blitzpay_mobile_payroll_approval_items",
    "blitzpay_mobile_treasury_snapshots",
    "blitzpay_mobile_sync_batches",
    "blitzpay_mobile_audit_log",
  ]) {
    assert.ok(schema.includes(t), t)
  }

  const gateSrc = read("lib/api/require-org-permission.ts")
  assert.ok(gateSrc.includes("requireOrgPermission"), "requireOrgPermission present")

  console.log("blitzpay phase 6a tests passed")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
