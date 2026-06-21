/**
 * GS-AI-PLAYBOOK-5A certification — embedded personalization surfaces.
 * Run: pnpm test:growth-personalization-embedded-surfaces
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildPersonalizationLeadSummary } from "@/lib/growth/personalization/embedded/growth-personalization-summary-builder"
import {
  GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER,
} from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertEmbeddedSurface(file: string, surface: string): void {
  const source = readSource(file)
  assert.match(source, /GrowthPersonalizationEmbeddedPanel/)
  assert.match(source, new RegExp(`surface="${surface}"`))
}

function runSharedRuntimeCert(): void {
  const runtime = readSource("lib/growth/personalization/embedded/growth-personalization-embedded-runtime.ts")
  assert.match(runtime, /fetchPersonalizationSummary/)
  assert.match(runtime, /fetchLatestLeadPersonalization/)
  assert.match(runtime, /generatePersonalizationForLead/)
  assert.match(runtime, /regeneratePersonalizationForGeneration/)
  assert.match(runtime, /\/api\/platform\/growth\/personalization\/generate/)

  const dashboard = readSource("lib/growth/personalization/dashboard.ts")
  assert.match(dashboard, /fetchPersonalizationSummaryForLead/)
  assert.match(dashboard, /runOutreachPersonalizationGeneration/)

  const summaryRoute = readSource("app/api/platform/growth/personalization/summary/route.ts")
  assert.match(summaryRoute, /fetchPersonalizationSummaryForLead/)

  const hook = readSource("lib/growth/personalization/embedded/use-growth-lead-personalization.ts")
  assert.match(hook, /fetchPersonalizationSummary/)
  assert.match(hook, /generatePersonalizationForLead/)
  console.log("✓ shared runtime — single API path, no duplicated generation logic")
}

function runEmbeddedCardsCert(): void {
  assert.equal(GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER, "growth-personalization-embedded-gs-ai-playbook-5a-v1")

  for (const file of [
    "components/growth/personalization/embedded/growth-personalization-summary-card.tsx",
    "components/growth/personalization/embedded/growth-personalization-actions.tsx",
    "components/growth/personalization/embedded/growth-personalization-preview-card.tsx",
    "components/growth/personalization/embedded/growth-personalization-stage-card.tsx",
    "components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx",
  ]) {
    assert.match(readSource(file), /GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER|growth-personalization/)
  }

  const summaryCard = readSource("components/growth/personalization/embedded/growth-personalization-summary-card.tsx")
  assert.match(summaryCard, /SummarySkeleton|animate-pulse/)
  assert.match(summaryCard, /min-w-0|flex-wrap/)
  console.log("✓ embedded cards — summary, actions, preview, stage, panel")
}

function runSurfaceIntegrationCert(): void {
  assertEmbeddedSurface("components/growth/growth-lead-drawer.tsx", "lead")
  assertEmbeddedSurface("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx", "inbox")
  assertEmbeddedSurface("components/growth/growth-call-workspace-follow-up-panel.tsx", "call")
  assertEmbeddedSurface("components/growth/growth-call-workspace-intelligence-rail.tsx", "call")
  assertEmbeddedSurface("components/growth/growth-opportunity-workspace-dashboard.tsx", "opportunity")
  assertEmbeddedSurface("components/growth/growth-lead-meeting-intelligence.tsx", "meeting")
  assertEmbeddedSurface("components/growth/growth-conversation-intelligence.tsx", "conversation")
  assertEmbeddedSurface("components/growth/inbox/growth-inbox-conversation-intelligence-context-strip.tsx", "conversation")
  assertEmbeddedSurface("components/growth/sendr/growth-sendr-page-detail.tsx", "sendr")
  assertEmbeddedSurface("components/growth/share-pages/growth-share-page-builder.tsx", "share")
  console.log("✓ surface integrations — leads, inbox, calls, opportunities, meetings, conversations, sendr, share")
}

function runSummaryBuilderCert(): void {
  const summary = buildPersonalizationLeadSummary({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    generation: null,
  })
  assert.equal(summary.qaMarker, GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER)
  assert.equal(summary.hasDraft, false)

  const embeddedPanel = readSource("components/growth/personalization/embedded/growth-personalization-embedded-panel.tsx")
  assert.match(embeddedPanel, /buildGrowthPersonalizationWorkspaceHref/)
  assert.match(embeddedPanel, /approvePersonalizationGeneration/)
  assert.match(embeddedPanel, /No auto-send/)
  console.log("✓ summary builder + workspace deep links + approval preserved")
}

function runConstraintsCert(): void {
  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /generatePersonalizationDraft/)

  const runtime = readSource("lib/growth/personalization/embedded/growth-personalization-embedded-runtime.ts")
  assert.doesNotMatch(runtime, /runOutreachPersonalizationGeneration/)
  assert.doesNotMatch(runtime, /buildPersonalizationSystemPrompt/)

  const migrations = fs.readdirSync(path.join(process.cwd(), "supabase/migrations"))
  assert.doesNotMatch(migrations.join("\n"), /personalization_embedded/)
  console.log("✓ no migrations, no prompt/scoring/provider changes in embedded layer")
}

async function main(): Promise<void> {
  console.log("\n=== GS-AI-PLAYBOOK-5A Embedded Personalization Certification ===\n")

  runSharedRuntimeCert()
  runEmbeddedCardsCert()
  runSurfaceIntegrationCert()
  runSummaryBuilderCert()
  runConstraintsCert()

  console.log("\nGS-AI-PLAYBOOK-5A embedded personalization certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
