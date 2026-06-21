/**
 * GS-AI-PLAYBOOK-1D — Personalization generation UX certification.
 * Run: pnpm test:growth-personalization-generation-ux
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assignGenerationVersionNumbers,
  buildGrowthPersonalizationWorkspaceHref,
  isUuidLike,
  regenerationFeedbackLabel,
} from "../lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
  GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS,
} from "../lib/growth/personalization/personalization-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-1D Personalization Generation UX ===\n")

  assert.equal(
    GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
    "growth-personalization-generation-ux-gs-ai-playbook-1d-v1",
  )
  assert.equal(GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS.length, 6)
  console.log("  ✓ UX QA marker + feedback options")

  assert.match(buildGrowthPersonalizationWorkspaceHref({ leadId: "550e8400-e29b-41d4-a716-446655440000" }), /leadId=/)
  assert.match(
    buildGrowthPersonalizationWorkspaceHref({
      leadId: "550e8400-e29b-41d4-a716-446655440000",
      generationId: "660e8400-e29b-41d4-a716-446655440001",
    }),
    /generationId=/,
  )
  assert.ok(isUuidLike("550e8400-e29b-41d4-a716-446655440000"))
  console.log("  ✓ deep links + UUID detection")

  const versions = assignGenerationVersionNumbers([
    {
      id: "a",
      leadId: "l1",
      leadLabel: "Sterling Biomedical",
      status: "approved",
      subject: "v1",
      body: "body1",
      personalizationScore: 50,
      evidenceCoverageScore: 50,
      riskLevel: "low",
      blockedReason: "",
      sourceSummary: [],
      requiresHumanReview: true,
      approvedAt: null,
      rejectedAt: null,
      sentAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
    {
      id: "b",
      leadId: "l1",
      leadLabel: "Sterling Biomedical",
      status: "draft",
      subject: "v2",
      body: "body2",
      personalizationScore: 55,
      evidenceCoverageScore: 55,
      riskLevel: "low",
      blockedReason: "",
      sourceSummary: [],
      requiresHumanReview: true,
      approvedAt: null,
      rejectedAt: null,
      sentAt: null,
      createdAt: "2026-06-02T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    },
  ])
  assert.equal(versions[0]?.versionNumber, 2)
  assert.equal(versions[1]?.versionNumber, 1)
  console.log("  ✓ version numbering (newest first)")

  assert.equal(regenerationFeedbackLabel("too_generic"), "Too generic")
  console.log("  ✓ regeneration feedback labels")

  const dashboard = readSource("components/growth/personalization/growth-personalization-workspace.tsx")
  assert.doesNotMatch(dashboard, /Lead ID \(generate draft\)/)
  assert.doesNotMatch(dashboard, /placeholder="Lead UUID"/)
  assert.match(dashboard, /GrowthPersonalizationLeadPicker/)
  assert.match(dashboard, /Generate/)
  assert.match(dashboard, /Generation Rejected/)
  assert.match(dashboard, /Generate New Version/)
  assert.match(dashboard, /GrowthPersonalizationGenerationsPanel/)
  assert.match(dashboard, /GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER/)
  console.log("  ✓ dashboard UX — search picker replaces UUID input")

  const picker = readSource("components/growth/personalization/growth-personalization-lead-picker.tsx")
  assert.match(picker, /Search leads, companies, contacts/)
  assert.match(picker, /Recent/)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /calls\/workspace\/leads\/search/)
  console.log("  ✓ lead picker search + recent + keyboard combobox")

  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /regenerationFeedback/)
  assert.match(generateRoute, /priorGenerationId/)
  assert.doesNotMatch(generateRoute, /buildPersonalizationUserPrompt/)
  console.log("  ✓ generate API accepts metadata only (no prompt changes)")

  const rejectRoute = readSource("app/api/platform/growth/personalization/generations/[id]/reject/route.ts")
  assert.match(rejectRoute, /rejectionFeedback/)
  console.log("  ✓ reject API stores feedback metadata")

  const launchLink = readSource("components/growth/personalization/growth-personalization-launch-link.tsx")
  assert.match(launchLink, /buildGrowthPersonalizationWorkspaceHref/)

  const leadDrawer = readSource("components/growth/growth-lead-drawer.tsx")
  assert.match(leadDrawer, /GrowthPersonalizationEmbeddedPanel/)

  const inboxStrip = readSource("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.match(inboxStrip, /GrowthPersonalizationEmbeddedPanel/)

  const callRail = readSource("components/growth/growth-call-workspace-intelligence-rail.tsx")
  assert.match(callRail, /GrowthPersonalizationEmbeddedPanel/)

  const sendrDetail = readSource("components/growth/sendr/growth-sendr-page-detail.tsx")
  assert.match(sendrDetail, /GrowthPersonalizationEmbeddedPanel/)

  const shareBuilder = readSource("components/growth/share-pages/growth-share-page-builder.tsx")
  assert.match(shareBuilder, /GrowthPersonalizationEmbeddedPanel/)
  console.log("  ✓ contextual launch actions wired")

  const evidenceEngine = readSource("lib/growth/personalization/personalization-evidence-engine.ts")
  const playbookEvidence = readSource("lib/growth/personalization/personalization-industry-playbook-evidence.ts")
  const prompt = readSource("lib/growth/personalization/personalization-prompt.ts")
  assert.doesNotMatch(dashboard, /buildIndustryPlaybookEvidenceBundle/)
  assert.match(evidenceEngine, /buildIndustryPlaybookEvidenceBundle/)
  assert.match(playbookEvidence, /teams in this space often/)
  assert.match(prompt, /Verified facts/)
  console.log("  ✓ 1A/1B logic untouched in dashboard (still in evidence engine)")

  const approveRoute = readSource("app/api/platform/growth/personalization/generations/[id]/approve/route.ts")
  assert.match(approveRoute, /humanApprovalConfirmed/)
  console.log("  ✓ approval gates preserved")

  console.log("\nGS-AI-PLAYBOOK-1D personalization generation UX certification passed.\n")
}

main()
