/**
 * LE-2 — execute Apollo live pilot workflow (steps 1–2). Manual steps 3–6 follow in docs.
 * Run: pnpm run:le-2-apollo-live-pilot
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { readFileSync } from "node:fs"
import { buildApolloLivePilotEnvReadinessReport } from "../lib/growth/apollo/apollo-live-pilot-env-readiness"

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

function run(label: string, cmd: string): void {
  console.log(`\n=== ${label} ===\n`)
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env })
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env.local.active")

  fs.mkdirSync(path.join(process.cwd(), "evidence"), { recursive: true })

  const readiness = buildApolloLivePilotEnvReadinessReport()
  console.log(`Env ready for live pilot: ${readiness.ready_for_live_pilot}`)
  if (!readiness.ready_for_live_pilot) {
    console.error("\nBlockers (configure .env.local then re-run):")
    for (const b of readiness.blockers) console.error(`  - ${b}`)
    console.error("\nRequired minimum:")
    console.error("  GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true")
    console.error("  GROWTH_APOLLO_USE_MOCK=false")
    console.error("  APOLLO_API_KEY=...")
    console.error("  GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1")
    console.error("  GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true")
    console.error("  GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=<uuid>")
    console.error("  GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json")
    process.exit(1)
  }

  run("Company selection", "pnpm select:apollo-live-pilot-test-company-ai-4")
  run("Dry run", "pnpm dry-run:apollo-live-pilot-ai-4")
  run("Live pilot", "pnpm run:apollo-live-pilot-ai-3")

  const evidencePath =
    process.env.GROWTH_APOLLO_AI_3_OUTPUT_PATH?.trim() || "./evidence/apollo-ai-3-pilot.json"
  if (!fs.existsSync(evidencePath)) {
    console.error(`Expected evidence at ${evidencePath} — pilot may have failed.`)
    process.exit(1)
  }

  process.env.APOLLO_AI_3_PILOT_EVIDENCE_JSON = evidencePath
  process.env.APOLLO_AI_5_PILOT_EVIDENCE_JSON = evidencePath
  process.env.LE_2_APOLLO_PILOT_EVIDENCE_JSON = evidencePath

  run("AI-3 certification", "pnpm test:apollo-integration-ai-3")
  run("AI-5 certification", "pnpm test:apollo-integration-ai-5")

  console.log("\n=== Apollo steps complete ===")
  console.log(`Evidence: ${evidencePath}`)
  console.log("\nNext manual steps (see docs/LE_2_LIVE_EVIDENCE_EXECUTION.md):")
  console.log("  3. Manual sequence enrollment → evidence/le-1-manual-enrollment.json")
  console.log("  4. Email pre-send validation → evidence/le-1-non-voice-channels.json")
  console.log("  5. One approved email send → evidence/le-2-email-execution.json")
  console.log("  6. Voice Drop live test → evidence/vd-4-live-evidence.json")
  console.log("  7. pnpm validate:le-2-live-evidence")
  console.log("  8. pnpm test:le-1-apollo-voice-drop-production")
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
