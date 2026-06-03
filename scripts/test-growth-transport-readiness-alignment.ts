/**
 * Transport readiness alignment + OAuth auto-wire regression checks.
 * Run: pnpm test:growth-transport-readiness-alignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  formatGrowthOutboundTransportBlockMessage,
  formatGrowthOutboundTransportReadinessLabel,
  GROWTH_OUTBOUND_TRANSPORT_BLOCK_REASONS,
  GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER,
  growthOutboundTransportReadinessCardStatus,
} from "../lib/growth/runtime/outbound-transport-readiness-types"
import { formatQaAccelerationBlockReason } from "../lib/growth/sequence-enrollment/qa-acceleration-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_OUTBOUND_TRANSPORT_READINESS_QA_MARKER, "growth-outbound-transport-readiness-v1")
assert.equal(GROWTH_OUTBOUND_TRANSPORT_BLOCK_REASONS.length, 5)

assert.equal(
  formatGrowthOutboundTransportReadinessLabel({ ready: true, blockReason: null }),
  "Connected and routable",
)
assert.equal(
  formatGrowthOutboundTransportReadinessLabel({
    ready: false,
    blockReason: "no_enabled_delivery_route",
    oauthConnected: true,
  }),
  "Connected but not routable",
)
assert.equal(
  formatGrowthOutboundTransportBlockMessage("no_enabled_delivery_route"),
  "No enabled delivery route.",
)
assert.equal(growthOutboundTransportReadinessCardStatus({ ready: true, blockReason: null }), "pass")
assert.equal(
  growthOutboundTransportReadinessCardStatus({ ready: false, blockReason: "sender_pending" }),
  "warning",
)
assert.equal(
  growthOutboundTransportReadinessCardStatus({ ready: false, blockReason: "provider_disconnected" }),
  "fail",
)

const readinessSource = readSource("lib/growth/runtime/outbound-transport-readiness.ts")
assert.match(readinessSource, /evaluateGrowthOutboundTransportReadiness/)
assert.match(readinessSource, /resolveSequenceExecutionSender/)
assert.match(readinessSource, /isGrowthOutboundTransportBlockReason/)

const autoWireSource = readSource("lib/growth/provider-setup/oauth-transport-auto-wire.ts")
assert.match(autoWireSource, /wireOAuthProviderTransportAfterConnection/)
assert.match(autoWireSource, /updateSenderAccount/)
assert.match(autoWireSource, /upsertDeliveryRoute/)
assert.match(autoWireSource, /ensureDeliveryProviderForOAuthFamily/)

const dashboardSource = readSource("lib/growth/provider-setup/dashboard.ts")
assert.match(dashboardSource, /wireOAuthProviderTransportAfterConnection/)

const checklistSource = readSource("lib/growth/provider-setup/readiness-checklist.ts")
assert.match(checklistSource, /evaluateGrowthOutboundTransportReadiness/)
assert.match(checklistSource, /growthOutboundTransportReadinessCardStatus/)
assert.doesNotMatch(checklistSource, /Connection status: \$\{status\}/)

const queueSource = readSource("lib/growth/sequences/execution/queue-sequence-step-transport-job.ts")
assert.match(queueSource, /evaluateGrowthOutboundTransportReadiness/)
assert.doesNotMatch(queueSource, /reason: "transport_not_configured"/)

const schedulerSource = readSource("lib/growth/sequence-enrollment/run-sequence-scheduler.ts")
assert.match(schedulerSource, /isGrowthOutboundTransportBlockReason/)

const detailSource = readSource("components/growth/growth-pattern-enrollment-detail.tsx")
assert.match(detailSource, /Transport Ready/)
assert.match(detailSource, /Transport Blocked/)
assert.match(detailSource, /transportReadiness\.ready/)

const detailServerSource = readSource("lib/growth/sequence-enrollment/enrollment-detail.ts")
assert.match(detailServerSource, /evaluateGrowthOutboundTransportReadiness/)

assert.equal(
  formatQaAccelerationBlockReason("no_enabled_delivery_route"),
  "No enabled delivery route.",
)
assert.equal(formatQaAccelerationBlockReason("sender_pending"), "Sender account is pending activation.")

console.log("growth transport readiness alignment tests passed")
