/**
 * GE-AI-ARCH-2C — AI OS v1 product alignment certification (static).
 * Run: pnpm test:ge-ai-arch-2c-ai-os-v1-product-alignment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthHomeExecutiveBriefingCertFixture } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE,
  customerGrowthOperatorSummary,
} from "../lib/workspace/ai-autonomous-customer-success-operator"
import {
  AI_GROWTH_INITIATIVES_TITLE,
  growthOperatorSummary,
} from "../lib/workspace/ai-autonomous-marketing-operator"
import { AI_REVENUE_ACTIVE_MISSIONS_TITLE } from "../lib/workspace/ai-autonomous-revenue-operator"
import {
  GE_AI_ARCH_2C_QA_MARKER,
  aiOsV1ProductStory,
  GROWTH_HOME_SERVICE_OPERATOR_VISIBLE,
  isGrowthHomeServiceOperatorVisible,
} from "../lib/workspace/ai-os-v1-product-alignment"
import { AI_TEAMMATE_DEFAULT_ROLE, resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[GE-AI-ARCH-2C] AI OS v1 product alignment certification`)

assert.equal(GE_AI_ARCH_2C_QA_MARKER, "ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
assert.equal(GROWTH_HOME_EXECUTIVE_BRIEFING_QA_MARKER, "growth-ge-ai-arch-2c-ai-os-v1-product-alignment-v1")
assert.equal(GROWTH_HOME_SERVICE_OPERATOR_VISIBLE, false)
assert.equal(isGrowthHomeServiceOperatorVisible(), false)
assert.equal(AI_TEAMMATE_DEFAULT_ROLE, "Equipify's AI Growth Operator")
assert.ok(aiOsV1ProductStory(resolveAiTeammatePresentation()).includes("sell Equipify"))
console.log("  ✓ v1 product alignment constants locked")

assert.equal(AI_GROWTH_INITIATIVES_TITLE, "Growth Initiatives")
assert.equal(AI_CUSTOMER_GROWTH_OPPORTUNITIES_TITLE, "Customer Growth Opportunities")
assert.equal(AI_REVENUE_ACTIVE_MISSIONS_TITLE, "My Active Revenue Missions")
console.log("  ✓ mission framework terminology aligned")

const home = buildGrowthHomeExecutiveBriefingCertFixture()
assert.ok(home.activeRevenueMissions.length >= 1)
assert.ok(home.marketingMissions.length >= 1)
assert.ok(home.customerSuccessMissions.length >= 1)
assert.ok(growthOperatorSummary(home.marketingMissions.length)?.includes("sell Equipify"))
assert.ok(customerGrowthOperatorSummary(home.customerSuccessMissions.length)?.includes("Equipify"))
console.log("  ✓ synthesizers reinforce selling Equipify")

const dashboard = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
assert.ok(dashboard.includes("isGrowthHomeServiceOperatorVisible"))
assert.ok(dashboard.includes("showDeliveryIntelligence"))
assert.ok(dashboard.includes("GrowthHomeActiveRevenueMissionsSection"))
assert.ok(dashboard.includes("GrowthHomeMarketingMissionsSection"))
assert.ok(dashboard.includes("GrowthHomeCustomerSuccessMissionsSection"))
assert.ok(dashboard.includes("{showDeliveryIntelligence ? ("))
assert.ok(dashboard.includes("<GrowthHomeServiceMissionsSection missions={briefing.serviceMissions} />"))
console.log("  ✓ Service Operator hidden from default Home layout")

const checkIn = readSource("components/growth/workspace/executive-briefing/growth-home-check-in-section.tsx")
assert.ok(checkIn.includes("showDeliveryIntelligence"))
assert.ok(checkIn.includes("serviceOperatorSummary"))
console.log("  ✓ check-in gates delivery intelligence voice")

const serviceVoice = readSource("lib/growth/workspace/executive-briefing/growth-home-service-mission-synthesizer.ts")
assert.equal(serviceVoice.includes("One technician may need assistance"), false)
assert.equal(serviceVoice.includes("work orders are at risk"), false)
console.log("  ✓ future delivery synthesizer avoids COO language")

const marketingSection = readSource("components/growth/workspace/executive-briefing/growth-home-marketing-missions-section.tsx")
assert.ok(marketingSection.includes("sell Equipify"))
assert.equal(marketingSection.includes("Marketing Operator"), false)

const csSection = readSource("components/growth/workspace/executive-briefing/growth-home-customer-success-missions-section.tsx")
assert.ok(csSection.includes("Equipify customer accounts"))
assert.equal(csSection.includes("Customer Success mission"), false)
console.log("  ✓ Growth and Customer Growth sections scoped to Equipify")

assert.ok(fs.existsSync(path.join(ROOT, "docs/GE-AI-ARCH-2C_AI_OS_V1_PRODUCT_ALIGNMENT.md")))
console.log("  ✓ architecture alignment doc present")

console.log(`[GE-AI-ARCH-2C] PASS — ${GE_AI_ARCH_2C_QA_MARKER}`)
