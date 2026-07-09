/**
 * GE-AIOS-19C-2A — Single AI identity cleanup certification.
 * Run: pnpm test:ge-aios-19c-2a-single-ai-identity-cleanup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildTeammateHandlingRows,
  buildHomeWorkItemPresentation,
  formatTeammateFirstPersonStatus,
  GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER,
  GROWTH_HOME_TEAMMATE_CAPABILITIES_SECTION_TITLE,
  GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE,
} from "../lib/growth/home/growth-home-runtime-presenter"
import { GROWTH_HOME_SURFACE_SECTION_AUDIT } from "../lib/growth/home/growth-home-surface-consolidation-17f"
import { resolveAiTeammatePresentation } from "../lib/workspace/ai-teammate-identity"
import { buildTeammateAboutIntroduction, teammateHomePageDescription } from "../lib/workspace/ai-teammate-voice"
import type { AvaWorkItem } from "../lib/growth/work-manager/types"

const PHASE = "GE-AIOS-19C-2A" as const

const CUSTOMER_SURFACE_GLOBS = [
  "components/growth/workspace/executive-briefing",
  "components/growth/operations-center",
  "components/growth/training",
  "components/growth/ava-about",
  "components/growth/ai-os/growth-ava-operator-approval-workspace.tsx",
  "components/growth/ai-os/operator-experience/growth-ai-os-daily-work-queue-section.tsx",
  "app/(growth)/growth/page.tsx",
  "app/(growth)/growth/operations/page.tsx",
  "app/(growth)/growth/ava/page.tsx",
  "app/(growth)/growth/training",
] as const

const FORBIDDEN_CUSTOMER_PATTERNS = [
  /\bSales Specialist\b/,
  /\bMarketing Specialist\b/,
  /\bCustomer Success Specialist\b/,
  /\bService Specialist\b/,
  /\bFinance Specialist\b/,
  /\bMy Team\b/,
  /\bSpecialist team\b/,
  /\bspecialist_name\b/,
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function walkTsFiles(relativeDir: string): string[] {
  const root = path.join(process.cwd(), relativeDir)
  if (!fs.existsSync(root)) return fs.statSync(root).isFile() ? [relativeDir] : []

  const results: string[] = []
  const stack = [root]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (/\.(tsx|ts)$/.test(entry.name)) {
        results.push(path.relative(process.cwd(), full))
      }
    }
  }
  return results
}

function collectCustomerSurfaceSources(): string[] {
  const files = new Set<string>()
  for (const glob of CUSTOMER_SURFACE_GLOBS) {
    const full = path.join(process.cwd(), glob)
    if (!fs.existsSync(full)) continue
    if (fs.statSync(full).isFile()) {
      files.add(glob)
    } else {
      for (const file of walkTsFiles(glob)) files.add(file)
    }
  }
  return [...files]
}

function assertNoForbiddenCustomerPatterns(): void {
  for (const file of collectCustomerSurfaceSources()) {
    const source = readSource(file)
    for (const pattern of FORBIDDEN_CUSTOMER_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${file} must not expose ${pattern}`)
    }
  }
}

function assertNoHardcodedAvaInCustomerSurfaces(): void {
  for (const file of collectCustomerSurfaceSources()) {
    const source = readSource(file)
    const lines = source.split("\n")
    for (const [index, line] of lines.entries()) {
      if (!/\bAva\b/.test(line)) continue
      if (/import |from |\/\/|\/\*|\*\/|console\.|GE-AVA|X-Ava|ava-home|ava-about|AvaDaily|AvaWork|AvaSpecialist|AvaDatamoon|AvaLed|AvaLaunch|AvaNarrative|AvaMemory|AvaOperator|buildAva|GrowthAva|createDefaultAva|normalizeAva|readAva|writeAva|shouldPromoteGetAva|GrowthHomeAva|resolveAva|fetchAva|runAva|handleAva|handleAskAva|handleRunAva|handleStartAva|formatAva|isGrowthMissionAva|buildMissionAva|GROWTH_AVA|AVA_/i.test(line)) {
        continue
      }
      assert.fail(`${file}:${index + 1} contains hardcoded customer-facing "Ava": ${line.trim()}`)
    }
  }
}

function main(): void {
  console.log(`[${PHASE}] Single AI identity cleanup certification`)

  assert.equal(GROWTH_HOME_SINGLE_AI_IDENTITY_19C_2A_QA_MARKER, "ge-aios-19c-2a-single-ai-identity-cleanup-v1")
  assert.equal(GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE, "What I'm handling")
  assert.equal(GROWTH_HOME_TEAMMATE_CAPABILITIES_SECTION_TITLE, "Capabilities I'm using")
  console.log("  ✓ 19C-2A QA markers and section titles")

  const homeTeam = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ava-specialist-team-section.tsx",
  )
  assert.match(homeTeam, /buildTeammateHandlingRows/)
  assert.match(homeTeam, /GROWTH_HOME_TEAMMATE_HANDLING_SECTION_TITLE/)
  assert.doesNotMatch(homeTeam, /AVA_SPECIALIST_MY_TEAM_TITLE/)
  assert.doesNotMatch(homeTeam, /specialist_name/)
  console.log("  ✓ Home team section uses first-person handling rows")

  const operations = readSource("components/growth/operations-center/growth-sales-operations-center-dashboard.tsx")
  assert.match(operations, /GROWTH_HOME_TEAMMATE_CAPABILITIES_SECTION_TITLE/)
  assert.match(operations, /buildTeammateHandlingRows/)
  assert.doesNotMatch(operations, /Specialist team/)
  assert.doesNotMatch(operations, /specialist_name/)
  console.log("  ✓ Operations uses capabilities presentation")

  const workSection = readSource("components/growth/workspace/executive-briefing/growth-home-ava-work-section.tsx")
  assert.doesNotMatch(workSection, /specialistLabel/)
  console.log("  ✓ Home work section hides specialist labels")

  const orchestrator = readSource("lib/growth/specialists/engine/run-specialist-orchestrator.ts")
  assert.match(orchestrator, /runSpecialistOrchestrator/)
  assert.match(orchestrator, /applySpecialistRoutingToWorkManagerResult/)
  console.log("  ✓ internal specialist orchestration unchanged")

  const renamed = resolveAiTeammatePresentation("Jordan")
  assert.match(buildTeammateAboutIntroduction(renamed), /Jordan/)
  assert.match(teammateHomePageDescription(renamed), /Jordan/)
  assert.doesNotMatch(buildTeammateAboutIntroduction(renamed), /\bAva\b/)
  console.log("  ✓ dynamic configured name in customer copy")

  const handling = buildTeammateHandlingRows([
    {
      specialist_id: "sales",
      specialist_name: "Sales Specialist",
      status_label: "Researching companies",
      active_count: 2,
      is_stub: false,
    },
  ])
  assert.equal(handling[0]?.capabilityLabel, "Finding opportunities")
  assert.match(handling[0]?.statusLabel ?? "", /I'm researching companies/)
  assert.doesNotMatch(JSON.stringify(handling), /Sales Specialist/)
  console.log("  ✓ handling rows map internal runtime to capability labels")

  const workItem: AvaWorkItem = {
    id: "work:1",
    type: "outreach",
    title: "Prepare outreach",
    description: null,
    status: "working",
    priority: 90,
    source: "decision_engine",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    estimated_minutes: 15,
    estimated_revenue_impact: null,
    requires_operator: true,
    can_execute_autonomously: false,
    depends_on: [],
    blocked_by: [],
    next_action: null,
    decision_score: 90,
    confidence: 90,
    href: null,
    company_name: "Acme",
    decision_source_id: null,
    assigned_specialist: "sales",
    routing_reason: "Sales Specialist owns pipeline work.",
  }
  const presentation = buildHomeWorkItemPresentation(workItem)
  assert.equal(presentation.specialistLabel, null)
  assert.equal(presentation.whyItMatters, null)
  console.log("  ✓ work item presentation strips specialist routing reasons")

  assert.equal(formatTeammateFirstPersonStatus("Researching companies"), "I'm researching companies.")
  console.log("  ✓ first-person status formatting")

  const specialistAudit = GROWTH_HOME_SURFACE_SECTION_AUDIT.find((row) => row.id === "ava-specialist-team")
  assert.equal(specialistAudit, undefined)
  console.log("  ✓ What I'm handling removed from Home primary surface audit")

  assertNoForbiddenCustomerPatterns()
  console.log("  ✓ no customer-facing specialist role names on Home/Operations/Training/About/Approvals")

  assertNoHardcodedAvaInCustomerSurfaces()
  console.log("  ✓ no hardcoded Ava in scoped customer surfaces")

  console.log(`[${PHASE}] PASS — single AI identity cleanup certified (local)`)
}

main()
