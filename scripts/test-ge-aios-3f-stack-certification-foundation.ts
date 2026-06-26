/**
 * GE-AIOS-3F — Full AI OS stack certification (2A–3E).
 * Run: pnpm test:ge-aios-3f-stack-certification-foundation
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

export const GROWTH_AIOS_3F_PHASE = "GE-AIOS-3F" as const

export const GROWTH_AI_OS_STACK_CERTIFICATION_QA_MARKER =
  "growth-aios-3f-stack-certification-v1" as const

const PHASE_CERT_SCRIPTS = [
  "test:ge-aios-2a-ai-work-order-foundation",
  "test:ge-aios-2b-ai-event-foundation",
  "test:ge-aios-2c-ai-agent-runtime-foundation",
  "test:ge-aios-2d-decision-record-foundation",
  "test:ge-aios-2e-decision-gate-foundation",
  "test:ge-aios-2f-memory-registry-foundation",
  "test:ge-aios-2g-executive-brain-foundation",
  "test:ge-aios-2h-decision-engine-foundation",
  "test:ge-aios-2i-decision-execution-bridge-foundation",
  "test:ge-aios-2j-context-assembly-foundation",
  "test:ge-aios-3a-provider-adapters-foundation",
  "test:ge-aios-3b-decision-intelligence-bridge-foundation",
  "test:ge-aios-3c-executive-decision-preparation-foundation",
  "test:ge-aios-3d-executive-mission-planning-foundation",
  "test:ge-aios-3e-executive-mission-planning-review-foundation",
] as const

const MIGRATION_ORDER = [
  "20271001120000_growth_aios_2a_ai_work_orders.sql",
  "20271001130000_growth_aios_2b_ai_events.sql",
  "20271001140000_growth_aios_2c_ai_agent_runtime.sql",
  "20271001150000_growth_aios_2d_decision_records.sql",
  "20271001160000_growth_aios_2f_memory_registry.sql",
  "20271001170000_growth_aios_2g_executive_brain.sql",
  "20271001180000_growth_aios_2h_decision_engine.sql",
  "20271001190000_growth_aios_2j_context_assembly.sql",
  "20271001200000_growth_aios_3a_provider_adapters.sql",
] as const

const CORE_FORBIDDEN = ["public.invoices", "public.quotes", "blitzpay", "public.work_orders"] as const

const AI_OS_API_ROUTES = [
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/preview/route.ts",
  "app/api/platform/growth/ai-os/missions/[missionId]/planning/approve/route.ts",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function listAiosLibraryFiles(): string[] {
  const root = path.join(process.cwd(), "lib/growth/aios")
  const files: string[] = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile()) files.push(path.join("lib/growth/aios", entry.name))
  }
  return files.sort()
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of CORE_FORBIDDEN) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

function assertProviderGatewayIsolated(): void {
  const aiosDir = path.join(process.cwd(), "lib/growth/aios")
  const bridgeOnly = new Set(["ai-provider-core-bridge.ts", "ai-provider-selection-service.ts", "ai-provider-health.ts"])
  for (const entry of fs.readdirSync(aiosDir)) {
    if (!entry.endsWith(".ts")) continue
    const source = fs.readFileSync(path.join(aiosDir, entry), "utf8")
    if (!source.includes("@/lib/ai/providers")) continue
    assert.ok(
      bridgeOnly.has(entry),
      `${entry} must not import @/lib/ai/providers directly — use ai-provider-core-bridge`,
    )
  }
  assert.ok(readSource("lib/growth/aios/ai-provider-failover.ts").includes("invokeCoreProviderAdapter"))
}

function assertDecisionGateNotBypassed(): void {
  const workOrderService = readSource("lib/growth/aios/ai-work-order-service.ts")
  assert.ok(workOrderService.includes('input.toStatus === "executing"'))
  assert.ok(workOrderService.includes("prepareAiWorkOrderForExecutionViaDecisionBridge"))

  const bridge = readSource("lib/growth/aios/ai-decision-execution-bridge-service.ts")
  assert.ok(bridge.includes("assertAiWorkOrderDecisionGateForExecution"))
  assert.ok(bridge.includes("evaluateAiWorkOrderDecisionGate"))
}

function assertProviderPathOptInOnly(): void {
  const bridge = readSource("lib/growth/aios/ai-decision-intelligence-bridge-service.ts")
  assert.ok(bridge.includes("if (!input.enabled)"))
  assert.ok(bridge.includes("return { ...EMPTY_RESULT }"))

  const engine = readSource("lib/growth/aios/ai-decision-engine-service.ts")
  assert.ok(engine.includes("enableAiEvidence"))
}

function assertPlanningUiOperatorGated(): void {
  const previewRoute = readSource(AI_OS_API_ROUTES[1])
  assert.ok(previewRoute.includes("previewExecutiveMissionPlanningReview"))
  assert.equal(previewRoute.includes('mode: "create"'), false)

  const approveRoute = readSource(AI_OS_API_ROUTES[2])
  assert.ok(approveRoute.includes("approveExecutiveMissionPlanningReview"))
  assert.ok(approveRoute.includes("reviewId"))

  const ui = readSource("components/growth/ai-os/growth-ai-os-mission-planning-review-panel.tsx")
  assert.ok(ui.includes("Run dry-run preview"))
  assert.ok(ui.includes("/planning/approve"))
  assert.ok(ui.includes("disabled={busy !== null || preview.selectableProposals.length === 0}"))
}

function assertNoExecuteOutboundRoutes(): void {
  for (const route of AI_OS_API_ROUTES) {
    const source = readSource(route)
    for (const forbidden of [
      "transitionAiWorkOrder",
      "claimAiOsWorkOrder",
      "invokeAiOsProviderWithContextPackage",
      'toStatus: "executing"',
      "enroll_sequence",
    ]) {
      assert.equal(source.includes(forbidden), false, `${route} must not reference ${forbidden}`)
    }
  }
}

function assertDocsCurrent(): void {
  const master = readSource("docs/MASTER_CONTEXT_DOCUMENT.md")
  assert.ok(master.includes("GE-AIOS-3E"))
  assert.ok(master.includes("GE-AIOS-2A"))

  const ledger = readSource("docs/AI_REVENUE_OPERATOR_IMPLEMENTATION_LEDGER.md")
  assert.ok(ledger.includes("GE-AIOS-3E"))
  assert.ok(ledger.includes("GE-AIOS-2A"))
}

console.log(`[${GROWTH_AIOS_3F_PHASE}] AI OS stack certification (2A–3E)`)

assert.equal(GROWTH_AI_OS_STACK_CERTIFICATION_QA_MARKER, "growth-aios-3f-stack-certification-v1")

for (const migration of MIGRATION_ORDER) {
  const migrationPath = path.join(process.cwd(), "supabase/migrations", migration)
  assert.ok(fs.existsSync(migrationPath), `missing migration ${migration}`)
}
for (let i = 1; i < MIGRATION_ORDER.length; i += 1) {
  assert.ok(
    MIGRATION_ORDER[i] > MIGRATION_ORDER[i - 1],
    `migration order invalid: ${MIGRATION_ORDER[i - 1]} before ${MIGRATION_ORDER[i]}`,
  )
}

for (const file of listAiosLibraryFiles()) {
  assertNoCoreTouch(file)
}

assertProviderGatewayIsolated()
assertDecisionGateNotBypassed()
assertProviderPathOptInOnly()
assertPlanningUiOperatorGated()
assertNoExecuteOutboundRoutes()
assertDocsCurrent()

const failures: string[] = []
for (const script of PHASE_CERT_SCRIPTS) {
  try {
    execSync(`pnpm ${script}`, { stdio: "pipe", cwd: process.cwd(), env: process.env })
    console.log(`[${GROWTH_AIOS_3F_PHASE}] ✓ ${script}`)
  } catch (error) {
    failures.push(script)
    console.error(`[${GROWTH_AIOS_3F_PHASE}] ✗ ${script}`)
    if (error instanceof Error && "stdout" in error) {
      const stdout = (error as { stdout?: Buffer }).stdout?.toString() ?? ""
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() ?? ""
      if (stdout) console.error(stdout.slice(-500))
      if (stderr) console.error(stderr.slice(-500))
    }
  }
}

assert.equal(failures.length, 0, `phase certifications failed: ${failures.join(", ")}`)

console.log(`[${GROWTH_AIOS_3F_PHASE}] PASS — Full AI OS stack certified (local)`)
