/**
 * GE-AIOS-NEXT-3D — Organizational learning loop production certification.
 * Local: pnpm certify:ge-aios-next-3d-organizational-learning-loop
 * Live:  pnpm certify:ge-aios-next-3d-organizational-learning-loop:live
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER } from "../lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d-types"

const PHASE = "GE-AIOS-NEXT-3D-ORGANIZATIONAL-LEARNING-LOOP-CERT" as const
const ROOT = process.cwd()

type Step = { section: string; id: string; name: string; status: "pass" | "fail" | "blocked" | "skip"; detail: string }
const steps: Step[] = []

function readSource(pathRel: string): string {
  return fs.readFileSync(path.join(ROOT, pathRel), "utf8")
}

function record(section: string, id: string, name: string, status: Step["status"], detail: string): void {
  steps.push({ section, id, name, status, detail })
  console.log(`  ${status === "pass" ? "✓" : status === "fail" ? "✗" : status === "blocked" ? "○" : "-"} [${section}/${id}] ${name}: ${detail}`)
}

function run(script: string): void {
  execFileSync("pnpm", [script], { cwd: ROOT, stdio: "pipe", encoding: "utf8" })
}

function auditArchitecture(): void {
  for (const file of [
    "lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d.ts",
    "lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3d.ts",
  ]) {
    const source = readSource(file)
    assert.doesNotMatch(source, /runGrowthObjectiveRuntimeScheduler|setInterval|node-cron/)
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(/)
  }
  record("architecture", "projection", "Accountability is presentation-only", "pass", "no schedulers in projection")
}

function auditNoDuplicateAuthority(): void {
  const projection = readSource(
    "lib/growth/ava-home/recommendations/growth-home-ava-recommendation-accountability-next-3d.ts",
  )
  assert.match(projection, /GROWTH_LEARNING_MIN_SAMPLE_SIZE/)
  assert.doesNotMatch(projection, /growth-learning-insight-engine|buildLearningInsight/)
  record("architecture", "reuse", "Reuses closed-loop learning sample threshold", "pass", "no duplicate learning engine")
}

function auditNoHomeExpansion(): void {
  const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.doesNotMatch(hero, /OrganizationalLearningSection|AccountabilitySection/)
  record("presentation", "no-sections", "No new Home sections", "pass", "enrichment only")
}

async function maybeProbe(runLive: boolean): Promise<void> {
  if (!runLive) {
    record("production", "probe", "Production probe", "skip", "Run with :live")
    return
  }
  try {
    const output = execFileSync(
      "pnpm",
      ["probe:ge-aios-next-3d-organizational-learning-loop-production-readonly"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const json = JSON.parse(output.slice(output.indexOf("{"))) as {
      accountabilityQaMarker?: string
      primaryTopic?: string | null
      confidenceEvolution?: string
      organizationalLearningLine?: string | null
    }
    assert.equal(json.accountabilityQaMarker, GROWTH_AIOS_NEXT_3D_RECOMMENDATION_ACCOUNTABILITY_QA_MARKER)
    record("production", "qa-marker", "Accountability QA marker", "pass", String(json.accountabilityQaMarker))
    record(
      "production",
      "learning-line",
      "Organizational learning line",
      json.organizationalLearningLine ? "pass" : "fail",
      json.organizationalLearningLine ?? "missing",
    )
    record(
      "production",
      "evolution",
      "Confidence evolution",
      json.confidenceEvolution ? "pass" : "fail",
      `${json.primaryTopic ?? "none"} / ${json.confidenceEvolution ?? "n/a"}`,
    )
    record("production", "probe", "Production probe", "pass", "readonly evidence collected")
  } catch (error) {
    record("production", "probe", "Production probe", "blocked", String(error).slice(0, 200))
  }
}

async function main(): Promise<void> {
  const runLive = process.argv.includes("--live")
  console.log(`[${PHASE}] ${runLive ? "live" : "local"}`)
  auditArchitecture()
  auditNoDuplicateAuthority()
  auditNoHomeExpansion()
  for (const script of [
    "test:ge-aios-next-3d-organizational-learning-loop",
    "test:ge-aios-next-3c-executive-reasoning",
    "test:ge-aios-next-3b-evidence-completeness",
    "test:ge-aios-next-3a-organizational-effectiveness-baseline",
  ]) {
    run(script)
    record("regression", script, script, "pass", "exit 0")
  }
  await maybeProbe(runLive)
  const verdict = steps.some((s) => s.status === "fail" || (runLive && s.status === "blocked"))
    ? "NOT_CERTIFIED"
    : "CERTIFIED"
  console.log(`\nVERDICT: ${verdict}`)
  if (verdict === "NOT_CERTIFIED") process.exit(1)
}

void main()
