/**
 * Phase 6.30D — native outbound cutover hardening regression checks.
 * Run: pnpm test:growth-outbound-cutover
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE,
  GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV,
  GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER,
  parseGrowthAllowAdapterOutbound,
} from "../lib/growth/runtime/outbound-cutover-types"
import { GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL } from "../lib/growth/runtime/cron-telemetry-types"
import { parseGrowthOutboundMode } from "../lib/growth/runtime/outbound-mode-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_NATIVE_OUTBOUND_CUTOVER_QA_MARKER, "growth-native-outbound-cutover-v1")
assert.equal(GROWTH_ALLOW_ADAPTER_OUTBOUND_ENV, "GROWTH_ALLOW_ADAPTER_OUTBOUND")
assert.equal(ADAPTER_OUTBOUND_CUTOVER_DISABLED_CODE, "adapter_outbound_cutover_disabled")
assert.equal(parseGrowthAllowAdapterOutbound(undefined), false)
assert.equal(parseGrowthAllowAdapterOutbound("true"), true)
assert.equal(parseGrowthOutboundMode(undefined), "standalone")

const cutoverSource = readSource("lib/growth/runtime/outbound-cutover.ts")
assert.match(cutoverSource, /isAdapterOutboundExecutionEnabled/)
assert.match(cutoverSource, /growthAdapterOutboundCutoverHttpResponse/)

const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
  crons: Array<{ path: string }>
}
for (const routeId of GROWTH_CRON_ROUTES_RETIRED_FROM_VERCEL) {
  assert.ok(
    !vercel.crons.some((cron) => cron.path === `/api/cron/${routeId}`),
    `retired cron ${routeId} must not be registered in vercel.json`,
  )
  assert.ok(
    fs.existsSync(path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`)),
    `rollback cron route file must exist for ${routeId}`,
  )
}

const cronRoute = readSource("app/api/cron/growth-outreach-execute/route.ts")
assert.match(cronRoute, /isGrowthOutreachExecuteCronEnabled/)
assert.match(cronRoute, /status: 410/)

const queueRepo = readSource("lib/growth/outreach/outreach-queue-repository.ts")
assert.match(queueRepo, /assertAdapterOutboundExecutionAllowed/)

const scheduler = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(scheduler, /isAdapterOutboundExecutionEnabled/)
assert.doesNotMatch(scheduler, /if \(false\)/)

const orchestrator = readSource("lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts")
assert.match(orchestrator, /queueSequenceStepTransportJob/)

const approvalPage = readSource("app/(admin)/admin/growth/outreach/approval/page.tsx")
assert.match(approvalPage, /redirect\(/)
assert.match(approvalPage, /sequences\/execution/)

const legacyQueuePage = readSource("app/(admin)/admin/growth/outreach/legacy-queue/page.tsx")
assert.match(legacyQueuePage, /readOnly/)
assert.match(legacyQueuePage, /GROWTH_LEMLIST_DECOMMISSION_QA_MARKER/)

const envExample = readSource(".env.local.example")
assert.match(envExample, /GROWTH_ALLOW_ADAPTER_OUTBOUND/)

console.log("growth outbound cutover tests passed")
