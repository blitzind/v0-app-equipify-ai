/**
 * AVA-OPERATOR-WORKSPACE-3B — Drawer separation certification.
 *
 * Run:
 *   pnpm test:ava-operator-workspace-3b
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"
import {
  estimateOperatorReviewTimeLabel,
  GROWTH_AVA_OPERATOR_DRAWER_REFERENCE_DIVIDER_LABEL,
  GROWTH_AVA_OPERATOR_SECTION_PREPARED_EMAIL,
  GROWTH_AVA_OPERATOR_SECTION_WHY,
  GROWTH_AVA_OPERATOR_SECTION_YOUR_DECISION,
  GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER,
} from "../lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b"

const CERTIFICATION_ID = "ava-operator-workspace-3b-v1" as const

const PRESENTATION_SOURCES = [
  "lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b.ts",
  "components/growth/growth-ava-operator-workspace-review.tsx",
  "components/growth/growth-ava-operator-drawer-reference-divider.tsx",
  "components/growth/growth-ai-copilot.tsx",
  "components/growth/growth-lead-drawer.tsx",
  "components/growth/growth-lead-cognitive-workspace.tsx",
  "components/growth/growth-lead-command-center.tsx",
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

function sampleGeneration(): GrowthAiCopilotGeneration {
  return {
    id: "gen-sample",
    leadId: "lead-1",
    generationType: "cold_email",
    promptVersion: "6.0A-v1",
    promptVariant: "ava_direct_production_cutover_1a",
    inputSnapshot: {},
    generatedContent: "Short body",
    generatedSubject: "Subject",
    classification: { primary: "pursue", rationale: "Strong fit." },
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
  }
}

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-OPERATOR-WORKSPACE-3B focused certification`)

  runGate("QA marker matches certification id", () => {
    assert.equal(GROWTH_AVA_OPERATOR_WORKSPACE_3B_QA_MARKER, CERTIFICATION_ID)
  })

  runGate("Review sections use 3B operator labels", () => {
    const review = readSource("components/growth/growth-ava-operator-workspace-review.tsx")
    const labels = readSource("lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b.ts")
    assert.match(review, /GROWTH_AVA_OPERATOR_SECTION_WHY/)
    assert.match(review, /GROWTH_AVA_OPERATOR_SECTION_PREPARED_EMAIL/)
    assert.match(review, /GROWTH_AVA_OPERATOR_SECTION_YOUR_DECISION/)
    assert.match(review, /GROWTH_AVA_OPERATOR_SECTION_ESTIMATED_REVIEW_TIME/)
    assert.match(labels, /Why Ava recommends this/)
    assert.match(labels, /Prepared Email/)
    assert.doesNotMatch(stripComments(review), /\bConfidence\b/)
  })

  runGate("Estimated review time derives from draft length", () => {
    const short = estimateOperatorReviewTimeLabel(sampleGeneration())
    const long = estimateOperatorReviewTimeLabel({
      ...sampleGeneration(),
      generatedContent: "x".repeat(2000),
      generatedSubject: "y".repeat(200),
    })
    assert.match(short, /seconds/)
    assert.match(long, /minute|45 seconds/)
  })

  runGate("Drawer places Ava review before CRM reference divider", () => {
    const drawer = readSource("components/growth/growth-lead-drawer.tsx")
    const bodyStart = drawer.indexOf("<div className={DRAWER_INNER_SCROLL_CANVAS}>")
    const body = drawer.slice(bodyStart)
    const avaIndex = body.indexOf('surface="drawer-primary"')
    const dividerIndex = body.indexOf("<GrowthAvaOperatorDrawerReferenceDivider")
    const cognitiveIndex = body.indexOf("referenceMode")
    assert.ok(avaIndex >= 0)
    assert.ok(dividerIndex > avaIndex)
    assert.ok(cognitiveIndex > dividerIndex)
    assert.match(drawer, /GROWTH_AVA_OPERATOR_REFERENCE_SECTION_TITLES\.contact/)
  })

  runGate("Reference sections collapse by default", () => {
    const cognitive = readSource("components/growth/growth-lead-cognitive-workspace.tsx")
    assert.match(cognitive, /referenceMode/)
    assert.match(cognitive, /defaultOpen=\{false\}/)
    assert.match(cognitive, /data-ava-operator-reference-mode/)
  })

  runGate("CRM workflow language hidden in reference command center", () => {
    const commandCenter = readSource("components/growth/growth-lead-command-center.tsx")
    assert.match(commandCenter, /operatorReferenceMode/)
    assert.match(commandCenter, /Generate personalization/)
    const drawer = readSource("components/growth/growth-lead-drawer.tsx")
    assert.match(drawer, /operatorReferenceMode/)
  })

  runGate("Reference divider uses operator-facing label", () => {
    const divider = readSource("components/growth/growth-ava-operator-drawer-reference-divider.tsx")
    const labels = readSource("lib/growth/aios/operator-experience/growth-ava-operator-workspace-3b.ts")
    assert.match(divider, /GROWTH_AVA_OPERATOR_DRAWER_REFERENCE_DIVIDER_LABEL/)
    assert.match(labels, /Reference Information/)
  })

  runGate("Presentation layer remains read-only", () => {
    for (const relativePath of PRESENTATION_SOURCES) {
      const source = readSource(relativePath)
      assert.doesNotMatch(source, /runEquipifySupervisedAvaOutreach/)
      assert.doesNotMatch(source, /persistSendableAvaSupervisedDraft/)
      assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE/i)
    }
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
