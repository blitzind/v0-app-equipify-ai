/**
 * GE-AIOS-SV1-6B — Ava Completed Work thin projection certification.
 * Run: pnpm test:sv1-6b-ava-completed-work
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AVA_COMPLETED_WORK_HREF,
  GROWTH_AVA_COMPLETED_WORK_NAV_LABEL,
  GROWTH_AVA_COMPLETED_WORK_PHASE,
  GROWTH_AVA_COMPLETED_WORK_QA_MARKER,
  GROWTH_AVA_COMPLETED_WORK_TITLE,
} from "../lib/growth/aios/approvals/ava-completed-work-contract"
import {
  buildNeedsRevisionNote,
  categorizeAvaCompletedWorkItem,
  indexOutreachPackagesById,
  parsePackageIdFromApprovalRoute,
  projectAvaCompletedWork,
  projectAvaCompletedOutreachPackageCard,
} from "../lib/growth/aios/approvals/ava-completed-work-projection"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { GROWTH_CUSTOMER_APPROVALS_TITLE } from "../lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"
import { buildAvaOperatorPackageActionApiPath } from "../lib/growth/mission-center/growth-ava-operator-workspace-contract"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function sampleItem(overrides: Partial<GrowthHumanApprovalItem> = {}): GrowthHumanApprovalItem {
  return {
    id: "approval-outreach-1",
    organizationId: "org-1",
    source: "outreach_package",
    actionType: "approve_outreach_package",
    channel: "email",
    subjectType: "lead",
    subjectId: "lead-1",
    title: "Outreach package — Acme Robotics",
    summary: "Book a discovery call after human review.",
    riskLevel: "medium",
    priorityScore: 82,
    status: "needs_review",
    evidence: [{ source: "outreach_preparation_pilot", label: "Recommended channel", value: "email" }],
    policy: {
      requiresHumanApproval: true,
      enforcementSource: "autonomous_outreach_preparation_pilot",
      blockedReason: "Transport blocked — draft only until human approval.",
    },
    route: "/growth/os/pilot/lead-research/lead-1?packageId=outreach-prep%3Alead-1%3A2026-07-12",
    createdAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  }
}

function samplePackage(): GrowthAutonomousOutreachApprovalPackage {
  return {
    packageId: "outreach-prep:lead-1:2026-07-12",
    leadId: "lead-1",
    companyName: "Acme Robotics",
    preparedAt: "2026-07-12T12:00:00.000Z",
    generatedAssets: [
      {
        channel: "email",
        label: "Cold email",
        preview: "Subject: Operations capacity at Acme",
        draftOnly: true,
      },
    ],
    personalizationEvidence: ["Email strategy: deterministic", "Decision maker on lead used for greeting"],
    supportingResearch: ["Verified multi-location footprint", "Recent hiring in operations"],
    confidence: 0.82,
    approvalRequirements: ["operator_outbound_approval", "human_send_gate"],
    complianceNotes: ["Draft-only — no transport execution.", "Communication plan plan-1 — read-only."],
    recommendedChannel: "email",
    recommendedSequence: "email_first_multichannel",
    expectedOutcome: "Human-approved outreach after draft review.",
    pendingHumanApproval: true,
    transportBlocked: true,
  }
}

function main(): void {
  console.log(`[${GROWTH_AVA_COMPLETED_WORK_PHASE}] Ava Completed Work certification`)

  assert.equal(GROWTH_AVA_COMPLETED_WORK_QA_MARKER, "ge-aios-sv1-6b-ava-completed-work-v1")
  assert.equal(GROWTH_AVA_COMPLETED_WORK_TITLE, "Ava completed work")
  assert.equal(GROWTH_AVA_COMPLETED_WORK_NAV_LABEL, "Ava's Work")
  assert.equal(GROWTH_AVA_COMPLETED_WORK_HREF, "/growth/os/approvals")
  assert.equal(GROWTH_CUSTOMER_APPROVALS_TITLE, GROWTH_AVA_COMPLETED_WORK_TITLE)
  console.log("  ✓ Ava Completed Work contract + customer title aligned")

  const packageId = parsePackageIdFromApprovalRoute(
    "/growth/os/pilot/lead-research/lead-1?packageId=outreach-prep%3Alead-1%3A2026-07-12",
  )
  assert.equal(packageId, "outreach-prep:lead-1:2026-07-12")
  console.log("  ✓ packageId recovered from existing HAC route")

  const pkg = samplePackage()
  const item = sampleItem()
  const card = projectAvaCompletedOutreachPackageCard({
    item,
    packageId: pkg.packageId,
    pkg,
  })
  assert.equal(card.company, "Acme Robotics")
  assert.equal(card.transportBlocked, true)
  assert.equal(card.pendingHumanApproval, true)
  assert.match(card.explainability.whySequence, /email_first_multichannel/)
  assert.ok(card.explainability.supportingEvidence.length > 0)
  console.log("  ✓ outreach package card projects existing 5F fields (no regeneration)")

  const projection = projectAvaCompletedWork({
    items: [
      item,
      sampleItem({
        id: "approval-meeting-1",
        source: "meeting_prep",
        actionType: "approve_meeting_prep",
        title: "Meeting prep — Acme",
        route: "/growth/os/pilot/lead-research/lead-1",
      }),
      sampleItem({
        id: "approval-follow-1",
        source: "automation",
        actionType: "approve_automation",
        title: "Follow-up recommendation",
        route: "/growth/campaigns/sequences",
      }),
      sampleItem({
        id: "approval-account-1",
        source: "needs_attention",
        actionType: "review_blocker",
        title: "Account needs review",
        route: "/growth/leads/lead-1",
      }),
    ],
    packagesById: indexOutreachPackagesById([pkg]),
  })
  assert.equal(projection.totalCompleted, 4)
  assert.equal(categorizeAvaCompletedWorkItem(item), "outreach_packages")
  assert.ok(projection.categories.some((row) => row.id === "outreach_packages" && row.count === 1))
  assert.ok(projection.categories.some((row) => row.id === "meeting_preparations" && row.count === 1))
  assert.ok(projection.categories.some((row) => row.id === "follow_up_recommendations" && row.count === 1))
  assert.ok(projection.categories.some((row) => row.id === "accounts_need_review" && row.count === 1))
  assert.equal(projection.items[0]?.outreachCard?.packageId, pkg.packageId)
  console.log("  ✓ category summary projection (Outreach / Meeting / Follow-up / Accounts)")

  const note = buildNeedsRevisionNote("tighten opener")
  assert.match(note, /^needs_revision:/)
  assert.match(note, /tighten opener/)
  console.log("  ✓ Needs Revision note wraps existing reject API note field")

  assert.equal(
    buildAvaOperatorPackageActionApiPath("pkg-1"),
    "/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/pkg-1/action",
  )
  console.log("  ✓ package mutation path reuses existing action API")

  const panel = readSource("components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx")
  assert.match(panel, /GROWTH_AVA_COMPLETED_WORK_TITLE/)
  assert.match(panel, /Ava completed \$\{projection\.totalCompleted\}/)
  assert.match(panel, /\/api\/platform\/growth\/ai-os\/approvals/)
  assert.match(panel, /\/api\/platform\/growth\/ai-os\/command-center/)
  assert.doesNotMatch(panel, /Human Approval Center/)
  assert.doesNotMatch(panel, /Operator Queue|Approval Dashboard|CRM workflow|Sales rep/)
  console.log("  ✓ completed-work panel uses AI OS language over HAC GET")

  const cardUi = readSource(
    "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
  )
  assert.match(cardUi, /Authorize/)
  assert.match(cardUi, /Needs revision/)
  assert.match(cardUi, /buildAvaOperatorPackageActionApiPath/)
  assert.match(cardUi, /transportBlocked|sequence and transport/)
  assert.match(cardUi, /GROWTH_AVA_COMPLETED_WORK_SEQUENCE_GATE_HREF/)
  assert.doesNotMatch(cardUi, /executeTransportSend|sendSms|runSequenceExecutionJob/)
  console.log("  ✓ package card wires Approve/Reject/Needs Revision without send")

  const page = readSource("app/(growth)/growth/os/approvals/page.tsx")
  assert.match(page, /GrowthAvaCompletedWorkPanel/)
  console.log("  ✓ /growth/os/approvals serves Ava Completed Work projection")

  const nav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(nav, /Ava's Work/)
  const routeCatalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(routeCatalog, /Ava's Work/)
  console.log("  ✓ nav + route catalog point to Ava's Work")

  const homeWaiting = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(homeWaiting, /Review Ava/)
  assert.doesNotMatch(homeWaiting, /Open Approvals/)
  const homeSynth = readSource(
    "lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts",
  )
  assert.match(homeSynth, /os\/approvals/)
  console.log("  ✓ Home routes into Ava Completed Work")

  const cognitive = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
  assert.match(cognitive, /Ava's completed work/)
  assert.match(cognitive, /\/growth\/os\/approvals/)
  console.log("  ✓ Cognitive Workspace points into Ava Completed Work")

  const cc = readSource(
    "components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section.tsx",
  )
  assert.match(cc, /GROWTH_AVA_COMPLETED_WORK_TITLE/)
  assert.doesNotMatch(cc, /Human Approval Center/)
  console.log("  ✓ Command Center section uses Ava Completed Work language")

  const actionRoute = readSource(
    "app/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/[packageId]/action/route.ts",
  )
  assert.match(actionRoute, /decision: z\.enum\(\["approve", "reject"\]\)/)
  assert.match(actionRoute, /transportBlocked: true/)
  console.log("  ✓ existing package action API unchanged (approve|reject only)")

  const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transport, /assertHumanApproval/)
  assert.match(transport, /human_approved/)
  assert.match(transport, /human_approval_confirmed/)
  console.log("  ✓ transport human approval boundary unchanged")

  const apiHits = fs
    .readdirSync(path.join(process.cwd(), "app/api"), { recursive: true })
    .map(String)
    .filter((file) => /sv1-6b|ava-completed-work/i.test(file))
  assert.equal(apiHits.length, 0)
  console.log("  ✓ zero new approval APIs")

  const migrationHits = fs
    .readdirSync(path.join(process.cwd(), "supabase/migrations"))
    .filter((file) => /sv1.?6b|ava.?completed.?work/i.test(file))
  assert.equal(migrationHits.length, 0)
  console.log("  ✓ zero new approval schema")

  console.log(`[${GROWTH_AVA_COMPLETED_WORK_PHASE}] PASS — Ava Completed Work thin projection certified`)
}

main()
