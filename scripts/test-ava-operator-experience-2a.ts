/**
 * AVA-OPERATOR-EXPERIENCE-2A-CERTIFICATION — Focused presentation-layer certification.
 *
 * Run:
 *   pnpm test:ava-operator-experience-2a
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  buildAvaDirectReviewPipelineSteps,
  formatOperatorPrimaryMissionLabel,
  GROWTH_OPERATOR_HOME_AVA_DIRECT_2A_QA_MARKER,
  GROWTH_OPERATOR_HOME_NEEDS_INFORMATION_TITLE,
  GROWTH_OPERATOR_HOME_READY_FOR_REVIEW_TITLE,
  partitionOperatorWaitingItems,
} from "../lib/growth/aios/operator-experience/growth-operator-home-ava-direct-2a"
import {
  GROWTH_OPERATOR_REVIEW_CTA_LABEL,
  GROWTH_OPERATOR_STATUS_READY_FOR_REVIEW,
  formatOperatorPriorityPackageTitle,
} from "../lib/growth/aios/operator-experience/growth-operator-home-language-2c"
import { resolveRuntimeExecutionPresentation } from "../lib/growth/home/growth-home-runtime-execution-presentation-1b"
import { buildCustomerPackageReviewHref } from "../lib/growth/workspace/ux-1a/review/growth-review-routes"

const CERTIFICATION_ID = "ava-operator-experience-2a-v1" as const

const HOME_PRESENTATION_SOURCES = [
  "lib/growth/aios/operator-experience/growth-operator-home-language-2c.ts",
  "lib/growth/aios/operator-experience/growth-operator-home-ava-direct-2a.ts",
  "lib/growth/home/growth-home-runtime-execution-presentation-1b.ts",
  "lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b.ts",
  "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
] as const

const LEGACY_HOME_TERMS = [
  "Opportunity Package",
  "Review Package",
  "Review opportunity package",
] as const

const CURRENT_HOME_TERMS = [
  "Review email draft",
  "Ready for review",
  "Needs information",
  "Review recommendation",
] as const

const PIPELINE_LABELS = [
  "Company understood",
  "Decision made",
  "Contact selected",
  "Draft prepared",
  "Waiting for approval",
] as const

const FORBIDDEN_PRESENTATION_IMPORTS = [
  /ai_copilot_generations/i,
  /insertGrowthAiCopilotGeneration/,
  /runEquipifyAvaDirectReasoning/,
  /runEquipifySupervisedAvaOutreach/,
  /persistSendableAvaSupervisedDraft/,
  /executeOutbound|sendOutbound|queueSequence|transportJob/i,
  /from\s+["']@\/lib\/growth\/ava-reasoning/,
  /from\s+["']@\/lib\/supabase/,
  /fetch\s*\(/,
] as const

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
}

function assertNoLegacyHomeTerms(relativePath: string): void {
  const source = stripComments(readSource(relativePath))
  for (const term of LEGACY_HOME_TERMS) {
    assert.doesNotMatch(
      source,
      new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
      `${relativePath} must not contain operator-facing "${term}"`,
    )
  }
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

function main(): void {
  console.log(`[${CERTIFICATION_ID}] AVA-OPERATOR-EXPERIENCE-2A focused certification`)

  runGate("QA marker matches certification id", () => {
    assert.equal(GROWTH_OPERATOR_HOME_AVA_DIRECT_2A_QA_MARKER, CERTIFICATION_ID)
  })

  runGate("Home presentation sources omit legacy package terminology", () => {
    for (const relativePath of HOME_PRESENTATION_SOURCES) {
      assertNoLegacyHomeTerms(relativePath)
    }
  })

  runGate("Home presentation sources use current Ava-direct terminology", () => {
    const language = readSource(HOME_PRESENTATION_SOURCES[0])
    const avaDirect = readSource(HOME_PRESENTATION_SOURCES[1])
    const waitingSection = readSource(HOME_PRESENTATION_SOURCES[4])

    assert.equal(GROWTH_OPERATOR_REVIEW_CTA_LABEL, "Review email draft")
    assert.equal(GROWTH_OPERATOR_STATUS_READY_FOR_REVIEW, "Ready for review")
    assert.equal(GROWTH_OPERATOR_HOME_READY_FOR_REVIEW_TITLE, "Ready for review")
    assert.equal(GROWTH_OPERATOR_HOME_NEEDS_INFORMATION_TITLE, "Needs information")

    for (const term of CURRENT_HOME_TERMS) {
      const found =
        language.includes(term) || avaDirect.includes(term) || waitingSection.includes(term)
      assert.ok(found, `Expected current Home term "${term}" in milestone presentation sources`)
    }

    assert.match(formatOperatorPriorityPackageTitle("Block Imaging"), /Review recommendation — Block Imaging/)
  })

  runGate("Operator mission renders actionable draft review labels", () => {
    assert.equal(formatOperatorPrimaryMissionLabel({ pendingDraftCount: 2 }), "Review 2 email drafts")
    assert.equal(
      formatOperatorPrimaryMissionLabel({ pendingDraftCount: 1, companyName: "Block Imaging" }),
      "Approve outreach for Block Imaging",
    )

    const runtime = resolveRuntimeExecutionPresentation({
      pendingApprovals: 2,
      operatorApprovalCompanyName: "Block Imaging",
    })
    assert.equal(runtime.primaryMissionLabel, "Review 2 email drafts")
    assert.equal(runtime.currentActivityLabel, "Review 2 email drafts")
  })

  runGate("Runtime pipeline uses Ava-direct review stages", () => {
    const steps = buildAvaDirectReviewPipelineSteps(null)
    assert.equal(steps.length, PIPELINE_LABELS.length)
    for (const label of PIPELINE_LABELS) {
      assert.ok(
        steps.some((step) => step.label === label),
        `Missing pipeline label "${label}"`,
      )
    }

    const runtimeSource = readSource(HOME_PRESENTATION_SOURCES[2])
    assert.match(runtimeSource, /buildAvaDirectReviewPipelineSteps/)
    assert.match(runtimeSource, /formatOperatorPrimaryMissionLabel/)
  })

  runGate("Review routing deep-links to AI Copilot draft focus", () => {
    const reviewRoutes = readSource("lib/growth/workspace/ux-1a/review/growth-review-routes.ts")
    assert.match(reviewRoutes, /focus:\s*"ai-copilot"/)

    const href = buildCustomerPackageReviewHref("6d9220f0-2960-468c-b4be-5d7595d292c3")
    assert.match(href, /focus=ai-copilot/)
    assert.match(href, /open=6d9220f0-2960-468c-b4be-5d7595d292c3/)
  })

  runGate("Waiting section partitions ready-for-review and needs-information items", () => {
    const waitingSection = readSource(HOME_PRESENTATION_SOURCES[4])
    assert.match(waitingSection, /partitionOperatorWaitingItems/)
    assert.match(waitingSection, /GROWTH_OPERATOR_HOME_READY_FOR_REVIEW_TITLE/)
    assert.match(waitingSection, /GROWTH_OPERATOR_HOME_NEEDS_INFORMATION_TITLE/)
    assert.match(waitingSection, /readyForReviewItems/)
    assert.match(waitingSection, /needsInformationItems/)

    const partitioned = partitionOperatorWaitingItems([
      {
        id: "approval-1",
        label: "Review recommendation — Block Imaging",
        detail: "1 email draft prepared",
        href: "/growth/leads/crm?open=lead-1",
        category: "approval",
      },
      {
        id: "hold-1",
        label: "Need decision maker — Hughes Corp",
        detail: "Website unavailable for contact selection",
        href: "/growth/leads/crm?open=lead-2",
      },
    ])
    assert.equal(partitioned.readyForReview.length, 1)
    assert.equal(partitioned.needsInformation.length, 1)
    assert.equal(partitioned.other.length, 0)
  })

  runGate("Presentation helpers remain presentation-only (no reasoning/persistence/API wiring)", () => {
    const avaDirectSource = readSource(HOME_PRESENTATION_SOURCES[1])
    for (const pattern of FORBIDDEN_PRESENTATION_IMPORTS) {
      assert.doesNotMatch(
        avaDirectSource,
        pattern,
        `growth-operator-home-ava-direct-2a.ts must not contain ${pattern}`,
      )
    }
    assert.doesNotMatch(
      avaDirectSource,
      /ai_copilot_generations|workspace-summary|buildGrowthHomeWorkspaceSummary/i,
    )
  })

  console.log(`[${CERTIFICATION_ID}] PASS`)
}

main()
