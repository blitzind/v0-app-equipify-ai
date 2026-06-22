/**
 * Part 9 — Floating AI Coach safe area certification.
 * Run: pnpm test:growth-floating-safe-area
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AIDEN_CSS_VARS,
  GROWTH_FLOATING_INSET_QA_MARKER,
  GROWTH_STICKY_ACTION_BAR,
  GROWTH_STICKY_ACTION_BAR_INNER,
  GROWTH_WIZARD_ACTION_ROW,
  GROWTH_WORKSPACE_SAFE_AREA,
  GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
} from "../lib/layout/aiden-safe-area"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertUsesGrowthFloatingInset(relativePath: string, pattern: RegExp): void {
  const source = readSource(relativePath)
  assert.match(source, pattern, `${relativePath} must use Growth floating inset utilities`)
}

function assertNoRawStickyFooter(relativePath: string): void {
  const source = readSource(relativePath)
  assert.doesNotMatch(source, /fixed inset-x-0 bottom-0/, `${relativePath} must not use raw fixed bottom footer`)
  assert.doesNotMatch(source, /\bpb-24\b/, `${relativePath} must not hardcode pb-24 for AIden clearance`)
}

function main(): void {
  console.log("\n=== Part 9 — Growth Floating AI Coach Safe Area ===\n")

  assert.equal(GROWTH_FLOATING_INSET_QA_MARKER, "growth-floating-inset-v1")

  const globals = readSource("app/globals.css")
  for (const cssVar of Object.values(AIDEN_CSS_VARS)) {
    assert.match(globals, new RegExp(cssVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `globals.css missing ${cssVar}`)
  }
  for (const utilityClass of [
    GROWTH_STICKY_ACTION_BAR,
    GROWTH_STICKY_ACTION_BAR_INNER,
    GROWTH_WIZARD_ACTION_ROW,
    GROWTH_WORKSPACE_SAFE_AREA,
    GROWTH_WORKSPACE_SAFE_AREA_STICKY_FOOTER,
  ]) {
    assert.match(globals, new RegExp(`\\.${utilityClass}`), `globals.css missing .${utilityClass}`)
  }

  const shell = readSource("components/growth/shell/growth-workspace-shell.tsx")
  assert.match(shell, /GROWTH_AIDEN_SAFE_AREA_PR/)
  assert.match(shell, /GROWTH_AIDEN_SAFE_AREA_PB_SCROLL/)

  for (const file of [
    "components/growth/shell/growth-sticky-action-bar.tsx",
    "components/growth/shell/growth-workspace-safe-area.tsx",
    "components/growth/shell/growth-wizard-action-row.tsx",
  ]) {
    assert.ok(fs.existsSync(file), `missing ${file}`)
    assert.match(readSource(file), /GROWTH_FLOATING_INSET_QA_MARKER/)
  }
  assert.match(readSource("hooks/growth/use-growth-floating-inset.ts"), /useGrowthFloatingInset/)
  assert.match(readSource("hooks/growth/use-growth-floating-inset.ts"), /GROWTH_STICKY_ACTION_BAR_SURFACE/)

  assertUsesGrowthFloatingInset("components/growth/share-pages/growth-share-page-builder.tsx", /GrowthStickyActionBar/)
  assertUsesGrowthFloatingInset("components/growth/share-pages/growth-share-page-builder.tsx", /GrowthWorkspaceSafeArea/)
  assertNoRawStickyFooter("components/growth/share-pages/growth-share-page-builder.tsx")

  assertUsesGrowthFloatingInset("components/growth/videos/growth-video-page-create-panel.tsx", /GrowthStickyActionBar/)
  assertUsesGrowthFloatingInset("components/growth/videos/growth-video-page-create-panel.tsx", /GrowthWorkspaceSafeArea/)
  assertNoRawStickyFooter("components/growth/videos/growth-video-page-create-panel.tsx")

  assertUsesGrowthFloatingInset("components/growth/sendr/growth-sendr-launch-wizard.tsx", /GrowthWizardActionRow/)
  assertUsesGrowthFloatingInset("components/growth/mailboxes/growth-mailbox-onboarding-wizard.tsx", /GrowthWizardActionRow/)
  assertUsesGrowthFloatingInset("components/growth/growth-import-batch-wizard.tsx", /GrowthWizardActionRow/)
  assertUsesGrowthFloatingInset("components/growth/prospect-search/prospect-search-shell.tsx", /GrowthStickyActionBar/)
  assertUsesGrowthFloatingInset("components/growth/growth-call-workspace-mobile-action-bar.tsx", /GrowthStickyActionBar/)
  assertUsesGrowthFloatingInset("components/growth/audiences/growth-audience-enrollment-wizard.tsx", /GROWTH_AIDEN_SAFE_AREA_PR/)

  const aidenLauncher = readSource("components/growth/aiden-ask-launcher.tsx")
  assert.match(aidenLauncher, /bottom-24 right-4/)
  assert.match(aidenLauncher, /lg:bottom-6 lg:right-6/)
  assert.match(aidenLauncher, /h-12/)

  console.log("PASS — Growth floating safe area wired across builders and wizards\n")
}

main()
