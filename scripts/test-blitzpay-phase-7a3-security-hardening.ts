/**
 * BlitzPay Phase 7A.3 — security / permissions / sensitive payload hardening checks.
 * Run: pnpm test:blitzpay-phase-7a3-security-hardening
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { filterMobileIntentsForTechnician } from "../lib/blitzpay/blitzpay-mobile-financial-ops"
import {
  sanitizeBlitzpayObservabilityJsonForApi,
  shapeBlitzpayClaimsPayoutForApi,
  shapeBlitzpayIdempotencyRecordListItem,
  shapeBlitzpayObservabilityFinancialEventListItem,
  shapePortalBlitzpayPreparePaySuccessResponse,
} from "../lib/blitzpay/blitzpay-payload-sanitization"
import {
  BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH,
  resolveBlitzpayReportingSnapshotNestedSkipState,
} from "../lib/blitzpay/blitzpay-reporting-snapshot-nesting"
import { blitzpayStaffLoadFailedResponse } from "../lib/blitzpay/blitzpay-staff-load-error-response"
import { validateBlitzpayWorkflowReplayAuthorization } from "../lib/blitzpay/blitzpay-workflow-orchestration"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.resolve(__dirname, "..")

function read(rel: string): string {
  return fs.readFileSync(path.join(APP_ROOT, rel), "utf8")
}

async function main(): Promise<void> {
  const ev = shapeBlitzpayObservabilityFinancialEventListItem({
    id: "e1",
    event_type: "x",
    event_status: "completed",
    event_hash: "a".repeat(64),
    source_reference: "pi_1234567890ABCDEFGHIJKLMNOP",
    idempotency_key: "x".repeat(80),
    event_payload: { nested: { stripe_customer_id: "cus_ABCDEFGHIJKLMN", digest: "b".repeat(64) } },
    metadata: { ok: 1 },
  })
  assert.equal("event_hash" in ev, false)
  assert.equal(ev.integrity_recorded, true)
  assert.ok(typeof ev.source_reference === "string" && !String(ev.source_reference).includes("pi_1234567890ABCDEF"))
  assert.ok(String(ev.idempotency_key).endsWith("…"))
  const pl = ev.event_payload as Record<string, unknown>
  const nested = pl.nested as Record<string, unknown>
  assert.equal(nested.digest, "[redacted]")
  assert.ok(String(nested.stripe_customer_id).includes("…"))

  const idem = shapeBlitzpayIdempotencyRecordListItem({
    id: "i1",
    idempotency_key: "y".repeat(50),
    request_hash: "c".repeat(64),
    request_scope: "api",
    request_status: "completed",
    response_reference: "acct_1234567890abcdefghij",
    metadata: { k: 1 },
    created_at: "t",
    updated_at: "t",
  })
  assert.equal("request_hash" in idem, false)
  assert.equal(idem.request_integrity_recorded, true)
  assert.ok(String(idem.response_reference).includes("…"))

  const pay = shapeBlitzpayClaimsPayoutForApi({
    id: "p1",
    organization_id: "11111111-1111-4111-8111-111111111111",
    claim_id: "22222222-2222-4222-8222-222222222222",
    payout_reference_hash: "d".repeat(64),
    payout_status: "pending",
    payout_type: "reimbursement",
    payout_amount_cents: 100,
  })
  assert.equal("payout_reference_hash" in pay, false)
  assert.equal(pay.payout_reference_recorded, true)
  assert.ok(typeof pay.payout_reference_probe === "string" && pay.payout_reference_probe.endsWith("…"))

  assert.deepEqual(shapePortalBlitzpayPreparePaySuccessResponse({ url: "https://checkout.example/s" }), {
    url: "https://checkout.example/s",
  })

  const sanitized = sanitizeBlitzpayObservabilityJsonForApi({ token: "x", safe: "pi_1234567890abcdefghijklmnop", h: "e".repeat(40) })
  assert.equal("token" in sanitized, false)
  assert.equal(sanitized.h, "[redacted]")

  assert.deepEqual(validateBlitzpayWorkflowReplayAuthorization({ orgMemberRole: "tech", userEmail: "t@x.com" }), {
    ok: false,
    code: "forbidden",
  })

  const intents = filterMobileIntentsForTechnician(
    [
      { technician_id: "33333333-3333-4333-8333-333333333333", id: "a" },
      { technician_id: "44444444-4444-4444-8444-444444444444", id: "b" },
    ],
    "33333333-3333-4333-8333-333333333333",
  )
  assert.equal(intents.length, 1)
  assert.equal(intents[0]!.id, "a")

  const capped = resolveBlitzpayReportingSnapshotNestedSkipState({ nestingDepth: BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH })
  assert.equal(capped.atDepthCap, true)
  assert.equal(capped.skipObservabilityPhase6b, true)

  const staffErr = blitzpayStaffLoadFailedResponse("test", new Error("secret db message"))
  assert.equal(staffErr.status, 503)
  assert.deepEqual(await staffErr.json(), { error: "load_failed" })

  const replaySrc = read("app/api/organizations/[organizationId]/blitzpay/observability/workflows/[workflowId]/replay/route.ts")
  assert.match(replaySrc, /validateBlitzpayWorkflowReplayAuthorization/)
  assert.match(replaySrc, /mark_replayed/)

  const platformRollup = read("app/api/platform/blitzpay/observability-rollup/route.ts")
  assert.match(platformRollup, /logBlitzpayServerFailure/)
  assert.ok(!platformRollup.includes("message: msg"), "platform rollup must not echo raw error messages to JSON")

  const eventsRoute = read("app/api/organizations/[organizationId]/blitzpay/observability/events/route.ts")
  assert.match(eventsRoute, /shapeBlitzpayObservabilityFinancialEventListItem/)

  const portalPrepare = read("app/api/portal/invoices/[invoiceId]/blitzpay/prepare-pay/route.ts")
  assert.match(portalPrepare, /shapePortalBlitzpayPreparePaySuccessResponse/)

  // eslint-disable-next-line no-console
  console.log("blitzpay phase 7a3 security hardening checks ok")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
