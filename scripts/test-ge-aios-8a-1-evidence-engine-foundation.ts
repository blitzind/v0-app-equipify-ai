/**
 * GE-AIOS-8A-1 — Evidence Engine foundation certification.
 * Run: pnpm test:ge-aios-8a-1-evidence-engine-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  buildEvidenceConfidence,
  calculateOverallEvidenceConfidence,
  GROWTH_EVIDENCE_ENGINE_PHASE,
  GROWTH_EVIDENCE_ENGINE_QA_MARKER,
  detectEvidenceContradictions,
  extractBusinessEvidenceFromHtml,
  normalizeFactKey,
  normalizeProviderCollection,
} from "../lib/growth/evidence-engine"
import { collectWebsiteEvidence } from "../lib/growth/evidence-engine/providers/website-evidence-provider"
import { runEvidenceEngine } from "../lib/growth/evidence-engine/run-evidence-engine"

const PHASE = GROWTH_EVIDENCE_ENGINE_PHASE

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

const SAMPLE_ABOUT_HTML = `<!doctype html>
<html>
  <head>
    <title>Acme Field Services — About</title>
    <meta name="description" content="Acme Field Services provides commercial HVAC maintenance and emergency repair across the Midwest." />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Acme Field Services",
        "description": "Commercial HVAC maintenance and repair for facilities teams.",
        "industry": "Commercial HVAC"
      }
    </script>
  </head>
  <body>
    <h1>About Acme Field Services</h1>
    <p>We help facilities managers keep critical HVAC systems online with proactive maintenance and 24/7 emergency repair.</p>
    <h2>Services</h2>
    <ul>
      <li>Preventive maintenance contracts</li>
      <li>Emergency repair dispatch</li>
      <li>Energy efficiency audits</li>
    </ul>
    <p>Trusted by operations managers, procurement teams, and facility owners nationwide.</p>
  </body>
</html>`

const SAMPLE_CONFLICT_HTML = `<!doctype html>
<html>
  <head>
    <title>Acme Field Services — Company Overview</title>
    <meta name="description" content="Acme Field Services is a residential plumbing company serving homeowners only." />
  </head>
  <body>
    <h1>Residential plumbing for homeowners</h1>
    <p>We specialize in residential plumbing installs and drain cleaning for homeowners across Texas.</p>
  </body>
</html>`

console.log(`[${PHASE}] Evidence Engine foundation certification`)

async function main(): Promise<void> {
assert.equal(GROWTH_EVIDENCE_ENGINE_QA_MARKER, "ge-aios-8a-2-evidence-engine-v1")
assert.equal(normalizeFactKey(" Company.Description "), "company.description")

const overall = calculateOverallEvidenceConfidence({
  evidence_confidence: 0.9,
  extraction_confidence: 0.85,
  verification_confidence: 0.8,
  freshness_confidence: 0.95,
})
assert.ok(overall > 0.8 && overall <= 1)

const aboutEvidence = extractBusinessEvidenceFromHtml({
  html: SAMPLE_ABOUT_HTML,
  pageUrl: "https://acme.example/about",
  pageType: "about",
})
assert.ok(aboutEvidence.length >= 3, "about page should yield structured website evidence")
assert.ok(
  aboutEvidence.some((item) => item.fact_key === "company.description"),
  "expected company.description evidence",
)
assert.ok(
  aboutEvidence.some((item) => item.decision_tier === "structured_extraction"),
  "expected structured extraction tier",
)
assert.equal(
  aboutEvidence.some((item) => item.decision_tier === "fallback_assumption"),
  false,
  "fallback assumptions must not be created",
)

const normalizedAbout = normalizeProviderCollection({
  organization_id: "org-cert-1",
  provider: "website",
  raw_items: aboutEvidence,
  warnings: [],
  diagnostics: {},
})
for (const fact of normalizedAbout.facts) {
  assert.ok(fact.supporting_evidence_ids.length > 0, `fact ${fact.fact_key} must reference evidence`)
}

const conflictItems = [
  ...aboutEvidence.filter((item) => item.fact_key === "company.description").slice(0, 1),
  ...extractBusinessEvidenceFromHtml({
    html: SAMPLE_CONFLICT_HTML,
    pageUrl: "https://acme.example/company",
    pageType: "about",
  }).filter((item) => item.fact_key === "company.description"),
]

const normalizedConflict = normalizeProviderCollection({
  organization_id: "org-cert-1",
  provider: "website",
  raw_items: conflictItems,
  warnings: [],
  diagnostics: {},
})

const contradictionResult = detectEvidenceContradictions({
  organization_id: "org-cert-1",
  facts: normalizedConflict.facts,
  evidence: normalizedConflict.evidence,
})
assert.ok(contradictionResult.contradictions.length > 0, "contradictions must be surfaced, not hidden")
assert.ok(
  contradictionResult.contradictions.every((item) => item.requires_human_review),
  "contradictions require human review",
)

const fixtureProviderOutput = await collectWebsiteEvidence({
  organizationId: "org-cert-1",
  websiteUrl: "https://acme.example",
  fetchHtml: async () => ({ status: "ok", body: SAMPLE_ABOUT_HTML }),
  maxPages: 4,
})

assert.ok(fixtureProviderOutput.raw_items.length > 0, "website provider should return structured evidence")
assert.equal(
  fixtureProviderOutput.raw_items.some((item) => item.decision_tier === "fallback_assumption"),
  false,
)

const engineResult = await runEvidenceEngine({
  admin: {} as import("@supabase/supabase-js").SupabaseClient,
  organizationId: "org-cert-1",
  trigger: "initial",
  websiteUrl: "https://acme.example",
  providers: ["website"],
  deps: {
    collectWebsiteEvidence: async (providerInput) =>
      collectWebsiteEvidence({
        ...providerInput,
        fetchHtml: async () => ({ status: "ok", body: SAMPLE_ABOUT_HTML }),
        maxPages: 4,
      }),
  },
})

assert.equal(engineResult.ok, true)
assert.ok(engineResult.facts.length > 0)
for (const fact of engineResult.facts) {
  assert.ok(fact.supporting_evidence_ids.length > 0)
}
assert.equal(
  engineResult.evidence.some((item) => item.provider === "fallback"),
  false,
)

const forbiddenFragments = [
  "runProspectResearch",
  "runGrowthLeadResearch",
  "runAvaResearchQueueOrchestrator",
  "lead-inbox",
  "lead_inbox",
  "Revenue Queue",
]

const watchedFiles = [
  "lib/growth/evidence-engine/run-evidence-engine.ts",
  "lib/growth/evidence-engine/providers/website-evidence-provider.ts",
]
for (const file of watchedFiles) {
  const source = readSource(file)
  for (const fragment of forbiddenFragments) {
    assert.equal(source.includes(fragment), false, `${file} must not reference ${fragment}`)
  }
}

const runSource = readSource("lib/growth/evidence-engine/run-evidence-engine.ts")
assert.ok(runSource.includes('persist = input.persist === true'))
assert.ok(runSource.includes('persistence: persist ? "database" : "in_memory_only"'))
assert.doesNotMatch(runSource, /\.insert\(|\.update\(|\.upsert\(/)

console.log(`[${PHASE}] certification passed`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
