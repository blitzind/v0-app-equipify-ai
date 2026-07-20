/**
 * GE-AIOS-NEXT-3E — Organizational learning certification (final AI OS architecture milestone).
 * Local: pnpm certify:ge-aios-next-3e-organizational-learning-certification
 * Live:  pnpm certify:ge-aios-next-3e-organizational-learning-certification:live
 */
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER } from "../lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e-types"

const PHASE = "GE-AIOS-NEXT-3E-ORGANIZATIONAL-LEARNING-CERTIFICATION-CERT" as const
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
    "lib/growth/organizational-effectiveness/growth-organizational-learning-certification-next-3e.ts",
    "lib/growth/ava-home/recommendations/growth-home-ava-organizational-learning-enrichment-next-3e.ts",
  ]) {
    const source = readSource(file)
    assert.doesNotMatch(source, /runGrowthObjectiveRuntimeScheduler|setInterval|node-cron/)
    assert.doesNotMatch(source, /\.insert\(|\.update\(|\.upsert\(/)
    assert.doesNotMatch(source, /growth-learning-insight-engine/)
  }
  record("architecture", "projection", "Certification is read-model only", "pass", "no writes or duplicate learning engine")
}

function auditNoHomeExpansion(): void {
  const hero = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
  assert.doesNotMatch(hero, /LearningCertificationSection|OrganizationalLearningCertificationSection/)
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
      ["probe:ge-aios-next-3e-organizational-learning-certification-production-readonly"],
      {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
    const json = JSON.parse(output.slice(output.indexOf("{"))) as {
      certificationQaMarker?: string
      certificationVerdict?: string
      architectureVerdict?: string
      primaryTopic?: string | null
      organizationalLearningLine?: string | null
    }
    assert.equal(json.certificationQaMarker, GROWTH_AIOS_NEXT_3E_ORGANIZATIONAL_LEARNING_CERTIFICATION_QA_MARKER)
    record("production", "qa-marker", "Certification QA marker", "pass", String(json.certificationQaMarker))
    record(
      "production",
      "verdict",
      "Production certification verdict",
      json.certificationVerdict === "certified" ? "pass" : json.certificationVerdict === "blocked" ? "blocked" : "fail",
      `${json.certificationVerdict ?? "missing"} — ${json.architectureVerdict ?? "n/a"}`,
    )
    record(
      "production",
      "learning-line",
      "Honest organizational learning line",
      json.organizationalLearningLine ? "pass" : "fail",
      json.organizationalLearningLine ?? "missing",
    )
    record("production", "probe", "Production probe", "pass", `topic=${json.primaryTopic ?? "none"}`)
  } catch (error) {
    record("production", "probe", "Production probe", "blocked", String(error).slice(0, 200))
  }
}

async function main(): Promise<void> {
  const runLive = process.argv.includes("--live")
  console.log(`[${PHASE}] ${runLive ? "live" : "local"}`)
  auditArchitecture()
  auditNoHomeExpansion()
  for (const script of [
    "test:ge-aios-next-3e-organizational-learning-certification",
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
