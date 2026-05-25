/**
 * Regression checks for Growth AI Research Agent slice 6.28A.
 * Run: pnpm test:growth-ai-research-agent
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeGrowthLeadNextBestAction } from "../lib/growth/next-best-action"
import { classifyProspectIndustry } from "../lib/growth/research/industry-classifier"
import { mapProspectResearchRecommendationToNba } from "../lib/growth/research/nba-research-bridge"
import { detectProspectPainSignals } from "../lib/growth/research/pain-signal-detector"
import { recommendProspectNextAction } from "../lib/growth/research/pitch-angle-generator"
import { buildProspectResearchInputHash } from "../lib/growth/research/research-input-hash"
import { scoreWebsiteMaturity } from "../lib/growth/research/website-maturity-score"
import { detectWebsiteTechnologies } from "../lib/growth/research/technology-detector"
import { GROWTH_AI_RESEARCH_AGENT_QA_MARKER } from "../lib/growth/research/research-types"

assert.equal(GROWTH_AI_RESEARCH_AGENT_QA_MARKER, "ai-research-agent-v1")

const sampleHtml = `
<html><head><title>Acme HVAC Services</title><meta name="viewport" content="width=device-width"></head>
<body><h2>Air conditioning repair</h2><h2>Heating maintenance</h2>
<a href="https://facebook.com/acme">Facebook</a>
<script src="https://www.googletagmanager.com/gtag/js"></script>
<script>housecallpro</script>
</body></html>`

const sampleText =
  "Acme HVAC Services provides heating, cooling, and emergency repair across Dallas. Request service online. 25 technicians."

const scrape = {
  url: "https://acmehvac.example",
  fetchStatus: "ok",
  title: "Acme HVAC Services",
  metaDescription: "HVAC repair",
  services: ["Air conditioning repair", "Heating maintenance"],
  serviceAreas: ["Serving Dallas"],
  contactMethods: ["phone", "contact_form"],
  plainText: sampleText,
  html: sampleHtml,
  hasSsl: true,
  hasMobileViewport: true,
}

const industry = classifyProspectIndustry("Acme HVAC", scrape)
assert.equal(industry.industry, "HVAC")
assert.ok(industry.confidence >= 40)

const maturity = scoreWebsiteMaturity(sampleHtml, sampleText, scrape)
assert.ok(maturity.score >= 20 && maturity.score <= 100)

const pain = detectProspectPainSignals(sampleHtml, sampleText, scrape, maturity.score)
assert.ok(pain.painSignals.includes("missing_online_booking") || pain.painSignals.includes("missing_chat"))

const tech = detectWebsiteTechnologies(sampleHtml, sampleText)
assert.ok(tech.technologies.some((entry) => /Google Analytics|Housecall Pro/i.test(entry)))

const hashA = buildProspectResearchInputHash({ companyName: "Acme", website: "https://acme.com", rebuild: false })
const hashB = buildProspectResearchInputHash({ companyName: "Acme", website: "https://acme.com", rebuild: false })
const hashRebuild = buildProspectResearchInputHash({ companyName: "Acme", website: "https://acme.com", rebuild: true })
assert.equal(hashA, hashB)
assert.notEqual(hashA, hashRebuild)

const recommended = recommendProspectNextAction({
  painSignals: pain.painSignals,
  maturityScore: maturity.score,
  fetchStatus: "ok",
  hasPhone: true,
})
assert.ok(["Call Prospect", "Enroll Sequence", "Schedule Demo", "Follow Up", "Review Website", "Manual Review"].includes(recommended))

assert.equal(mapProspectResearchRecommendationToNba("Call Prospect"), "call_primary_contact")
assert.equal(mapProspectResearchRecommendationToNba("Enroll Sequence"), "start_recommended_sequence")
assert.equal(mapProspectResearchRecommendationToNba("Review Website"), "fix_website_research")

const nba = computeGrowthLeadNextBestAction({
  status: "enriched",
  score: 55,
  website: "https://acme.com",
  websiteFetchStatus: "ok",
  lastResearchedAt: null,
  latestResearchRunId: null,
  latestProspectResearchRunId: "00000000-0000-4000-8000-000000000001",
  lastProspectResearchedAt: new Date().toISOString(),
  prospectRecommendedNextAction: "Call Prospect",
  contactPhone: "+15555550123",
  callDisposition: null,
  followUpAt: null,
  recommendedNextAction: "Call Prospect",
  decisionMakerStatus: "confirmed",
  primaryDecisionMakerPhone: null,
})

assert.equal(nba.action, "call_primary_contact")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270307120000_growth_engine_ai_research_agent.sql"),
  "utf8",
)
assert.match(migration, /growth\.research_runs/)
assert.match(migration, /website_maturity_score/)
assert.match(migration, /force row level security/)

const card = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-prospect-intelligence-card.tsx"), "utf8")
assert.match(card, /data-qa-marker=\{GROWTH_AI_RESEARCH_AGENT_QA_MARKER\}/)
assert.match(card, /dark:/)
assert.doesNotMatch(card, /input_snapshot|raw payload|website_text_excerpt/i)

const runRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/research/run/route.ts"),
  "utf8",
)
assert.match(runRoute, /requireGrowthEnginePlatformAccess/)
assert.match(runRoute, /runProspectResearch/)

console.log("growth-ai-research-agent: all checks passed")
