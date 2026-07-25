/**
 * AVA-HOME-REVIEW-QUEUE-1B — Review queue wiring + presentation certification.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildGrowthHomeReviewQueueDailyBrief,
  buildGrowthHomeReviewQueuePresentation,
  filterSelectableRecommendedRows,
  GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL,
  mapReviewQueueClientError,
  resolveVerifiedWebsiteDisplay,
  shouldHideSingleCompanyFocus,
} from "../lib/growth/home/growth-home-review-queue-1b"
import {
  bulkApproveReviewQueueRows,
  fetchReviewQueuePreview,
} from "../lib/growth/home/growth-home-review-queue-preview-client-1b"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

const dashboard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
)
const queueSection = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ava-outreach-review-queue-section.tsx",
)
const previewCard = readSource(
  "components/growth/workspace/executive-briefing/growth-home-ava-review-queue-preview-card.tsx",
)
const previewClient = readSource("lib/growth/home/growth-home-review-queue-preview-client-1b.ts")
const reviewQueueLib = readSource("lib/growth/home/growth-home-review-queue-1b.ts")

assert.match(dashboard, /GrowthHomeAvaOutreachReviewQueueSection/)
assert.match(dashboard, /GROWTH_HOME_REVIEW_QUEUE_1B_QA_MARKER/)
assert.match(dashboard, /hideSingleCompanyFocus/)
assert.match(dashboard, /reviewQueueDailyBrief/)
assert.match(queueSection, /home-outreach-review-queue/)
assert.match(queueSection, /Select All Recommended/)
assert.match(queueSection, /Approve Selected/)
assert.match(queueSection, /Send Selected/)
assert.match(queueSection, /target="_blank"/)
assert.match(previewCard, /home-review-queue-preview/)
assert.match(previewCard, /Escape/)
assert.match(queueSection, /onFocus/)
assert.match(previewCard, /data-preview-pinned/)
assert.match(previewClient, /bulkApproveReviewQueueRows/)
assert.match(previewClient, /bulkSendReviewQueueRows/)
assert.match(previewClient, /signature-preview/)
assert.match(previewClient, /mapReviewQueueClientError/)
assert.match(reviewQueueLib, /resolveVerifiedWebsiteDisplay/)

const website = resolveVerifiedWebsiteDisplay("https://www.blockimaging.com/about")
assert.equal(website.rootDomain, "blockimaging.com")
assert.equal(website.label, "blockimaging.com")
assert.ok(website.href?.includes("blockimaging.com"))

const consumerWebsite = resolveVerifiedWebsiteDisplay("https://gmail.com")
assert.equal(consumerWebsite.label, GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL)
assert.equal(consumerWebsite.href, null)

const missingWebsite = resolveVerifiedWebsiteDisplay(null)
assert.equal(missingWebsite.label, GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL)

const queue = buildGrowthHomeReviewQueuePresentation({
  packages: [
    {
      itemId: "supervised-draft:gen-1",
      packageId: "gen-1",
      leadId: "lead-1",
      companyName: "Block Imaging",
      decisionMaker: "Josh Block",
      draftCount: 1,
      preparedAt: new Date().toISOString(),
      preparedAgoLabel: "Prepared 5 minutes ago",
      channelLabel: "Quick intro for Block Imaging",
      statusLabel: "Ready for review",
      reviewHref: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
      packageSource: "supervised_ava_generation",
      operatorDetail: "Subject: Quick intro",
    },
    {
      itemId: "supervised-draft:gen-2",
      packageId: "gen-2",
      leadId: "lead-2",
      companyName: "ABC Calibration",
      decisionMaker: "Jane Smith",
      draftCount: 1,
      preparedAt: new Date().toISOString(),
      preparedAgoLabel: "Prepared 10 minutes ago",
      channelLabel: "Intro for ABC Calibration",
      statusLabel: "Ready for review",
      reviewHref: "/growth/leads/crm?open=lead-2&focus=ai-copilot",
      packageSource: "supervised_ava_generation",
      operatorDetail: null,
    },
  ],
  needsInformation: [
    {
      leadId: "lead-3",
      companyName: "ServiceCo",
      decision: "hold",
      rationale: "Website unavailable",
      missingInformation: ["Website unavailable"],
      reviewHref: "/growth/leads/crm?open=lead-3&focus=ai-copilot",
    },
  ],
  leadsById: new Map([
    [
      "lead-1",
      {
        id: "lead-1",
        companyName: "Block Imaging",
        website: "https://blockimaging.com",
        score: 92,
      } as never,
    ],
    [
      "lead-2",
      {
        id: "lead-2",
        companyName: "ABC Calibration",
        website: "https://abccalibration.com",
        score: 87,
      } as never,
    ],
    [
      "lead-3",
      {
        id: "lead-3",
        companyName: "ServiceCo",
        website: null,
        score: 74,
      } as never,
    ],
  ]),
  supervisedReadyByLeadId: new Map([
    [
      "lead-1",
      {
        generationId: "gen-1",
        leadId: "lead-1",
        companyName: "Block Imaging",
        contactName: "Josh Block",
        subject: "Quick intro for Block Imaging",
        rationale: "Strong equipment service fit",
        reviewHref: "/growth/leads/crm?open=lead-1&focus=ai-copilot",
        preparedAt: new Date().toISOString(),
        outboundSendAuthorized: false,
      },
    ],
  ]),
})

assert.equal(queue.rows.length, 3)
assert.equal(queue.recommendedCount, 2)
assert.equal(queue.needsReviewCount, 1)
assert.equal(queue.rows[0]?.website.rootDomain, "blockimaging.com")
assert.equal(queue.rows[2]?.website.label, GROWTH_HOME_REVIEW_QUEUE_NO_WEBSITE_LABEL)
assert.equal(queue.rows[2]?.selectable, false)

const selectable = filterSelectableRecommendedRows(queue.rows)
assert.equal(selectable.length, 2)
assert.ok(shouldHideSingleCompanyFocus({ queue }))

const brief = buildGrowthHomeReviewQueueDailyBrief({
  companiesReviewedToday: 14,
  queue,
})
assert.match(brief.packagesPreparedLine ?? "", /prepared 2 outreach packages/i)
assert.match(brief.recommendSendLine ?? "", /recommend sending 2/i)
assert.match(brief.needsAdditionalReviewLine ?? "", /1 needs additional review/i)

assert.equal(
  mapReviewQueueClientError({ error: "approval_generation_not_found" }),
  "Review package unavailable — the recommendation may have moved.",
)
assert.equal(
  mapReviewQueueClientError({ message: "Failed to fetch" }),
  "Review package unavailable — refresh Home and try again.",
)
assert.equal(mapReviewQueueClientError({ error: "already_sent" }), "Already sent — this package is no longer in your review queue.")

assert.equal(typeof bulkApproveReviewQueueRows, "function")
assert.equal(typeof fetchReviewQueuePreview, "function")

const simplificationBranchMatch = dashboard.match(
  /\{homeSimplificationMode \? \(\s*<>[\s\S]*?\) : \(\s*<>/,
)
assert.ok(simplificationBranchMatch)
const simplificationBranch = simplificationBranchMatch![0]
assert.match(simplificationBranch, /GrowthHomeAvaOutreachReviewQueueSection/)
assert.match(simplificationBranch, /!operatorExperience\.hideSingleCompanyFocus && operatorExperience\.currentFocus/)
assert.match(simplificationBranch, /!operatorExperience\.hideSingleCompanyFocus && avaHero\.recommendationExperience/)

console.log("AVA-HOME-REVIEW-QUEUE-1B wiring and presentation tests passed")
