/**
 * GE-AIOS-IDENTITY-1B — Customer Surface Identity Certification.
 * Fail if priority customer-visible surfaces hardcode "Ava".
 * Run: pnpm test:ge-aios-identity-1b-customer-surface-identity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { AI_TEAMMATE_DEFAULT_NAME, AI_TEAMMATE_SUGGESTED_NAMES } from "../lib/workspace/ai-teammate-identity"
import {
  completedWorkTitle,
  defaultTeammatePresentation,
  recommends,
  reviewCompletedWork,
} from "../lib/workspace/ai-teammate-voice"

const PHASE = "GE-AIOS-IDENTITY-1B" as const
const QA_MARKER = "ge-aios-identity-1b-customer-surface-identity-v1" as const

/** Priority customer surfaces from IDENTITY-1A inventory — must not hardcode Ava. */
const CUSTOMER_SURFACE_PATHS = [
  "lib/workspace/ai-teammate-voice.ts",
  "lib/growth/workspace/growth-workspace-ava-identity.ts",
  "lib/workspace/ai-os-outcome-first-terminology.ts",
  "lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a.ts",
  "lib/growth/aios/approvals/ava-completed-work-contract.ts",
  "lib/growth/aios/approvals/ava-completed-work-projection.ts",
  "lib/growth/workspace/executive-briefing/growth-home-experience-2b.ts",
  "lib/growth/navigation/growth-workspace-shell-navigation.ts",
  "lib/growth/navigation/growth-route-catalog-data.ts",
  "lib/growth/cognitive-workspace/growth-cognitive-workspace-types.ts",
  "components/growth/ai-os/approvals/growth-ava-completed-work-panel.tsx",
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
  "components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-launch-complete-banner.tsx",
  "components/growth/growth-lead-cognitive-workspace.tsx",
  "components/growth/cognitive-workspace/growth-ava-human-interventions-summary.tsx",
] as const

const ALLOWED_FILES_WITH_AVA_LITERAL = new Set([
  "lib/workspace/ai-teammate-identity.ts",
])

const AVA_LITERAL = /\bAva\b/

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function stripCommentsAndStringsCarefully(source: string): string {
  // Remove block comments and line comments for scan of UI string intent —
  // but still scan raw source for string literals containing Ava.
  return source
}

function findAvaLiterals(source: string): string[] {
  const hits: string[] = []
  const stringLiteral =
    /(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g
  let match: RegExpExecArray | null
  while ((match = stringLiteral.exec(source)) != null) {
    const literal = match[0]
    if (AVA_LITERAL.test(literal) && !literal.includes("AI_TEAMMATE_DEFAULT_NAME")) {
      // Allow importing/using default name constant references only — not "Ava" text.
      if (/["'`]Ava["'`]/.test(literal) || /Ava's|Ava is|Ava has|Ava completed|Ava recommends|Ask Ava|from Ava|with Ava|Meet Ava|Launch Ava|What Ava|Run Ava/.test(literal)) {
        hits.push(literal.slice(0, 120))
      } else if (AVA_LITERAL.test(literal)) {
        hits.push(literal.slice(0, 120))
      }
    }
  }
  // Also catch JSX text nodes: >Ava ...
  const jsxText = />([^<{]*\bAva\b[^<{]*)</g
  while ((match = jsxText.exec(source)) != null) {
    hits.push(match[1].trim().slice(0, 120))
  }
  return hits
}

function main(): void {
  console.log(`[${PHASE}] Customer Surface Identity Certification`)
  assert.equal(QA_MARKER, "ge-aios-identity-1b-customer-surface-identity-v1")
  assert.equal(AI_TEAMMATE_DEFAULT_NAME, "Ava")
  assert.ok(AI_TEAMMATE_SUGGESTED_NAMES.includes("Ava"))
  console.log("  ✓ canonical default + suggested names remain Ava internally")

  const teammate = defaultTeammatePresentation()
  assert.equal(teammate.name, AI_TEAMMATE_DEFAULT_NAME)
  assert.equal(completedWorkTitle(teammate), "Ava completed work")
  assert.equal(recommends(teammate), "Ava recommends")
  assert.match(reviewCompletedWork(teammate), /Ava/)
  console.log("  ✓ voice helpers resolve through identity presentation (default name)")

  const emma = defaultTeammatePresentation()
  // resolve via voice with renamed presentation
  const { resolveAiTeammatePresentation } = require("../lib/workspace/ai-teammate-identity") as typeof import("../lib/workspace/ai-teammate-identity")
  const renamed = resolveAiTeammatePresentation("Emma")
  assert.equal(completedWorkTitle(renamed), "Emma completed work")
  assert.equal(recommends(renamed), "Emma recommends")
  console.log("  ✓ renamed teammate flows through voice helpers")

  const identityProvider = readSource("components/growth/ai-teammate/ai-teammate-identity-provider.tsx")
  assert.match(identityProvider, /useAiTeammateIdentity/)
  assert.match(identityProvider, /loadAiTeammateIdentity|fetchAiTeammateIdentity/)
  const identityService = readSource("lib/growth/settings/growth-ai-teammate-identity-service.ts")
  assert.match(identityService, /export async function loadAiTeammateIdentity/)
  console.log("  ✓ existing identity runtime reused (provider + loadAiTeammateIdentity)")

  let failures = 0
  for (const relativePath of CUSTOMER_SURFACE_PATHS) {
    if (ALLOWED_FILES_WITH_AVA_LITERAL.has(relativePath)) continue
    const absolute = path.join(process.cwd(), relativePath)
    assert.ok(fs.existsSync(absolute), `missing surface ${relativePath}`)
    const source = stripCommentsAndStringsCarefully(readSource(relativePath))
    const hits = findAvaLiterals(source)
    if (hits.length > 0) {
      failures += 1
      console.error(`  ✗ ${relativePath}`)
      for (const hit of hits.slice(0, 5)) {
        console.error(`      ${hit}`)
      }
    } else {
      console.log(`  ✓ ${relativePath}`)
    }
  }

  assert.equal(failures, 0, `${failures} customer surface(s) still hardcode Ava`)

  // No second identity system
  const voice = readSource("lib/workspace/ai-teammate-voice.ts")
  assert.doesNotMatch(voice, /getOrganizationAIName|resolveAIIdentity\(/)
  assert.match(voice, /resolveAiTeammatePresentation/)
  console.log("  ✓ no second identity helper introduced")

  console.log(`[${PHASE}] PASS — Customer Surface Identity certified`)
}

main()
