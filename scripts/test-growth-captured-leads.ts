/**
 * Regression checks for Growth Engine recently captured follow-up workflow.
 * Run: pnpm test:growth-captured-leads
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  countCapturedLeadFilters,
  matchesCapturedLeadFilter,
  projectGrowthCapturedLeadRow,
} from "../lib/growth/captured-leads/captured-lead-projection"
import { GROWTH_CAPTURED_LEADS_QA_MARKER } from "../lib/growth/captured-leads/captured-lead-types"
import type { GrowthLead } from "../lib/growth/types"

assert.equal(GROWTH_CAPTURED_LEADS_QA_MARKER, "growth-captured-leads-v1")

const browserLead = {
  id: "lead-browser-1",
  sourceKind: "browser_extension",
  sourceDetail: "linkedin:https://linkedin.com/company/acme",
  externalRef: "browser_extension:abc",
  companyName: "Acme Medical",
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  website: "https://acme.com",
  addressLine1: null,
  city: null,
  state: null,
  postalCode: null,
  country: "US",
  status: "new",
  promotedOrganizationId: null,
  promotedProspectId: null,
  promotedAt: null,
  score: null,
  notes: null,
  metadata: {
    browser_extension: {
      source_platform: "linkedin",
      source_url: "https://linkedin.com/company/acme",
      captured_at: "2026-05-28T12:00:00.000Z",
      capture_type: "company_only",
    },
    company_prospect: { status: "open" },
    captured_lead_review: { status: "needs_review" },
  },
  latestResearchRunId: null,
  lastResearchedAt: null,
  latestProspectResearchRunId: null,
  lastProspectResearchedAt: null,
  prospectRecommendedNextAction: null,
  researchPriority: "normal",
  callDisposition: null,
  callDispositionAt: null,
  lastCallAt: null,
  followUpAt: null,
  callPriorityScore: null,
  callPriorityTier: null,
  callPriorityComputedAt: null,
  callPriorityOverride: null,
  lastHumanTouchAt: null,
  decisionMakerStatus: null,
  primaryDecisionMakerId: null,
  nextBestAction: "find_decision_maker",
  nextBestActionReason: null,
  nextBestActionComputedAt: null,
  createdBy: null,
  assignedTo: null,
  assignedAt: null,
  assignedBy: null,
  assignmentSource: null,
  createdAt: "2026-05-28T12:00:00.000Z",
  updatedAt: "2026-05-28T12:00:00.000Z",
} as GrowthLead

const manualLead = {
  ...browserLead,
  id: "lead-manual-1",
  sourceKind: "manual",
  contactName: "Jane Doe",
  contactEmail: "jane@acme.com",
  metadata: {
    manual_entry: { entered_at: "2026-05-27T10:00:00.000Z" },
    email_verification: { verified_by_provider: true, provider_status: "valid" },
    captured_lead_review: { status: "reviewed", reviewed_at: "2026-05-27T11:00:00.000Z" },
  },
} as GrowthLead

const browserRow = projectGrowthCapturedLeadRow(browserLead)
assert.ok(browserRow)
assert.equal(browserRow.capture_type, "company_only")
assert.equal(browserRow.source_platform, "linkedin")
assert.equal(browserRow.review_status, "needs_review")
assert.equal(browserRow.enrichment_status, "none")

const manualRow = projectGrowthCapturedLeadRow(manualLead)
assert.ok(manualRow)
assert.equal(manualRow.source_kind, "manual")
assert.equal(manualRow.verification_status, "verified")
assert.equal(manualRow.review_status, "reviewed")

assert.equal(matchesCapturedLeadFilter(browserRow, "company_only"), true)
assert.equal(matchesCapturedLeadFilter(browserRow, "linkedin_captured"), true)
assert.equal(matchesCapturedLeadFilter(browserRow, "needs_review"), true)
assert.equal(matchesCapturedLeadFilter(manualRow, "has_verified_email"), true)

const counts = countCapturedLeadFilters([browserRow, manualRow])
assert.equal(counts.all, 2)
assert.equal(counts.company_only, 1)
assert.equal(counts.has_verified_email, 1)

const projectionSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/captured-leads/captured-lead-projection.ts"),
  "utf8",
)
assert.match(projectionSource, /captured_lead_review/)
assert.match(projectionSource, /contact_discovery_queue/)
assert.match(projectionSource, /email_verification/)

const actionsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/captured-leads/captured-lead-actions.ts"),
  "utf8",
)
assert.match(actionsSource, /mark_reviewed/)
assert.match(actionsSource, /verifyEmailWithProvider/)
assert.match(actionsSource, /queueBrowserIntakeContactDiscovery/)
assert.match(actionsSource, /seedNativeDialerQueueFromCallQueue/)
assert.match(actionsSource, /createGrowthSequenceEnrollmentDraft/)
assert.doesNotMatch(actionsSource, /sendEmail|executeOutreach|enroll.*confirm/i)

const listRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/captured-leads/route.ts"),
  "utf8",
)
assert.match(listRoute, /listCapturedGrowthLeads/)
assert.match(listRoute, /requireGrowthEnginePlatformAccess/)

const actionRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/captured-leads/[leadId]/actions/route.ts"),
  "utf8",
)
assert.match(actionRoute, /runCapturedLeadAction/)

const pageSource = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/leads/captured/page.tsx"),
  "utf8",
)
assert.match(pageSource, /GrowthCapturedLeadsDashboard/)
assert.match(pageSource, /Recently Captured/)

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-captured-leads-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /captured-leads/)
assert.match(dashboardSource, /mark_reviewed/)
assert.match(dashboardSource, /verify_email/)
assert.match(dashboardSource, /queue_contact_discovery/)
assert.match(dashboardSource, /create_sequence_draft/)

const navSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
  "utf8",
)
assert.match(navSource, /recently-captured/)
assert.match(navSource, /\/admin\/growth\/leads\/captured/)

const manualSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/manual-entry/create-manual-growth-contact.ts"),
  "utf8",
)
assert.match(manualSource, /buildDefaultCapturedLeadReviewMetadata/)

const browserIntakeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/browser-intake/create-browser-intake-contact.ts"),
  "utf8",
)
assert.match(browserIntakeSource, /buildDefaultCapturedLeadReviewMetadata/)

console.log("growth-captured-leads checks passed")
