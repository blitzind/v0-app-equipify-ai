/**
 * GROWTH-WORKSPACE-AVA-IDENTITY-1D — Ava-first operator UX certification.
 *
 * Run: pnpm test:growth-workspace-ava-identity-1d
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { AI_TEAMMATE_DEFAULT_NAME } from "../lib/workspace/ai-teammate-identity"
import { defaultTeammatePresentation } from "../lib/workspace/ai-teammate-voice"
import {
  GROWTH_AVA_DISPLAY_NAME,
  GROWTH_AVA_FORBIDDEN_OPERATOR_LABELS,
  GROWTH_AVA_IDENTITY_OPERATOR_SURFACES,
  growthAvaPanelTitle,
  growthAvaRecommendedActionsTitle,
  GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER,
} from "../lib/growth/workspace/growth-workspace-ava-identity"

export { GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER }

const ROOT = process.cwd()

const FORBIDDEN_SCAN_EXCLUDES = new Set([
  "lib/growth/workspace/growth-workspace-ava-identity.ts",
])

const AVA_ANCHOR_SURFACES = [
  "components/growth/growth-ai-copilot.tsx",
  "components/growth/inbox/growth-inbox-intelligence-sidebar.tsx",
  "components/growth/hubs/leads/growth-leads-hub-recommendations.tsx",
  "components/growth/workspace/executive-briefing/growth-home-recommendation-card.tsx",
  "components/growth/prospect-search/company-signal-ai-insight-panel.tsx",
  "components/growth/settings/growth-ai-teammate-settings-panel.tsx",
] as const

function read(relativePath: string): string {
  const abs = path.join(ROOT, relativePath)
  assert.ok(fs.existsSync(abs), `${relativePath} must exist for Ava identity certification`)
  return fs.readFileSync(abs, "utf8")
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "")
}

function main(): void {
  console.log(
    `\n=== GROWTH-WORKSPACE-AVA-IDENTITY-1D (${GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER}) ===\n`,
  )

  assert.equal(GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER, "growth-workspace-ava-identity-1d-v1")
  assert.equal(AI_TEAMMATE_DEFAULT_NAME, "Ava")
  assert.equal(GROWTH_AVA_DISPLAY_NAME, "Ava")
  assert.equal(growthAvaPanelTitle(defaultTeammatePresentation()), "Ava")
  assert.equal(growthAvaRecommendedActionsTitle(defaultTeammatePresentation()), "Ava recommends")
  console.log("  ✓ Ava identity marker and canonical display name")

  for (const file of GROWTH_AVA_IDENTITY_OPERATOR_SURFACES) {
    if (FORBIDDEN_SCAN_EXCLUDES.has(file)) continue
    const visible = stripComments(read(file))
    for (const pattern of GROWTH_AVA_FORBIDDEN_OPERATOR_LABELS) {
      assert.doesNotMatch(visible, pattern, `${file} must not expose forbidden generic AI label (${pattern})`)
    }
  }
  console.log("  ✓ Operator surfaces free of generic AI terminology")

  for (const file of AVA_ANCHOR_SURFACES) {
    const src = read(file)
    const usesAvaCopyModule = src.includes("growth-workspace-ava-identity")
    const mentionsAva = /\bAva\b/.test(stripComments(src))
    assert.ok(
      usesAvaCopyModule || mentionsAva,
      `${file} must import Ava copy constants or reference Ava in customer-visible strings`,
    )
  }
  console.log("  ✓ Key operator surfaces anchor on Ava-first language")

  const copilotTitle = read("components/growth/growth-ai-copilot.tsx")
  assert.match(copilotTitle, /growthAvaPanelTitle/)
  assert.doesNotMatch(stripComments(copilotTitle), /\bAI Copilot\b/)

  const inboxSidebar = read("components/growth/inbox/growth-inbox-intelligence-sidebar.tsx")
  assert.doesNotMatch(stripComments(inboxSidebar), /AI Assistant/)
  assert.match(inboxSidebar, /growthAvaPanelTitle/)

  const insightPanel = read("components/growth/prospect-search/company-signal-ai-insight-panel.tsx")
  assert.match(insightPanel, /growthAvaInsightTitle|whatTeammateNoticed/)

  console.log("  ✓ Core Ava panels use standardized titles")

  assert.ok(!fs.existsSync(path.join(ROOT, ".env.local")), ".env.local must not be present")
  console.log("  ✓ No .env.local in workspace")

  console.log("\n  Running GROWTH-WORKSPACE-SIDEBAR-DISCOVERABILITY-1C regression…\n")
  execSync("pnpm test:growth-workspace-sidebar-discoverability-1c", { cwd: ROOT, stdio: "inherit" })

  console.log("\n  Running GROWTH-WORKSPACE-LAUNCH-POLISH-1B regression…\n")
  execSync("pnpm test:growth-workspace-launch-polish-1b", { cwd: ROOT, stdio: "inherit" })

  console.log("\nGROWTH-WORKSPACE-AVA-IDENTITY-1D verification PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_WORKSPACE_AVA_IDENTITY_1D_QA_MARKER,
        ava_display_name: GROWTH_AVA_DISPLAY_NAME,
        operator_surfaces: GROWTH_AVA_IDENTITY_OPERATOR_SURFACES.length,
        forbidden_patterns: GROWTH_AVA_FORBIDDEN_OPERATOR_LABELS.length,
      },
      null,
      2,
    ),
  )
}

main()
