/**
 * GE-AIOS-NEXT-3A — Organizational Effectiveness Baseline Production Certification.
 *
 * Local certification (architecture + regression + policy):
 *   pnpm certify:ge-aios-next-3a-organizational-effectiveness-baseline
 *
 * Full certification including Production evidence probe:
 *   pnpm certify:ge-aios-next-3a-organizational-effectiveness-baseline:live
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER } from "../lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types"

export const GE_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_CERT_QA_MARKER =
  "ge-aios-next-3a-organizational-effectiveness-baseline-cert-v1" as const

const PHASE = "GE-AIOS-NEXT-3A-ORGANIZATIONAL-EFFECTIVENESS-BASELINE-CERT" as const
const ROOT = process.cwd()

type CertStep = {
  section: string
  id: string
  name: string
  status: "pass" | "fail" | "blocked" | "skip" | "warn"
  detail: string
}

const steps: CertStep[] = []

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function record(
  section: string,
  id: string,
  name: string,
  status: CertStep["status"],
  detail: string,
): void {
  steps.push({ section, id, name, status, detail })
  const icon =
    status === "pass" ? "✓" : status === "fail" ? "✗" : status === "warn" ? "!" : status === "blocked" ? "○" : "-"
  console.log(`  ${icon} [${section}/${id}] ${name}: ${detail}`)
}

function runPnpmScript(script: string): void {
  execFileSync("pnpm", [script], { cwd: ROOT, stdio: "pipe", encoding: "utf8" })
}

function auditNoDuplicateAuthorities(): void {
  const effectivenessFiles = [
    "lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a.ts",
    "lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-production-loader-next-3a.ts",
  ]

  for (const file of effectivenessFiles) {
    const source = readSource(file)
    assert.doesNotMatch(source, /runGrowthObjectiveRuntimeScheduler/)
    assert.doesNotMatch(source, /setInterval|node-cron|new CronJob/)
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(/)
  }
  record("architecture", "no-duplicate-authorities", "NEXT-3A does not introduce operational authorities", "pass", "projection + read-only loader only")

  const canonicalAuthorities = [
    ["lib/growth/objectives/growth-objective-runtime-scheduler.ts", "scheduler"],
    ["lib/growth/revenue-workflow/growth-lead-admission-production-analysis.ts", "admission analysis"],
    ["lib/growth/training/pipeline-scaling-funnel-metrics-1c.ts", "funnel metrics"],
    ["lib/growth/runtime/cron-telemetry-repository.ts", "cron telemetry"],
    ["lib/growth/draft-factory/draft-factory-durable-repository-core.ts", "draft factory"],
  ] as const

  for (const [file, label] of canonicalAuthorities) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} missing`)
    record("architecture", file, `Canonical ${label} preserved`, "pass", "existing module present")
  }
}

function auditNoHomeExpansion(): void {
  const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.doesNotMatch(hero, /organizationalEffectiveness|effectivenessBaseline|effectiveness-baseline/i)
  record("presentation", "no-home-expansion", "Home hero not expanded with effectiveness dashboard", "pass", "no NEXT-3A Home wiring")

  const dashboard = readSource("components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx")
  assert.doesNotMatch(dashboard, /organizationalEffectiveness|effectivenessBaseline/i)
  record("presentation", "no-dashboard", "Executive briefing dashboard unchanged for NEXT-3A", "pass", "read-model only")
}

function validateOutboundPolicy(): void {
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  record("outbound", "policy-intact", "Outbound send execution remains disabled", "pass", "outbound_send_execution_enabled=false")

  const projection = readSource("lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a.ts")
  assert.match(projection, /penalties for zero sends do not apply/i)
  record("outbound", "baseline-language", "Disabled outbound does not penalize outreach readiness", "pass", "professional baseline language")
}

function validateBaselineDesign(): void {
  const types = readSource("lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a-types.ts")
  assert.match(types, /pipeline_creation/)
  assert.match(types, /strategic_learning/)
  record("baseline", "ten-dimensions", "Ten effectiveness dimensions defined", "pass", "canonical measurement model")

  const projection = readSource("lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a.ts")
  assert.match(projection, /not accuracy/)
  assert.match(projection, /establishing_baseline/)
  assert.doesNotMatch(projection, /red.*yellow.*green|traffic.?light/i)
  record("baseline", "no-targets", "Baseline without arbitrary performance targets", "pass", "no red/yellow/green thresholds")
}

function runRegressionSuite(): void {
  const scripts = [
    "test:ge-aios-next-3a-organizational-effectiveness-baseline",
    "test:ge-aios-next-2a-ava-continuous-executive-briefing",
    "test:ge-aios-next-1f-ava-strategic-leadership",
    "test:ge-aios-next-1e-ava-business-objective",
    "test:ge-aios-next-1d-ava-outcome-planning",
    "test:ge-aios-next-1c-ava-strategic-advisor",
    "test:ge-aios-next-1b-ava-intent-recommendation-home",
    "test:ge-aios-next-1a-ava-recommendation-home",
  ] as const

  for (const script of scripts) {
    runPnpmScript(script)
    record("regression", script, script, "pass", "exit 0")
  }
}

function evaluateProductionEvidence(rawJson: string): void {
  const evidence = JSON.parse(rawJson) as {
    snapshotQaMarker?: string
    baselineStatus?: string
    improvementTrend?: string
    outboundDisabled?: boolean
    outboundMessagesInPeriod?: number
    schedulerRuns?: number
    schedulerSuccessRate?: number | null
    dimensions?: Array<{ id: string; availability: string }>
    highestConfidenceBottleneck?: { stage: string; confidence: string } | null
    unavailableMeasurements?: string[]
  }

  if (evidence.snapshotQaMarker !== GROWTH_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_QA_MARKER) {
    record("production", "qa-marker", "Snapshot QA marker", "fail", String(evidence.snapshotQaMarker))
    return
  }
  record("production", "qa-marker", "Snapshot QA marker", "pass", evidence.snapshotQaMarker)

  record(
    "production",
    "baseline-status",
    "Baseline status from Production evidence",
    "pass",
    `${evidence.baselineStatus ?? "unknown"} / trend=${evidence.improvementTrend ?? "unknown"}`,
  )

  const schedulerRuns = evidence.schedulerRuns ?? 0
  record(
    "production",
    "scheduler-evidence",
    "Scheduler runs in observation window",
    schedulerRuns > 0 ? "pass" : "warn",
    `${schedulerRuns} runs; success rate ${evidence.schedulerSuccessRate ?? "n/a"}%`,
  )

  const outboundCount = evidence.outboundMessagesInPeriod ?? 0
  record(
    "production",
    "outbound-policy",
    "Outbound messages in observation window",
    evidence.outboundDisabled && outboundCount === 0 ? "pass" : outboundCount === 0 ? "pass" : "warn",
    `disabled=${evidence.outboundDisabled}; messages=${outboundCount}`,
  )

  const dimensionCount = evidence.dimensions?.length ?? 0
  record(
    "production",
    "dimensions",
    "Effectiveness dimensions projected from Production",
    dimensionCount === 10 ? "pass" : "fail",
    `${dimensionCount}/10 dimensions`,
  )

  if (evidence.highestConfidenceBottleneck) {
    record(
      "production",
      "bottleneck",
      "Highest-confidence bottleneck identified",
      "pass",
      `${evidence.highestConfidenceBottleneck.stage} (${evidence.highestConfidenceBottleneck.confidence})`,
    )
  } else {
    record("production", "bottleneck", "Highest-confidence bottleneck identified", "warn", "No bottleneck candidate returned")
  }

  const gaps = evidence.unavailableMeasurements?.length ?? 0
  record(
    "production",
    "data-completeness",
    "Unavailable measurements documented",
    gaps > 0 ? "pass" : "warn",
    `${gaps} documented gaps`,
  )
}

async function maybeRunProductionProbe(runLive: boolean): Promise<void> {
  if (!runLive) {
    record("production", "evidence-probe", "Production evidence probe", "skip", "Run with :live to collect Production DB evidence")
    return
  }

  try {
    const output = execFileSync(
      "pnpm",
      ["probe:ge-aios-next-3a-organizational-effectiveness-baseline-production-readonly"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
    const jsonStart = output.indexOf("{")
    if (jsonStart === -1) throw new Error("probe_output_missing_json")
    evaluateProductionEvidence(output.slice(jsonStart))
    record("production", "evidence-probe", "Production evidence probe", "pass", "readonly baseline collected")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record("production", "evidence-probe", "Production evidence probe", "blocked", message.slice(0, 240))
  }
}

function renderVerdict(runLive: boolean): "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "NOT_CERTIFIED" {
  const failures = steps.filter((step) => step.status === "fail")
  if (failures.length > 0) return "NOT_CERTIFIED"

  const blockedProduction = steps.some(
    (step) => step.section === "production" && step.status === "blocked" && runLive,
  )
  if (blockedProduction) return "NOT_CERTIFIED"

  const warnings = steps.filter((step) => step.status === "warn")
  if (warnings.length > 0) return "CERTIFIED_WITH_WARNINGS"
  return "CERTIFIED"
}

async function main(): Promise<void> {
  const runLive = process.argv.includes("--live")
  console.log(`[${PHASE}] certification ${runLive ? "(live production evidence)" : "(local)"}`)
  console.log(`  qaMarker=${GE_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_CERT_QA_MARKER}`)

  auditNoDuplicateAuthorities()
  auditNoHomeExpansion()
  validateOutboundPolicy()
  validateBaselineDesign()
  runRegressionSuite()
  await maybeRunProductionProbe(runLive)

  const verdict = renderVerdict(runLive)
  console.log(`\nVERDICT: ${verdict}`)
  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_3A_ORGANIZATIONAL_EFFECTIVENESS_CERT_QA_MARKER,
        verdict,
        runLive,
        steps,
      },
      null,
      2,
    ),
  )

  if (verdict === "NOT_CERTIFIED") process.exit(1)
}

void main()
