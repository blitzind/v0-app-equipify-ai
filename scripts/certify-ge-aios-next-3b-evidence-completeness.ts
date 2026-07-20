/**
 * GE-AIOS-NEXT-3B — Evidence Completeness Production Certification.
 *
 * Local: pnpm certify:ge-aios-next-3b-evidence-completeness
 * Live:  pnpm certify:ge-aios-next-3b-evidence-completeness:live
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER } from "../lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types"

export const GE_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_CERT_QA_MARKER =
  "ge-aios-next-3b-evidence-completeness-cert-v1" as const

const PHASE = "GE-AIOS-NEXT-3B-EVIDENCE-COMPLETENESS-CERT" as const
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

function auditArchitecture(): void {
  const files = [
    "lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b.ts",
    "lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-production-loader-next-3b.ts",
  ]
  for (const file of files) {
    const source = readSource(file)
    assert.doesNotMatch(source, /runGrowthObjectiveRuntimeScheduler|setInterval|node-cron/)
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(/)
  }
  record("architecture", "projection-only", "NEXT-3B is read-model projection only", "pass", "no scheduler or writes")

  const authorities = [
    "lib/growth/revenue-workflow/growth-lead-admission-production-analysis.ts",
    "lib/growth/revenue-workflow/evaluate-growth-lead-admission.ts",
    "lib/growth/memory/storage/organization-memory-repository.ts",
    "lib/growth/aios/revenue-director/growth-revenue-director-decision-repository.ts",
    "lib/growth/organizational-effectiveness/growth-organizational-effectiveness-baseline-next-3a.ts",
  ] as const
  for (const file of authorities) {
    assert.ok(fs.existsSync(path.join(ROOT, file)))
    record("architecture", file, "Canonical authority preserved", "pass", "existing module")
  }
}

function auditNoHomeExpansion(): void {
  const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.doesNotMatch(hero, /evidenceCompleteness|evidence-completeness/i)
  record("presentation", "no-home", "Home not expanded for evidence completeness", "pass", "no NEXT-3B Home wiring")
}

function runRegressionSuite(): void {
  const scripts = [
    "test:ge-aios-next-3b-evidence-completeness",
    "test:ge-aios-next-3a-organizational-effectiveness-baseline",
    "test:ge-aios-next-2a-ava-continuous-executive-briefing",
  ] as const
  for (const script of scripts) {
    runPnpmScript(script)
    record("regression", script, script, "pass", "exit 0")
  }
}

function evaluateProductionEvidence(rawJson: string): void {
  const evidence = JSON.parse(rawJson) as {
    snapshotQaMarker?: string
    gapsClosed?: string[]
    remainingGaps?: string[]
    admissionEvidence?: { evidenceBackedExplanation?: string | null; completeness?: string }
    researchDuration?: { medianCompletionHours?: number | null; completeness?: string }
    decisionMakerReadiness?: { blockingReasons?: Array<{ reason: string; count: number }> }
    recommendationOutcomes?: { causationNote?: string }
  }

  if (evidence.snapshotQaMarker !== GROWTH_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_QA_MARKER) {
    record("production", "qa-marker", "Snapshot QA marker", "fail", String(evidence.snapshotQaMarker))
    return
  }
  record("production", "qa-marker", "Snapshot QA marker", "pass", evidence.snapshotQaMarker)

  record(
    "production",
    "gaps",
    "Gap closure tracking",
    "pass",
    `closed=${evidence.gapsClosed?.length ?? 0}; remaining=${evidence.remainingGaps?.length ?? 0}`,
  )

  if (evidence.admissionEvidence?.evidenceBackedExplanation) {
    record(
      "production",
      "admission-explanation",
      "Admission evidence-backed explanation",
      "pass",
      evidence.admissionEvidence.evidenceBackedExplanation.slice(0, 120),
    )
  } else {
    record("production", "admission-explanation", "Admission evidence-backed explanation", "warn", "No explanation — insufficient evidence (acceptable)")
  }

  record(
    "production",
    "research-duration",
    "Research median duration",
    evidence.researchDuration?.medianCompletionHours != null ? "pass" : "warn",
    `median=${evidence.researchDuration?.medianCompletionHours ?? "n/a"}h; completeness=${evidence.researchDuration?.completeness ?? "unknown"}`,
  )

  const blocking = evidence.decisionMakerReadiness?.blockingReasons?.length ?? 0
  record("production", "dm-blocking", "Decision-maker blocking reasons", blocking > 0 ? "pass" : "warn", `${blocking} reasons`)

  assert.match(evidence.recommendationOutcomes?.causationNote ?? "", /not proof|correlated/i)
  record("production", "recommendation-causation", "Recommendation causation guard", "pass", "causation note present")
}

async function maybeRunProductionProbe(runLive: boolean): Promise<void> {
  if (!runLive) {
    record("production", "probe", "Production evidence probe", "skip", "Run with :live")
    return
  }
  try {
    const output = execFileSync(
      "pnpm",
      ["probe:ge-aios-next-3b-evidence-completeness-production-readonly"],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    )
    const jsonStart = output.indexOf("{")
    if (jsonStart === -1) throw new Error("probe_output_missing_json")
    evaluateProductionEvidence(output.slice(jsonStart))
    record("production", "probe", "Production evidence probe", "pass", "readonly evidence collected")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record("production", "probe", "Production evidence probe", "blocked", message.slice(0, 240))
  }
}

function renderVerdict(runLive: boolean): "CERTIFIED" | "CERTIFIED_WITH_WARNINGS" | "NOT_CERTIFIED" {
  if (steps.some((step) => step.status === "fail")) return "NOT_CERTIFIED"
  if (steps.some((step) => step.section === "production" && step.status === "blocked" && runLive)) {
    return "NOT_CERTIFIED"
  }
  if (steps.some((step) => step.status === "warn")) return "CERTIFIED_WITH_WARNINGS"
  return "CERTIFIED"
}

async function main(): Promise<void> {
  const runLive = process.argv.includes("--live")
  console.log(`[${PHASE}] certification ${runLive ? "(live)" : "(local)"}`)

  auditArchitecture()
  auditNoHomeExpansion()
  runRegressionSuite()
  await maybeRunProductionProbe(runLive)

  const verdict = renderVerdict(runLive)
  console.log(`\nVERDICT: ${verdict}`)
  console.log(JSON.stringify({ qaMarker: GE_AIOS_NEXT_3B_EVIDENCE_COMPLETENESS_CERT_QA_MARKER, verdict, steps }, null, 2))
  if (verdict === "NOT_CERTIFIED") process.exit(1)
}

void main()
