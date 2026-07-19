/** Regression: review leads must not double-count in admissionsPending. */
import assert from "node:assert/strict"
import { buildPortfolioHealthReadModel } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-health-1a"
import { defaultPortfolioManagementSection } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-target-1a"
import type { GrowthLead } from "@/lib/growth/types"

function reviewLead(id: string): GrowthLead {
  return {
    id,
    organization_id: "org",
    company_name: "Acme Service Co",
    website: "https://acme-service.example",
    status: "new",
    metadata: {
      admission_state: "review",
      admission_reasons: ["pending_operational_keyword_validation"],
    },
  } as GrowthLead
}

const target = {
  qaMarker: "ge-aios-autonomous-portfolio-manager-1a-v1" as const,
  targetActiveCompanies: 100,
  minimumHealthyCompanies: 40,
  replenishBatchSize: 25,
  maximumDailyDiscovery: 50,
  maximumConcurrentResearch: 20,
  ...defaultPortfolioManagementSection(),
}

const health = buildPortfolioHealthReadModel({
  organizationId: "org",
  target,
  leads: [reviewLead("1"), reviewLead("2"), reviewLead("3")],
  eligibleLeadCount: 3,
  approvedProfilePresent: true,
})

assert.equal(health.counts.awaitingReview, 3)
assert.equal(health.counts.awaitingAdmission, 0)
assert.equal(health.admissionsPending, 3, "review leads must count once toward admissionsPending")
console.log("PASS ge-aios-multi-lead-intake-1b admission pending count")
