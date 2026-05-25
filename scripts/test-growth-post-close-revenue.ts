/**
 * Regression checks for Growth Engine post-close revenue (slice 6.25A).
 * Run: pnpm test:growth-post-close-revenue
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeCustomerExpansionScore,
  computeCustomerHealthScore,
  deriveCustomerLifecycleStage,
  healthScoreBand,
  isReferralEligible,
  isRenewalWindowOpen,
  isReviewEligible,
} from "../lib/growth/customer-lifecycle/customer-health-engine"
import {
  GROWTH_CUSTOMER_LIFECYCLE_STAGES,
  GROWTH_CUSTOMER_ONBOARDING_TASK_KEYS,
  GROWTH_POST_CLOSE_REVENUE_QA_MARKER,
} from "../lib/growth/customer-lifecycle/customer-lifecycle-types"
import { GROWTH_NOTIFICATION_SOURCE_SYSTEMS, GROWTH_NOTIFICATION_TYPES } from "../lib/growth/notifications/notification-types"
import { GROWTH_LEAD_TIMELINE_EVENT_TYPES } from "../lib/growth/timeline-types"

assert.equal(GROWTH_POST_CLOSE_REVENUE_QA_MARKER, "post-close-revenue-v1")
assert.equal(GROWTH_CUSTOMER_LIFECYCLE_STAGES.length, 8)
assert.equal(GROWTH_CUSTOMER_ONBOARDING_TASK_KEYS.length, 6)

const healthy = computeCustomerHealthScore({
  lastEngagementAt: new Date().toISOString(),
  activationAt: new Date().toISOString(),
  firstValueAt: new Date().toISOString(),
  onboardingCompleted: true,
  completedMeetingsCount: 2,
  completedOnboardingTasksCount: 4,
  openOnboardingTasksCount: 0,
  overdueOnboardingTasksCount: 0,
  missedFollowupsCount: 0,
  renewalDate: null,
})
assert.ok(healthy.score >= 70)
assert.ok(healthy.indicators.includes("recent_engagement"))

const unhealthy = computeCustomerHealthScore({
  lastEngagementAt: null,
  activationAt: null,
  firstValueAt: null,
  onboardingCompleted: false,
  completedMeetingsCount: 0,
  completedOnboardingTasksCount: 0,
  openOnboardingTasksCount: 3,
  overdueOnboardingTasksCount: 2,
  missedFollowupsCount: 1,
  renewalDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
})
assert.ok(unhealthy.score < healthy.score)
assert.ok(unhealthy.indicators.includes("inactivity"))

assert.ok(isRenewalWindowOpen(new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), 90))
assert.equal(
  isReviewEligible({
    onboardingCompleted: true,
    healthScore: 65,
    reviewStatus: "none",
    minHealthScore: 60,
  }),
  true,
)
assert.equal(
  isReferralEligible({
    lifecycleStage: "healthy",
    lifecycleAgeDays: 120,
    healthScore: 75,
    reviewReceived: true,
    referralStatus: "none",
    minLifecycleDays: 90,
    minHealthScore: 70,
  }),
  true,
)

const expansionScore = computeCustomerExpansionScore({
  healthScore: 80,
  lifecycleStage: "healthy",
  lifecycleAgeDays: 120,
  reviewReceived: true,
  completedMeetingsCount: 3,
  expansionOpportunityCount: 1,
})
assert.ok(expansionScore >= 70)

const stage = deriveCustomerLifecycleStage({
  onboardingStatus: "completed",
  activationAt: new Date().toISOString(),
  healthScore: 72,
  expansionScore: 75,
  renewalDate: null,
  renewalWindowOpen: false,
  lastEngagementAt: new Date().toISOString(),
})
assert.equal(stage, "expansion_candidate")
assert.equal(healthScoreBand(85), "excellent")

for (const type of [
  "onboarding_overdue",
  "review_request_due",
  "review_received",
  "referral_eligible",
  "renewal_due",
  "renewal_risk",
  "expansion_candidate",
  "churn_risk",
  "followup_missing",
] as const) {
  assert.ok(GROWTH_NOTIFICATION_TYPES.includes(type))
}

for (const type of [
  "customer_created",
  "onboarding_started",
  "onboarding_completed",
  "activation_recorded",
  "review_requested",
  "review_received",
  "referral_requested",
  "referral_received",
  "renewal_window_opened",
  "renewal_due",
  "expansion_candidate_detected",
  "churn_risk_detected",
] as const) {
  assert.ok(GROWTH_LEAD_TIMELINE_EVENT_TYPES.includes(type))
}

assert.ok(GROWTH_NOTIFICATION_SOURCE_SYSTEMS.includes("post_close"))

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270301120000_growth_engine_post_close_revenue.sql"),
  "utf8",
)
assert.match(migrationSource, /create table if not exists growth\.customer_profiles/)
assert.match(migrationSource, /create table if not exists growth\.customer_onboarding_tasks/)
assert.match(migrationSource, /customer_created/)
assert.match(migrationSource, /idx_growth_customer_profiles_owner_stage/)

const mutateSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/customer-lifecycle/mutate-customer-profile.ts"),
  "utf8",
)
assert.match(mutateSource, /createGrowthCustomerProfileFromCloseWon/)
assert.doesNotMatch(mutateSource, /updateGrowthOpportunityStage/)

const onboardingSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/customer-lifecycle/customer-onboarding-task-repository.ts"),
  "utf8",
)
assert.match(onboardingSource, /No auto-send|Human-owned/i)

const uiSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-customer-lifecycle-dashboard.tsx"),
  "utf8",
)
assert.match(uiSource, /Human-owned lifecycle/)
assert.match(uiSource, /Request review/)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/customer-lifecycle/dashboard/route.ts"),
  "utf8",
)
assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

console.log("growth-post-close-revenue: all checks passed")
