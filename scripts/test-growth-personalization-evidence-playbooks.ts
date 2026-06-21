/**
 * GS-AI-PLAYBOOK-1B — Industry playbook evidence integration certification.
 * Run: pnpm test:growth-personalization-evidence-playbooks
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { resolveIndustryPlaybook } from "../lib/growth/playbooks/industry-playbook-registry"
import {
  buildPersonalizationEvidenceBundle,
  computeEvidenceCoverageScore,
} from "../lib/growth/personalization/personalization-evidence-engine"
import {
  GROWTH_PERSONALIZATION_INDUSTRY_PLAYBOOK_MIN_CONFIDENCE,
  isPersonalizationPlaybookSource,
} from "../lib/growth/personalization/personalization-industry-playbook-evidence"
import {
  buildPersonalizationSystemPrompt,
  buildPersonalizationUserPrompt,
} from "../lib/growth/personalization/personalization-prompt"
import {
  assertPersonalizationCanBeApproved,
  assertPersonalizationCanBeSent,
  validatePersonalizationGeneration,
} from "../lib/growth/personalization/personalization-validator"
import {
  GROWTH_AI_PERSONALIZATION_PLAYBOOK_EVIDENCE_QA_MARKER,
  GROWTH_PERSONALIZATION_SOURCES,
  type GrowthPersonalizationContext,
} from "../lib/growth/personalization/personalization-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function coldLeadContext(overrides: Partial<GrowthPersonalizationContext> = {}): GrowthPersonalizationContext {
  return {
    leadLabel: "Sterling Biomedical Services",
    companyName: "Sterling Biomedical Services",
    industryLabel: "Healthcare",
    relationshipStage: null,
    relationshipSummary: null,
    topObjections: [],
    topPreferences: [],
    opportunitySignals: [],
    bookingSignals: [],
    engagementTier: null,
    territoryLabel: null,
    websiteSignals: [],
    committeeContext: [],
    buyingSignals: [],
    companySignals: [],
    inboxHistory: [],
    sequenceHistory: [],
    templateOverlay: null,
    sourcesUsed: [],
    companySummary: null,
    outreachAngles: [],
    researchPainPoints: [],
    hiringSignals: [],
    researchConfidence: null,
    companyDescription: null,
    naicsCodes: [],
    sicCodes: [],
    ...overrides,
  }
}

function main(): void {
  console.log("\n=== GS-AI-PLAYBOOK-1B Playbook Evidence Integration ===\n")

  assert.equal(
    GROWTH_AI_PERSONALIZATION_PLAYBOOK_EVIDENCE_QA_MARKER,
    "growth-personalization-industry-playbook-evidence-gs-ai-playbook-1b-v1",
  )
  assert.equal(GROWTH_PERSONALIZATION_SOURCES.length, 13)
  assert.ok(GROWTH_PERSONALIZATION_SOURCES.includes("industry_playbook"))
  assert.ok(GROWTH_PERSONALIZATION_SOURCES.includes("capability_mapping"))
  assert.ok(GROWTH_PERSONALIZATION_SOURCES.includes("video_storyline"))
  console.log("  ✓ source types extended (13 total)")

  const migration = readSource("supabase/migrations/20270621153000_growth_personalization_industry_playbook_sources.sql")
  assert.match(migration, /industry_playbook/)
  assert.match(migration, /capability_mapping/)
  assert.match(migration, /video_storyline/)
  console.log("  ✓ migration extends personalization_evidence source_type check")

  const sterlingResolution = resolveIndustryPlaybook({
    companyName: "Sterling Biomedical Services",
    industry: "Healthcare",
  })
  assert.equal(sterlingResolution.resolution.industryId, "biomedical_equipment")
  assert.ok(sterlingResolution.resolution.confidence >= GROWTH_PERSONALIZATION_INDUSTRY_PLAYBOOK_MIN_CONFIDENCE)
  console.log("  ✓ Sterling Biomedical → biomedical_equipment")

  const henryResolution = resolveIndustryPlaybook({
    companyName: "Henry Schein Medical",
    researchSummary: "Medical equipment distribution and service programs.",
  })
  assert.ok(
    henryResolution.resolution.industryId === "medical_equipment" ||
      henryResolution.resolution.industryId === "biomedical_equipment",
  )
  console.log("  ✓ Henry Schein → medical_equipment or biomedical_equipment")

  const hvacResolution = resolveIndustryPlaybook({
    researchSummary: "Commercial HVAC contractor maintaining rooftop units across retail sites.",
  })
  assert.equal(hvacResolution.resolution.industryId, "commercial_hvac")
  console.log("  ✓ Commercial HVAC resolves correctly")

  const unrelatedBundle = buildPersonalizationEvidenceBundle(
    coldLeadContext({ companyName: "Acme Consulting LLC", industryLabel: "Consulting" }),
  )
  const unrelatedPlaybookEvidence = unrelatedBundle.candidates.filter((entry) =>
    isPersonalizationPlaybookSource(entry.sourceType),
  )
  assert.equal(unrelatedPlaybookEvidence.length, 0)
  assert.equal(unrelatedBundle.industryPlaybookDiagnostics, null)
  console.log("  ✓ unrelated company gets no playbook evidence")

  const sterlingBundle = buildPersonalizationEvidenceBundle(coldLeadContext())
  const playbookEvidence = sterlingBundle.candidates.filter((entry) =>
    isPersonalizationPlaybookSource(entry.sourceType),
  )
  assert.ok(playbookEvidence.length >= 8)
  assert.ok(sterlingBundle.industryPlaybookDiagnostics)
  assert.equal(sterlingBundle.industryPlaybookDiagnostics?.isIndustryLevelIntelligence, true)
  assert.ok(
    playbookEvidence.every((entry) =>
      /industry playbook|industry-level|not verified|likely relevance/i.test(entry.evidenceSnippet),
    ),
  )
  console.log("  ✓ playbook evidence appears with industry-level labeling")

  const painEvidence = playbookEvidence.filter((entry) => entry.claimKey.startsWith("industry_playbook_pain_"))
  assert.ok(painEvidence.some((entry) => /PM due dates|calibration|service history/i.test(entry.evidenceSnippet)))
  console.log("  ✓ biomedical pains surfaced (PM, calibration, service history)")

  const verifiedOnlyScore = computeEvidenceCoverageScore([])
  const sterlingScore = computeEvidenceCoverageScore(sterlingBundle.candidates)
  assert.equal(verifiedOnlyScore, 0)
  assert.ok(sterlingScore >= 45 && sterlingScore <= 65, `expected 45–65%, got ${sterlingScore}%`)
  console.log(`  ✓ evidence score calibrated (${sterlingScore}% for cold lead + playbook)`)

  const richContext = coldLeadContext({
    relationshipSummary: "Recent inbox engagement on pricing.",
    opportunitySignals: ["Evaluating operational tooling."],
    bookingSignals: ["Requested a demo slot."],
    companySummary: "Regional biomedical service provider with multi-site HTM coverage.",
    researchPainPoints: ["PM backlog on patient-connected devices."],
    outreachAngles: ["Audit-ready service history."],
    websiteSignals: ["Clinical engineering services listed on website."],
    sourcesUsed: ["relationship_memory", "opportunity_intelligence", "booking_intelligence", "company_signals"],
  })
  const richBundle = buildPersonalizationEvidenceBundle(richContext)
  const richScore = computeEvidenceCoverageScore(richBundle.candidates)
  assert.ok(richScore > sterlingScore)
  assert.ok(richScore <= 100)
  console.log(`  ✓ rich verified context still scores higher (${richScore}%)`)

  const systemPrompt = buildPersonalizationSystemPrompt()
  assert.match(systemPrompt, /verified/i)
  assert.match(systemPrompt, /industry context/i)
  assert.match(systemPrompt, /teams in this space often/i)

  const userPrompt = buildPersonalizationUserPrompt({
    context: coldLeadContext(),
    evidence: sterlingBundle.candidates,
  })
  assert.match(userPrompt, /Verified facts/i)
  assert.match(userPrompt, /Industry context/i)
  assert.match(userPrompt, /NOT verified company facts/i)
  console.log("  ✓ prompt distinguishes verified facts vs industry context")

  const validation = validatePersonalizationGeneration({
    subject: "Quick note for Sterling Biomedical Services",
    body: "Teams in this space often manage PM schedules. Happy to share a brief walkthrough.",
    companyName: "Sterling Biomedical Services",
    evidence: sterlingBundle.candidates,
  })
  assert.equal(validation.blocked, false)
  assert.throws(() => assertPersonalizationCanBeApproved({ status: "blocked", blockedReason: "Unsupported" }))
  assert.throws(() => assertPersonalizationCanBeSent({ status: "draft" }))
  console.log("  ✓ approval/send gates unchanged (no autonomous behavior)")

  const dashboardSource = readSource("components/growth/growth-ai-personalization-dashboard.tsx")
  assert.match(dashboardSource, /IndustryPlaybookDiagnosticsPanel/)
  assert.match(dashboardSource, /industry-level, not company-verified/i)

  const evidenceEngineSource = readSource("lib/growth/personalization/personalization-evidence-engine.ts")
  assert.match(evidenceEngineSource, /buildIndustryPlaybookEvidenceBundle/)
  assert.match(evidenceEngineSource, /PLAYBOOK_TOTAL_BONUS_CAP/)

  console.log("\nGS-AI-PLAYBOOK-1B playbook evidence integration certification passed.\n")
}

main()
