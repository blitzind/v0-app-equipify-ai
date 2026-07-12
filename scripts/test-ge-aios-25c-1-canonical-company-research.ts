/**
 * GE-AIOS-25C-1 — Canonical company research extension certification.
 * Run: pnpm test:ge-aios-25c-1-canonical-company-research
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyBusinessWebsitePageType,
  EVIDENCE_ENGINE_BUSINESS_SEED_PATHS,
  researchValueReasonForPageType,
} from "../lib/growth/evidence-engine/providers/website-business-page-classifier"
import {
  filterCrawlPlanByRobotsPolicy,
  isUrlDisallowedByRobots,
  parseRobotsTxtPolicy,
  sanitizeUrlForCrawlDiagnostics,
  type WebsiteCrawlPlanEntry,
} from "../lib/growth/contact-discovery/website-crawl-planner"
import { buildProspectKnowledgePack } from "../lib/growth/research/company-evidence/prospect-knowledge-pack"
import { buildCompanyResearchReadModel } from "../lib/growth/research/company-research-read-model"
import {
  buildCompanyEvidencePromotionCandidates,
  COMPANY_EVIDENCE_CI_PROMOTION_MIN_CONFIDENCE,
} from "../lib/growth/company-intelligence/promote-from-company-evidence-candidates"
import { COMPANY_EVIDENCE_MAX_PAGES } from "../lib/growth/research/company-evidence/company-evidence-crawl-budget"
import { lookupAiMemorySourceBinding } from "../lib/growth/aios/ai-memory-source-registry"
import type { GrowthCompanyEvidenceBundle } from "../lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthResearchRunPublicView } from "../lib/growth/research/research-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("[GE-AIOS-25C-1] Canonical company research extension certification")

const orchestrator = readSource("lib/growth/research/research-orchestrator.ts")
assert.ok(orchestrator.includes("collectProspectCompanyEvidence"))
assert.ok(orchestrator.includes("buildProspectKnowledgePack"))
assert.ok(orchestrator.includes("finishProspectResearchRun"))
assert.ok(orchestrator.includes("prospectKnowledgePack_v25c"))
assert.equal(orchestrator.includes("openai"), false)
assert.equal(orchestrator.includes("generateText"), false)
assert.equal(/apollo/i.test(orchestrator), false)

assert.equal(
  lookupAiMemorySourceBinding("research")?.sourceTable,
  "growth.research_runs",
  "registry must point research memory at growth.research_runs",
)
console.log("  ✓ canonical execution path + registry drift fixed")

const migrationNames = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((name) => /25c-1|prospect_knowledge|company_research_read/i.test(name))
assert.equal(migrationNames.length, 0, "no schema migrations for 25C-1")
assert.ok(fs.existsSync(path.join(ROOT, "lib/growth/research/company-research-read-model.ts")))
assert.ok(fs.existsSync(path.join(ROOT, "lib/growth/research/company-evidence/prospect-knowledge-pack.ts")))
console.log("  ✓ no new SoR table / no LLM researcher / no schema migration")

assert.equal(classifyBusinessWebsitePageType("https://example.com/faq"), "faq")
assert.equal(classifyBusinessWebsitePageType("https://example.com/blog/post"), "blog")
assert.equal(classifyBusinessWebsitePageType("https://example.com/news"), "news")
assert.equal(classifyBusinessWebsitePageType("https://example.com/careers"), "careers")
assert.equal(classifyBusinessWebsitePageType("https://example.com/case-studies"), "case_studies")
assert.ok((EVIDENCE_ENGINE_BUSINESS_SEED_PATHS as readonly string[]).includes("/faq"))
assert.ok((EVIDENCE_ENGINE_BUSINESS_SEED_PATHS as readonly string[]).includes("/careers"))
assert.ok((EVIDENCE_ENGINE_BUSINESS_SEED_PATHS as readonly string[]).includes("/blog"))
assert.ok(researchValueReasonForPageType("faq").length > 0)
assert.equal(COMPANY_EVIDENCE_MAX_PAGES, 12)
console.log("  ✓ FAQ/blog/news/careers discovery + bounded page cap")

const robots = parseRobotsTxtPolicy(`User-agent: *
Disallow: /private
Disallow: /admin
Sitemap: https://example.com/sitemap.xml
`)
assert.equal(robots.fetchStatus, "ok")
assert.equal(robots.rulesApplied, true)
assert.ok(robots.disallowPaths.includes("/private"))
assert.equal(isUrlDisallowedByRobots("https://example.com/private/docs", robots.disallowPaths), true)
assert.equal(isUrlDisallowedByRobots("https://example.com/services", robots.disallowPaths), false)

const plan: WebsiteCrawlPlanEntry[] = [
  { url: "https://example.com/", depth: 0, source: "seed" },
  { url: "https://example.com/private", depth: 0, source: "seed" },
  { url: "https://example.com/services", depth: 0, source: "seed" },
]
const filtered = filterCrawlPlanByRobotsPolicy(plan, robots)
assert.equal(filtered.blocked.length, 1)
assert.equal(filtered.allowed.length, 2)
assert.equal(sanitizeUrlForCrawlDiagnostics("https://example.com/x?token=secret"), "https://example.com/x")
assert.equal(parseRobotsTxtPolicy(null).fetchStatus, "missing")
assert.doesNotThrow(() => parseRobotsTxtPolicy("not robots at all!!!@@@"))
console.log("  ✓ robots Disallow skipped safely; tokens stripped from diagnostics")

const bundle: GrowthCompanyEvidenceBundle = {
  qaMarker: "ge-aios-22-company-evidence-v1",
  collectedAt: new Date().toISOString(),
  websiteUrl: "https://imaging.example",
  profile: {
    companyDescription: {
      value: "We are dedicated to MRI equipment service and repair.",
      evidence: "We are dedicated to MRI equipment service and repair.",
      confidence: 0.9,
      sourceUrl: "https://imaging.example/about",
    },
    industriesServed: {
      values: ["Medical imaging"],
      evidence: ["Medical imaging"],
      confidence: 0.88,
      sourceUrls: ["https://imaging.example/industries"],
    },
    primaryProducts: null,
    primaryServices: {
      values: ["MRI Equipment Service", "On-site repair"],
      evidence: ["MRI Equipment Service"],
      confidence: 0.9,
      sourceUrls: ["https://imaging.example/services"],
    },
    targetCustomers: {
      values: ["Hospitals"],
      evidence: ["Hospitals"],
      confidence: 0.86,
      sourceUrls: ["https://imaging.example/customers"],
    },
    businessModel: null,
    geographicMarkets: {
      values: ["Midwest"],
      evidence: ["Midwest"],
      confidence: 0.87,
      sourceUrls: ["https://imaging.example/locations"],
    },
    estimatedCompanySize: null,
    differentiators: null,
    technologySignals: null,
    hiringSignals: null,
  },
  qualityScores: {
    identityConfidence: 0.9,
    websiteConfidence: 0.9,
    industryConfidence: 0.88,
    offeringConfidence: 0.9,
    marketConfidence: 0.87,
    overallEvidenceConfidence: 0.9,
  },
  crawlState: {
    pagesPlanned: 8,
    pagesCrawled: 6,
    pagesSkipped: 1,
    stoppedEarly: false,
    stopReason: null,
    websiteCoverage: [
      "https://imaging.example/",
      "https://imaging.example/services",
      "https://imaging.example/faq",
      "https://imaging.example/careers",
    ],
    missingInformation: ["Business model not inferred from evidence."],
    robots: {
      robots_checked: true,
      robots_fetch_status: "ok",
      robots_rules_applied: false,
      robots_blocked_url_count: 0,
      robots_disallow_count: 0,
    },
    pageSelections: [
      {
        url: "https://imaging.example/faq",
        pageType: "faq",
        source: "seed",
        reason: "buyer_journey",
        status: "crawled",
      },
      {
        url: "https://imaging.example/careers",
        pageType: "careers",
        source: "seed",
        reason: "hiring_signal",
        status: "crawled",
      },
    ],
  },
  missionComparison: null,
  qualificationExplanation: null,
  evidenceSources: ["https://imaging.example/services"],
  cacheKey: "test",
}

const pack = buildProspectKnowledgePack({
  bundle,
  signals: {
    painSignals: [],
    hasCustomerPortal: false,
    hasOnlineBooking: false,
    hasFinancing: false,
  },
})
assert.equal(pack.qaMarker, "ge-aios-25c-1-prospect-knowledge-pack-v1")
assert.ok(pack.observed_facts.some((f) => f.field === "company_description" && f.sourceUrls.length > 0))
assert.ok(pack.observed_facts.some((f) => f.field === "services"))
assert.ok(pack.derived_inferences.some((f) => f.field === "repair_indicator"))
assert.ok(pack.unknowns.some((f) => f.field === "customer_portal_indicator"))
assert.ok(pack.unknowns.some((f) => f.field === "fsm_software_usage"))
assert.equal(
  pack.observed_facts.some((f) => f.field === "customer_portal_indicator" && f.value === false),
  false,
  "missing portal must not become false negative fact",
)
console.log("  ✓ knowledge pack separates facts / inferences / unknowns with attribution")

const run = {
  id: "run-1",
  leadId: "lead-1",
  status: "completed",
  websiteUrl: "https://imaging.example",
  companyName: "Imaging Co",
  industryGuess: "Other",
  employeeSizeGuess: null,
  revenueSizeGuess: null,
  websiteMaturityScore: 60,
  socialPresenceScore: null,
  reputationScore: null,
  technologyScore: null,
  detectedTechnologies: [],
  signals: {
    painSignals: [],
    companyEvidence_v22: bundle,
    prospectKnowledgePack_v25c: pack,
  },
  competitors: [],
  researchSummary: "summary",
  suggestedPitchAngle: null,
  suggestedSequence: null,
  suggestedCallOpening: null,
  recommendedNextAction: null,
  researchConfidence: 80,
  completedAt: new Date().toISOString(),
  failedReason: null,
  createdAt: new Date().toISOString(),
} as GrowthResearchRunPublicView

const sparse = buildCompanyResearchReadModel({ leadId: "empty", prospectRun: null })
assert.ok(sparse.knowledgePack.unknowns.length > 0)
assert.doesNotThrow(() =>
  buildCompanyResearchReadModel({
    leadId: "lead-1",
    companyId: "co-1",
    prospectRun: run,
    canonicalCompany: {
      id: "co-1",
      name: "Imaging Co",
      industry: "Healthcare",
      identityConfidence: 0.95,
    },
    companyIntelligence: [
      {
        category: "industry",
        key: "primary_industry",
        valueText: "Healthcare services",
        confidence: 0.92,
        verificationStatus: "verified",
        sourceUrls: ["https://imaging.example"],
      },
    ],
  }),
)
const conflictModel = buildCompanyResearchReadModel({
  leadId: "lead-1",
  prospectRun: run,
  companyIntelligence: [
    {
      category: "industry",
      key: "primary_industry",
      valueText: "Healthcare services",
      confidence: 0.92,
      verificationStatus: "verified",
    },
  ],
})
assert.ok(
  conflictModel.conflicts.length >= 1 ||
    conflictModel.fields.some((f) => f.precedence === "verified_canonical_fact"),
)
console.log("  ✓ unified read projection handles sparse + conflicting data")

const candidates = buildCompanyEvidencePromotionCandidates(bundle)
assert.ok(candidates.some((c) => c.accepted && c.draft.intelligence_category === "industry"))
assert.ok(COMPANY_EVIDENCE_CI_PROMOTION_MIN_CONFIDENCE >= 0.85)
const negative = buildCompanyEvidencePromotionCandidates({
  ...bundle,
  profile: {
    ...bundle.profile,
    primaryServices: {
      values: ["No portal found"],
      evidence: ["No portal found"],
      confidence: 0.95,
      sourceUrls: ["https://imaging.example"],
    },
  },
})
assert.ok(negative.some((c) => c.rejectReason === "negative_or_absence_claim"))
console.log("  ✓ CI promotion is gated and rejects negatives")

const legacyRepo = readSource("lib/growth/research-repository.ts")
assert.ok(/DEPRECATED|deprecated/i.test(legacyRepo))
assert.equal(orchestrator.includes('from("lead_research_runs")'), false)
assert.equal(orchestrator.includes("insertGrowthLeadResearchRun"), false)
console.log("  ✓ canonical writes do not use lead_research_runs")

const workspace = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
assert.ok(workspace.includes("GrowthAvaEvidencePanel") || workspace.includes("evidence"))
const mappers = readSource("lib/growth/cognitive-workspace/growth-cognitive-workspace-mappers.ts")
assert.ok(mappers.includes("buildProspectKnowledgePack"))
assert.ok(mappers.includes("companyEvidence_v22"))
assert.equal(/apollo/i.test(mappers), false)
console.log("  ✓ cognitive workspace consumes knowledge/evidence without redesign")

const fixtures = [
  { url: "https://svc.example/services", type: "services" },
  { url: "https://svc.example/faq", type: "faq" },
  { url: "https://svc.example/blog", type: "blog" },
  { url: "https://svc.example/careers", type: "careers" },
  { url: "https://svc.example/news", type: "news" },
  { url: "https://onepage.example/", type: "homepage" },
]
for (const fixture of fixtures) {
  assert.equal(classifyBusinessWebsitePageType(fixture.url), fixture.type)
}
const robotsRestricted = filterCrawlPlanByRobotsPolicy(
  [{ url: "https://example.com/secret", depth: 0, source: "sitemap" }],
  parseRobotsTxtPolicy("User-agent: *\nDisallow: /secret\n"),
)
assert.equal(robotsRestricted.blocked.length, 1)
console.log("  ✓ production-style fixture classifications bounded + deterministic")

console.log("[GE-AIOS-25C-1] PASS")
console.log("\nDeferred registry debt (not fixed in 25C-1):")
console.log("  - Legacy lead_research_runs reads still used by NBA/copilot/personalization adapters")
console.log("  - lead_research_notes remain for operator notes")
console.log("  - Video autopilot sourcesUsed strings may still say lead_research_runs")
console.log("  - Autonomous research pilot 5B remains non-crawl parallel surface")
console.log("  - Dual NBA surfaces (persisted vs native) remain intentional")
