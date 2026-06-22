/**
 * GS-GROWTH-OPS-6B — Operator navigation remediation certification.
 * Run: pnpm test:growth-ops-navigation-6b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthActivityHref,
  buildGrowthCallWorkspaceHref,
  buildGrowthLeadHref,
  buildGrowthLeadWorkspaceHref,
  buildGrowthOpportunityHref,
  buildGrowthPersonalizationHref,
  buildGrowthSharePageWorkspaceHref,
  GROWTH_OPS_NAVIGATION_6B_QA_MARKER,
  growthWorkspaceLeadHref,
  resolveGrowthLeadIdFromSearchParams,
} from "../lib/growth/navigation/growth-workspace-operator-links"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoAdminLeadLinks(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /\/admin\/growth\/leads/, `${relativePath} must not link admin leads routes`)
}

function assertNoSendrOperatorLinks(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /href=["'`]\/growth\/sendr/, `${relativePath} must not link /growth/sendr`)
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6B Operator Navigation Certification ===\n")
  assert.ok(GROWTH_OPS_NAVIGATION_6B_QA_MARKER)

  const leadId = "550e8400-e29b-41d4-a716-446655440000"
  assert.equal(buildGrowthLeadHref(leadId), `/growth/leads/crm?open=${leadId}`)
  assert.equal(buildGrowthLeadWorkspaceHref(leadId), buildGrowthLeadHref(leadId))
  assert.equal(growthWorkspaceLeadHref(leadId), buildGrowthLeadHref(leadId))
  assert.match(
    buildGrowthCallWorkspaceHref({ leadId }),
    /^\/growth\/calls\/workspace\?leadId=/,
  )
  assert.match(buildGrowthSharePageWorkspaceHref({ leadId }), /share-pages\/workspace\?leadId=/)
  assert.match(buildGrowthPersonalizationHref(leadId), /^\/growth\/personalization\?leadId=/)
  assert.match(buildGrowthOpportunityHref({ leadId }), /opportunities\/pipeline\?leadId=/)
  assert.equal(buildGrowthActivityHref("high-intent"), "/growth/activity?filter=high-intent")
  console.log("  ✓ canonical route builders")

  assert.equal(
    resolveGrowthLeadIdFromSearchParams({
      get(name: string) {
        if (name === "lead_id") return "legacy-lead"
        return null
      },
    }),
    "legacy-lead",
  )
  assert.equal(
    resolveGrowthLeadIdFromSearchParams({
      get(name: string) {
        if (name === "leadId") return "canonical-lead"
        if (name === "lead_id") return "legacy-lead"
        return null
      },
    }),
    "canonical-lead",
  )
  console.log("  ✓ leadId param alias resolution")

  const leadDetailPage = readSource("app/(growth)/growth/leads/[leadId]/page.tsx")
  assert.match(leadDetailPage, /redirect\(/)
  assert.match(leadDetailPage, /buildGrowthLeadHref/)
  assert.doesNotMatch(leadDetailPage, /GrowthLeadOperatorWorkspace/)
  console.log("  ✓ /growth/leads/[id] redirects to canonical CRM drawer")

  const crmWorkspace = readSource("components/growth/leads/growth-leads-crm-workspace.tsx")
  assert.match(crmWorkspace, /!showPageHeader \?/)
  assert.match(crmWorkspace, /Add lead/)
  assert.match(crmWorkspace, /leads\/research/)
  assert.doesNotMatch(crmWorkspace, /growthFeaturePath\(pathname, ""\)/)
  console.log("  ✓ workspace CRM always exposes lead creation actions")

  const hubConfig = readSource("lib/growth/hubs/growth-leads-hub-config.ts")
  assert.match(hubConfig, /Recently Captured/)
  assert.doesNotMatch(hubConfig, /label: "Import Leads"/)
  console.log("  ✓ hub import action labeled Recently Captured")

  const shareWorkspacePage = readSource("app/(growth)/growth/share-pages/workspace/page.tsx")
  assert.match(shareWorkspacePage, /resolveGrowthLeadIdFromSearchParams/)
  console.log("  ✓ share-page workspace accepts leadId aliases")

  const opportunitiesPage = readSource("app/(growth)/growth/opportunities/page.tsx")
  assert.match(opportunitiesPage, /buildGrowthOpportunityHref/)
  assert.match(opportunitiesPage, /resolveGrowthLeadIdFromSearchParams/)
  console.log("  ✓ opportunities hub redirects leadId deep links to pipeline")

  const pipeline = readSource("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  assert.match(pipeline, /buildGrowthLeadHref/)
  assert.match(pipeline, /resolveGrowthLeadIdFromSearchParams/)
  assertNoAdminLeadLinks("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  console.log("  ✓ pipeline consumes leadId and links to canonical lead surface")

  const operatorSurfaces = [
    "components/growth/growth-opportunity-workspace-dashboard.tsx",
    "components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx",
    "components/growth/inbox/growth-inbox-conversation-header.tsx",
    "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
    "components/growth/inbox/growth-inbox-next-best-action-bar.tsx",
    "components/growth/inbox/growth-inbox-quick-actions.tsx",
    "components/growth/growth-call-workspace-intelligence-rail.tsx",
    "components/growth/growth-captured-leads-dashboard.tsx",
    "lib/growth/activity/growth-activity-workspace-deep-links.ts",
  ]

  for (const surface of operatorSurfaces) {
    assertNoAdminLeadLinks(surface)
    assertNoSendrOperatorLinks(surface)
  }
  console.log("  ✓ operator surfaces free of admin lead links and sendr hrefs")

  const inboxHeader = readSource("components/growth/inbox/growth-inbox-conversation-header.tsx")
  assert.match(inboxHeader, /buildGrowthCallWorkspaceHref/)
  assert.doesNotMatch(inboxHeader, /growthFeaturePath\(.*"calls"\)/)
  console.log("  ✓ inbox call links target /growth/calls/workspace")

  const embedPanel = readSource("components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx")
  assert.match(embedPanel, /buildGrowthSharePageWorkspaceHref/)
  assert.doesNotMatch(embedPanel, /share-pages"\)\?leadId=/)
  console.log("  ✓ personalization embed uses share-page workspace builder")

  const activityLinks = readSource("lib/growth/activity/growth-activity-workspace-deep-links.ts")
  assert.match(activityLinks, /from "@\/lib\/growth\/navigation\/growth-workspace-operator-links"/)
  console.log("  ✓ activity deep links consolidated through operator link builders")

  console.log("\nGS-GROWTH-OPS-6B operator navigation certification passed.\n")
}

main()
