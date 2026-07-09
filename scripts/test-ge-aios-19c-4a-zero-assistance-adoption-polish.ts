/**
 * GE-AIOS-19C-4A — Zero-assistance adoption polish certification.
 * Run: pnpm test:ge-aios-19c-4a-zero-assistance-adoption-polish
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CUSTOMER_APPROVALS_TITLE,
  GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_LABEL,
  GROWTH_CUSTOMER_LAUNCH_COMPLETE_HEADLINE,
  GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER,
  resolveGrowthCustomerApprovalPrimaryAction,
} from "../lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"
import { GROWTH_HOME_BRIEFING_CROSS_LINKS } from "../lib/growth/home/growth-home-cleanup-19c-2g"
import { GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH } from "../lib/growth/home/growth-home-workspace-summary-types"
import {
  GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS,
  GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER,
  GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS,
} from "../lib/growth/navigation/growth-workspace-sidebar-ia"
import { GROWTH_WORKSPACE_SHELL_NAV_MANIFEST } from "../lib/growth/navigation/growth-workspace-shell-navigation"

const PHASE = "GE-AIOS-19C-4A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log(`[${PHASE}] Zero-assistance adoption polish certification`)

  assert.equal(GROWTH_ZERO_ASSISTANCE_ADOPTION_19C_4A_QA_MARKER, "ge-aios-19c-4a-zero-assistance-adoption-polish-v1")
  console.log("  ✓ 19C-4A QA marker")

  const manifestIds = GROWTH_WORKSPACE_SHELL_NAV_MANIFEST.flatMap((group) => group.items.map((item) => item.id))
  const workspaceIndex = manifestIds.indexOf("dashboard")
  const approvalsIndex = manifestIds.indexOf("approvals")
  assert.ok(workspaceIndex >= 0 && approvalsIndex > workspaceIndex)
  assert.ok(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.includes("approvals"))
  assert.ok(!GROWTH_WORKSPACE_SIDEBAR_HIDDEN_NAV_IDS.includes("approvals"))
  assert.ok(manifestIds.indexOf("operations") < manifestIds.indexOf("training"))
  assert.ok(manifestIds.indexOf("training") < manifestIds.indexOf("about-ai"))
  assert.ok(manifestIds.indexOf("about-ai") < manifestIds.indexOf("approvals"))
  console.log("  ✓ Approvals in sidebar after About Your AI (discoverable)")

  const crossLink = GROWTH_HOME_BRIEFING_CROSS_LINKS.find((row) => row.id === "approvals")
  assert.equal(crossLink?.label, GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_LABEL)
  console.log("  ✓ Home cross-link uses Approvals label")

  const approvalsPanel = readSource("components/growth/ai-os/approvals/growth-human-approval-center-panel.tsx")
  assert.match(approvalsPanel, /GROWTH_CUSTOMER_APPROVALS_TITLE/)
  assert.match(approvalsPanel, /action\.approveLabel/)
  assert.match(approvalsPanel, /action\.rejectLabel/)
  assert.match(approvalsPanel, /GROWTH_CUSTOMER_APPROVALS_TRUST_BODY/)
  assert.doesNotMatch(approvalsPanel, /Human Approval Center/)
  assert.doesNotMatch(approvalsPanel, /Enforcement:/)
  assert.match(approvalsPanel, /Technical details/)
  console.log("  ✓ Approvals page uses customer copy; engineering terms in details only")

  const action = resolveGrowthCustomerApprovalPrimaryAction({
    route: "/growth/os/pilot/lead-research/abc",
    status: "pending",
    actionType: "approve_outreach_package",
  })
  assert.equal(action.approveLabel, "Approve")
  assert.equal(action.rejectLabel, "Reject")
  assert.match(action.helperText, /Nothing sends until you approve/)
  console.log("  ✓ approval primary action helper explains approve/reject workflow")

  const dashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  assert.match(dashboard, /GrowthHomeLaunchCompleteBanner/)
  assert.doesNotMatch(dashboard, /fetch\(/)
  console.log("  ✓ launch complete banner on Home without extra fetch")

  const launchBanner = readSource(
    "components/growth/workspace/executive-briefing/growth-home-launch-complete-banner.tsx",
  )
  assert.match(launchBanner, /GROWTH_CUSTOMER_LAUNCH_COMPLETE_HEADLINE/)
  assert.match(launchBanner, /Open Approvals/)
  console.log("  ✓ launch moment explains next steps")

  const onboarding = readSource("components/growth/ai-teammate/growth-ai-teammate-onboarding-dialog.tsx")
  assert.match(onboarding, /Welcome to Equipify Sales/)
  assert.doesNotMatch(onboarding, /View objectives/)
  assert.match(onboarding, /Open Training/)
  assert.doesNotMatch(onboarding, /exceptions/)
  console.log("  ✓ onboarding uses customer language; Training not Objectives")

  const waiting = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(waiting, /What I need from you/)
  assert.match(waiting, /Open Approvals/)
  console.log("  ✓ waiting section aligned with narrative labels")

  const workSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx")
  assert.match(workSection, /GROWTH_CUSTOMER_EMPTY_WORK_MESSAGE/)
  assert.match(workSection, /GROWTH_CUSTOMER_EMPTY_WORK_NEXT_LABEL/)
  console.log("  ✓ Home cold-start work queue guides to Training")

  const operations = readSource("components/growth/operations-center/growth-sales-operations-center-dashboard.tsx")
  assert.match(operations, /GROWTH_CUSTOMER_EMPTY_OPERATIONS_FOCUS/)
  assert.match(operations, /GROWTH_CUSTOMER_EMPTY_OPERATIONS_DECISION/)
  console.log("  ✓ Operations empty states guide next action")

  const trainingShell = readSource("components/growth/training/growth-training-shell.tsx")
  assert.match(trainingShell, /cursor-not-allowed/)
  assert.match(trainingShell, /if \(item\.future\)/)
  console.log("  ✓ future Training nav items not clickable")

  const strategy = readSource("components/growth/training/growth-training-business-strategy-section.tsx")
  assert.doesNotMatch(strategy, /specialist/)
  console.log("  ✓ no specialist language in Training business strategy")

  const lib = readSource("lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a.ts")
  assert.doesNotMatch(lib, /supabase/)
  assert.doesNotMatch(lib, /fetch\(/)
  assert.match(lib, /localStorage/)
  console.log("  ✓ client copy module only; localStorage for banner dismiss")

  const apiDir = path.join(process.cwd(), "app/api")
  const newApiHits = fs
    .readdirSync(apiDir, { recursive: true })
    .map(String)
    .filter((file) => /19c-4a|zero-assistance/i.test(file))
  assert.equal(newApiHits.length, 0)
  console.log("  ✓ no new APIs")

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  assert.match(dashboardBody, /useGrowthWorkspaceDashboard/)
  assert.doesNotMatch(dashboardBody, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  console.log("  ✓ single workspace-summary fetch preserved")

  assert.equal(GROWTH_CUSTOMER_APPROVALS_TITLE, "Approvals")
  assert.equal(GROWTH_WORKSPACE_SIDEBAR_IA_QA_MARKER, "growth-workspace-sidebar-ia-v7")
  console.log("  ✓ terminology constants centralized")

  console.log(`[${PHASE}] PASS — Zero-assistance adoption polish certified (local)`)
}

main()
