/**
 * Phase 6.35D — Lemlist / adapter operator surface decommission regression checks.
 * Run: pnpm test:growth-lemlist-decommission
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_ADAPTER_LEGACY_QUEUE_ARCHIVE_HREF,
  GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF,
  GROWTH_LEMLIST_DECOMMISSION_QA_MARKER,
  GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE,
} from "../lib/growth/runtime/adapter-outbound-decommission-types"
import { LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE } from "../lib/growth/outbound/providers/lemlist/lemlist-labels"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_LEMLIST_DECOMMISSION_QA_MARKER, "growth-lemlist-decommission-v1")
assert.equal(GROWTH_ADAPTER_ROLLBACK_SEQUENCE_EXECUTION_HREF, "/admin/growth/sequences/execution")
assert.equal(GROWTH_ADAPTER_LEGACY_QUEUE_ARCHIVE_HREF, "/admin/growth/outreach/legacy-queue")
assert.match(GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE, /rollback-only/i)
assert.match(LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE, /Sequence Execution/)

const approvalRedirect = readSource("app/(admin)/admin/growth/outreach/approval/page.tsx")
assert.match(approvalRedirect, /redirect\(/)
assert.match(approvalRedirect, /sequences\/execution/)

const legacyQueuePage = readSource("app/(admin)/admin/growth/outreach/legacy-queue/page.tsx")
assert.match(legacyQueuePage, /GrowthOutreachApprovalDashboard/)
assert.match(legacyQueuePage, /readOnly/)

const approvalDashboardRoute = readSource("app/api/platform/growth/outreach/approval-dashboard/route.ts")
assert.match(approvalDashboardRoute, /decommission/)
assert.match(approvalDashboardRoute, /GROWTH_LEMLIST_DECOMMISSION_QA_MARKER/)

const cutoverStatusRoute = readSource("app/api/platform/growth/outbound/cutover-status/route.ts")
assert.match(cutoverStatusRoute, /lemlist_operator_surface/)
assert.match(cutoverStatusRoute, /legacy_queue_archive_href/)

const lemlistSettings = readSource("components/growth/growth-lemlist-provider-settings.tsx")
assert.match(lemlistSettings, /rollback-only/)
assert.match(lemlistSettings, /operatorReadOnly/)
assert.match(lemlistSettings, /cutover-status/)

const outreachDashboard = readSource("components/growth/growth-outreach-approval-dashboard.tsx")
assert.match(outreachDashboard, /readOnly/)
assert.match(outreachDashboard, /GROWTH_LEMLIST_ROLLBACK_ONLY_OPERATOR_NOTE/)

const providersDashboard = readSource("components/growth/growth-providers-dashboard.tsx")
assert.match(providersDashboard, /Lemlist \(rollback-only\)/)
assert.match(providersDashboard, /readOnly/)

const infraReadiness = readSource("lib/growth/infrastructure/infrastructure-readiness.ts")
assert.match(infraReadiness, /Lemlist adapter \(rollback-only\)/)
assert.match(infraReadiness, /rollback-only/)

const providerCapabilities = readSource("lib/growth/outbound/provider-capabilities.ts")
assert.match(providerCapabilities, /Rollback-only adapter/)

const dogfoodTypes = readSource("lib/growth/dogfood/dogfood-types.ts")
assert.match(dogfoodTypes, /Native Gmail \/ Microsoft delivery/)

const operatorStrip = readSource("lib/growth/operator-ux/operator-attention-strip.ts")
assert.match(operatorStrip, /native transport/)

const sidebarHook = readSource("hooks/use-growth-sidebar-console.ts")
assert.match(sidebarHook, /cutover-status/)
assert.match(sidebarHook, /sequences\/execution\/dashboard/)

const navDestinations = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
assert.match(navDestinations, /Sequence Approvals/)
assert.match(navDestinations, /legacy-queue/)

assert.ok(fs.existsSync(path.join(process.cwd(), "docs/GROWTH_LEMLIST_DECOMMISSION_6.35D.md")))

console.log("growth lemlist decommission tests passed")
