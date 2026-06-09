/**
 * LE-2 — validate all live evidence files and produce final production verdict.
 * Run after capturing evidence: pnpm validate:le-2-live-evidence
 *
 * Also runs: pnpm test:apollo-integration-ai-3, ai-5, le-1 (via env vars)
 */
import fs from "node:fs"
import path from "node:path"
import { readFileSync } from "node:fs"
import {
  formatLe2LiveEvidenceMarkdown,
  validateLe2LiveEvidence,
} from "../lib/growth/live-execution/le-2-live-evidence-validation"

function loadEnvFile(filePath: string): void {
  try {
    const raw = readFileSync(filePath, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq)
      let value = trimmed.slice(eq + 1)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

function loadJson(path: string | null): unknown | undefined {
  if (!path || !fs.existsSync(path)) return undefined
  return JSON.parse(fs.readFileSync(path, "utf8"))
}

function resolvePath(envKey: string, fallback: string): string {
  return process.env[envKey]?.trim() || fallback
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env.local.active")

  const paths = {
    apollo: resolvePath("LE_2_APOLLO_PILOT_EVIDENCE_JSON", "./evidence/apollo-ai-3-pilot.json"),
    manual_enrollment: resolvePath(
      "LE_1_MANUAL_ENROLLMENT_EVIDENCE_JSON",
      "./evidence/le-1-manual-enrollment.json",
    ),
    non_voice_channels: resolvePath(
      "LE_1_NON_VOICE_CHANNEL_EVIDENCE_JSON",
      "./evidence/le-1-non-voice-channels.json",
    ),
    email_execution: resolvePath("LE_2_EMAIL_EXECUTION_EVIDENCE_JSON", "./evidence/le-2-email-execution.json"),
    voice_drop: resolvePath(
      "LE_2_VOICE_DROP_EVIDENCE_JSON",
      process.env.LE_1_VOICE_DROP_EVIDENCE_JSON?.trim() ||
        process.env.VOICE_DROP_VD_4_EVIDENCE_JSON?.trim() ||
        "./evidence/vd-4-live-evidence.json",
    ),
  }

  console.log("LE-2 evidence paths:")
  for (const [key, p] of Object.entries(paths)) {
    console.log(`  ${key}: ${p} ${fs.existsSync(p) ? "✓" : "✗ missing"}`)
  }
  console.log("")

  const report = validateLe2LiveEvidence({
    evidence: {
      apollo: loadJson(paths.apollo),
      manual_enrollment: loadJson(paths.manual_enrollment),
      non_voice_channels: loadJson(paths.non_voice_channels),
      email_execution: loadJson(paths.email_execution),
      voice_drop: loadJson(paths.voice_drop),
    },
    evidence_paths: paths,
    voice_drop_vd4_live_certified: process.env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })

  const outDir = path.join(process.cwd(), "evidence")
  fs.mkdirSync(outDir, { recursive: true })
  const mdPath = path.join(process.cwd(), "docs/LE_2_LIVE_EVIDENCE_VALIDATION_REPORT.md")
  const jsonPath = path.join(outDir, "le-2-validation-report.json")

  fs.writeFileSync(mdPath, `${formatLe2LiveEvidenceMarkdown(report)}\n`, "utf8")
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`Final verdict: ${report.final_verdict.toUpperCase()}`)
  console.log(report.final_justification)
  if (report.ai3) console.log(`AI-3: ${report.ai3.final_go_no_go.verdict} (quality ${report.ai3.quality.composite_score})`)
  if (report.ai5) console.log(`AI-5: ${report.ai5.activation_decision.verdict}`)
  if (report.le1) console.log(`LE-1: ${report.le1.final_verdict}`)
  if (report.observed_launch_limits) {
    console.log(
      `Observed limits — Week 1 max ${report.observed_launch_limits.week_1_companies_per_day_max} companies/day, ${report.observed_launch_limits.week_1_enrollments_per_day_max} enrollments/day`,
    )
  }
  if (report.blockers.length > 0) {
    console.log("\nBlockers:")
    for (const b of report.blockers) console.log(`  - ${b}`)
  }
  console.log(`\nWrote ${mdPath}`)
  console.log(`Wrote ${jsonPath}`)

  if (report.final_verdict === "rejected") process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
