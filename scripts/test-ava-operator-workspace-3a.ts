/**
 * AVA-OPERATOR-WORKSPACE-3A — Operator workspace presentation certification.
 *
 * Run:
 *   pnpm test:ava-operator-workspace-3a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import {
  formatOperatorGenerationTypeLabel,
  GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER,
  isEngineeringOperatorLabel,
  projectAvaRecommendationFromGeneration,
  resolvePrimaryOperatorReviewGeneration,
  resolveOperatorConfidenceLabel,
} from "../lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a"

const CERTIFICATION_ID = "ava-operator-workspace-3a-v1" as const

const PRESENTATION_SOURCES = [
  "lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a.ts",
  "components/growth/growth-ava-operator-workspace-review.tsx",
  "components/growth/growth-ai-copilot.tsx",
] as const

const FORBIDDEN_PRESENTATION_PATTERNS = [
  /runEquipifySupervisedAvaOutreach/,
  /persistSendableAvaSupervisedDraft/,
  /runEquipifyAvaDirectReasoning/,
  /CREATE TABLE|ALTER TABLE|DROP TABLE/i,
  /from\s+["']@\/lib\/supabase/,
] as const

const ENGINEERING_TERMS = [
  "AVA_DIRECT_PRODUCTION_CUTOVER_1A",
  "CANONICAL_SEND_PLANE",
  "History",
  "Approve + Queue",
  "Queue & Execute",
  "cold email",
  "promptVariant",
] as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function runGate(label: string, fn: () => void): void {
  try {
    fn()
    console.log(`  ✓ ${label}`)
  } catch (error) {
    console.error(`  ✗ ${label}`)
    throw error
  }
}

function sampleGeneration(overrides: Partial<GrowthAiCopilotGeneration> = {}): GrowthAiCopilotGeneration {
  return {
    id: "gen-sample",
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {
      contactsSupplied: [
        {
          name: "Josh Block",
          title: "President",
          email: "josh@blockimaging.com",
          contactabilityStatus: "contactable",
        },
      ],
    },
    generatedContent: "Hi Josh,\n\nI noticed Block Imaging's nationwide service footprint...",
    generatedSubject: "Imaging equipment lifecycle support",
    classification: {
      primary: "pursue",
      generationMode: "ava_direct_production_cutover_1a",
      rationale:
        "Block Imaging closely matches Equipify's ideal customer profile. Their nationwide imaging equipment service operation aligns well with Equipify's asset lifecycle and service workflow capabilities.",
      recommendedContact: {
        name: "Josh Block",
        title: "President",
        email: "josh@blockimaging.com",
      },
    },
    status: "draft",
    sourceReplyId: null,
    inputHash: null,
    playbookInfluenceScore: 0,
    playbookAttribution: {},
    approvedAt: null,
    approvedBy: null,
    sentAt: null,
    createdBy: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-OPERATOR-WORKSPACE-3A focused certification`)

  runGate("QA marker matches certification id", () => {
    assert.equal(GROWTH_AVA_OPERATOR_WORKSPACE_3A_QA_MARKER, CERTIFICATION_ID)
  })

  runGate("Operator labels replace engineering generation terminology", () => {
    assert.equal(formatOperatorGenerationTypeLabel("cold_email"), "Recommended Email")
    assert.equal(resolveOperatorConfidenceLabel(sampleGeneration()), "Recommended")
    assert.equal(isEngineeringOperatorLabel("ava_direct_production_cutover_1a"), true)
    assert.equal(isEngineeringOperatorLabel("canonical_send_plane"), true)
    assert.equal(isEngineeringOperatorLabel("Recommended"), false)
  })

  runGate("Recommendation projection surfaces contact, reason, and confidence", () => {
    const view = projectAvaRecommendationFromGeneration({
      generation: sampleGeneration(),
      lead: {
        companyName: "Block Imaging",
        contactName: null,
        contactEmail: null,
      },
    })
    assert.equal(view.contactName, "Josh Block")
    assert.equal(view.contactTitle, "President")
    assert.equal(view.contactEmail, "josh@blockimaging.com")
    assert.match(view.rationale ?? "", /ideal customer profile/i)
    assert.equal(view.confidenceLabel, "Recommended")
  })

  runGate("Primary review generation prefers draft email over legacy approved rows", () => {
    const draft = sampleGeneration({ id: "draft-1", status: "draft" })
    const approved = sampleGeneration({
      id: "approved-1",
      status: "approved",
      promptVariant: "default",
      classification: { primary: "canonical_send_plane" },
    })
    assert.equal(resolvePrimaryOperatorReviewGeneration([approved, draft])?.id, "draft-1")
  })

  runGate("Copilot workspace uses unified review surface", () => {
    const copilot = readSource("components/growth/growth-ai-copilot.tsx")
    const review = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
    const presentation = readSource("lib/growth/aios/operator-experience/growth-ava-operator-workspace-3a.ts")

    assert.match(copilot, /GrowthAvaOperatorWorkspaceReview/)
    assert.match(copilot, /resolvePrimaryOperatorReviewGeneration/)
    assert.match(presentation, /recommends contacting/)
    assert.match(review, /formatAvaRecommendsContactHeading/)
    assert.match(review, /Recommendation/)
    assert.match(review, /Email/)
    assert.match(review, /Decision/)
    assert.match(review, /Approve/)
    assert.match(review, /Edit/)
    assert.match(review, /Reject/)
    assert.match(review, /Technical details/)
  })

  runGate("Operator UI omits engineering metadata from primary surface", () => {
    const copilot = stripComments(readSource("components/growth/growth-ai-copilot.tsx"))
    const review = stripComments(readSource("components/growth/growth-ava-operator-workspace-review.tsx"))

    for (const term of ENGINEERING_TERMS) {
      assert.doesNotMatch(copilot, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    }

    assert.doesNotMatch(review, /promptVariant|generationMode|CANONICAL_SEND_PLANE/i)
    assert.match(review, /To/)
    assert.match(review, /Subject/)
    assert.match(review, /Body/)
  })

  runGate("Presentation layer does not alter reasoning, persistence, or transport", () => {
    for (const relativePath of PRESENTATION_SOURCES) {
      const source = readSource(relativePath)
      for (const pattern of FORBIDDEN_PRESENTATION_PATTERNS) {
        assert.doesNotMatch(source, pattern, `${relativePath} must remain presentation-only`)
      }
    }
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
