/**
 * GS-AI-PLAYBOOK-4D.2 certification — Personalization workspace UX.
 * Run: pnpm test:growth-personalization-workspace
 */

import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildOriginalAiDraftSnapshot,
  parseOriginalAiDraftSnapshot,
  resolvePersonalizationOriginalAiDraft,
} from "@/lib/growth/personalization/growth-personalization-stack-b-metadata"
import {
  formatPersonalizationDraftBodyForDisplay,
  formatPersonalizationDraftTimestamp,
} from "@/lib/growth/personalization/personalization-generation-ux"
import { buildGrowthPersonalizationWorkspaceHref } from "@/lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS,
  persistPersonalizationDiagnosticsPreferences,
  readPersonalizationDiagnosticsPreferences,
} from "@/lib/growth/personalization/personalization-generation-ux"
import {
  GROWTH_PERSONALIZATION_LEGACY_ADMIN_PATH,
  GROWTH_PERSONALIZATION_WORKSPACE_PATH,
  GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER,
} from "@/lib/growth/personalization/personalization-generation-ux"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function runRouteCert(): void {
  assert.equal(GROWTH_PERSONALIZATION_WORKSPACE_PATH, "/growth/personalization")
  assert.equal(GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER, "growth-personalization-workspace-gs-ai-playbook-4d2-v1")

  const workspacePage = readSource("app/(growth)/growth/personalization/page.tsx")
  assert.match(workspacePage, /GrowthPersonalizationPageClient/)
  assert.match(workspacePage, /GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER/)

  const pageClient = readSource("components/growth/personalization/growth-personalization-page-client.tsx")
  assert.match(pageClient, /GrowthPersonalizationWorkspace/)
  assert.doesNotMatch(pageClient, /GrowthAiPersonalizationDashboardView/)
  assert.doesNotMatch(pageClient, /growth-ai-personalization-dashboard/)

  const legacyPage = readSource("app/(admin)/admin/growth/copilot/personalization/page.tsx")
  assert.match(legacyPage, /redirect/)
  assert.match(legacyPage, /GROWTH_PERSONALIZATION_WORKSPACE_PATH/)
  assert.match(legacyPage, /searchParams/)
  assert.doesNotMatch(legacyPage, /PlatformAdminPageShell/)

  const href = buildGrowthPersonalizationWorkspaceHref({
    leadId: "550e8400-e29b-41d4-a716-446655440000",
    generationId: "660e8400-e29b-41d4-a716-446655440001",
  })
  assert.match(href, /^\/growth\/personalization\?/)
  assert.match(href, /leadId=/)
  assert.match(href, /generationId=/)
  console.log("✓ route migration — workspace canonical + admin redirect + query params")
}

function runNavigationCert(): void {
  const shellNav = readSource("lib/growth/navigation/growth-workspace-shell-navigation.ts")
  assert.match(shellNav, /workspace-personalization/)
  assert.match(shellNav, /personalization/)

  const sidebarIa = readSource("lib/growth/navigation/growth-workspace-sidebar-ia.ts")
  assert.match(sidebarIa, /"personalization"/)

  const catalog = readSource("lib/growth/navigation/growth-route-catalog-data.ts")
  assert.match(catalog, /workspace-personalization/)
  assert.match(catalog, /admin-copilot-personalization/)
  console.log("✓ workspace sidebar registration")
}

function runWorkspaceLayoutCert(): void {
  const workspace = readSource("components/growth/personalization/growth-personalization-workspace.tsx")
  assert.match(workspace, /GrowthPersonalizationDraftEditor/)
  assert.match(workspace, /GrowthPersonalizationDiagnosticsPanel/)
  assert.match(workspace, /GrowthPersonalizationVersionHistorySummary/)
  assert.match(workspace, /GrowthPersonalizationVersionHistoryDrawer/)
  assert.doesNotMatch(workspace, /GrowthPersonalizationGenerationsPanel/)
  assert.match(workspace, /overflow-y-auto/)
  console.log("✓ workspace layout — draft-first, version history drawer, scroll regions")
}

function runGenerationsPanelCert(): void {
  const summary = readSource("components/growth/personalization/growth-personalization-version-history-summary.tsx")
  assert.match(summary, /Version History/)
  assert.match(summary, /View History/)
  assert.match(summary, /formatPersonalizationDraftTimestamp/)

  const drawer = readSource("components/growth/personalization/growth-personalization-version-history-drawer.tsx")
  assert.match(drawer, /Version History/)
  assert.match(drawer, /Preview/)
  assert.match(drawer, /Compare/)
  assert.match(drawer, /Use This Version/)
  assert.match(drawer, /Regenerate From This Version/)
  assert.match(drawer, /max-h-\[100dvh\]/)
  console.log("✓ compact version summary + searchable drawer")
}

function runDraftFormattingCert(): void {
  const raw =
    "Hi Nicole, Many biomedical equipment service organizations struggle with PM due dates. I noticed you're the President of Sterling Biomedical. Equipify helps teams centralize regulated PM scheduling. Is service visibility a bottleneck?"
  const formatted = formatPersonalizationDraftBodyForDisplay(raw)
  assert.match(formatted, /\n\n/)
  const paragraphs = formatted.split("\n\n")
  assert.ok(paragraphs.length >= 2)
  assert.ok(paragraphs.every((paragraph) => paragraph.split(SENTENCE_SPLIT).filter(Boolean).length <= 3))

  assert.match(formatPersonalizationDraftTimestamp("2026-06-21T15:12:00.000Z"), /Jun/)
  console.log("✓ paragraph formatting — display only")
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

function runSplitEditorCert(): void {
  const editor = readSource("components/growth/personalization/growth-personalization-draft-editor.tsx")
  assert.match(editor, /AI Draft/)
  assert.match(editor, /My Edits Preview/)
  assert.match(editor, /GrowthPersonalizationDraftBodyPreview/)
  assert.match(editor, /Reset to AI Draft/)
  assert.match(editor, /Save Draft/)

  const dashboard = readSource("lib/growth/personalization/dashboard.ts")
  assert.match(dashboard, /original_ai_draft/)
  assert.match(dashboard, /preservedOriginalDraft/)

  const snapshot = buildOriginalAiDraftSnapshot({ subject: "Hello", body: "Original body" })
  const parsed = parseOriginalAiDraftSnapshot({ original_ai_draft: snapshot })
  assert.equal(parsed?.body, "Original body")
  const resolved = resolvePersonalizationOriginalAiDraft({
    metadata: { original_ai_draft: snapshot },
    subject: "Edited",
    body: "Edited body",
  })
  assert.equal(resolved.body, "Original body")
  console.log("✓ split editor — original AI draft preserved in metadata")
}

function runDiagnosticsUxCert(): void {
  const diagnostics = readSource("components/growth/personalization/growth-personalization-diagnostics-panel.tsx")
  assert.match(diagnostics, /Collapsible/)
  assert.match(diagnostics, /title="Intelligence"/)
  assert.match(diagnostics, /title="Quality"/)
  assert.match(diagnostics, /title="Reasoning"/)
  assert.match(diagnostics, /title="Sequence"/)
  assert.match(diagnostics, /readPersonalizationDiagnosticsPreferences/)
  assert.match(diagnostics, /persistPersonalizationDiagnosticsPreferences/)
  assert.match(diagnostics, /aria-expanded/)

  assert.equal(GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.intelligence, true)
  assert.equal(GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.quality, true)
  assert.equal(GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.reasoning, false)
  assert.equal(GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.sequence, false)
  console.log("✓ diagnostics collapsible cards + localStorage defaults")
}

function runNoGenerationLogicChangeCert(): void {
  const dashboard = readSource("lib/growth/personalization/dashboard.ts")
  assert.match(dashboard, /runOutreachPersonalizationGeneration/)
  assert.doesNotMatch(dashboard, /runAiTask\(/)
  assert.doesNotMatch(dashboard, /growth_ai_personalization/)

  const generateRoute = readSource("app/api/platform/growth/personalization/generate/route.ts")
  assert.match(generateRoute, /generatePersonalizationDraft/)

  const approveRoute = readSource("app/api/platform/growth/personalization/generations/[id]/approve/route.ts")
  assert.match(approveRoute, /approvePersonalizationGeneration/)
  console.log("✓ generation, scoring, and approval paths unchanged")
}

function runMobileLayoutCert(): void {
  const workspace = readSource("components/growth/personalization/growth-personalization-workspace.tsx")
  assert.match(workspace, /grid-cols-1|lg:grid-cols/)
  assert.match(workspace, /min-w-0/)
  assert.match(workspace, /flex-wrap/)
  console.log("✓ mobile-friendly stacked layout classes")
}

async function main(): Promise<void> {
  console.log("\n=== GS-AI-PLAYBOOK-4D.2 Personalization Workspace Certification ===\n")

  runRouteCert()
  runNavigationCert()
  runWorkspaceLayoutCert()
  runGenerationsPanelCert()
  runDraftFormattingCert()
  runSplitEditorCert()
  runDiagnosticsUxCert()
  runNoGenerationLogicChangeCert()
  runMobileLayoutCert()

  const persisted = persistPersonalizationDiagnosticsPreferences({
    intelligence: true,
    quality: false,
    reasoning: true,
    sequence: false,
  })
  assert.equal(persisted.quality, false)
  assert.equal(persisted.reasoning, true)
  console.log("✓ localStorage preferences API")

  console.log(`\nLegacy admin path preserved for redirect: ${GROWTH_PERSONALIZATION_LEGACY_ADMIN_PATH}`)
  console.log("\nGS-AI-PLAYBOOK-4D.2 personalization workspace certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
