/**
 * LE-2 — execute Apollo live pilot workflow (steps 1–2). Manual steps 3–6 follow in docs.
 *
 * Production (Vercel env — preferred):
 *   vercel env run -e production -- pnpm run:le-2-apollo-live-pilot
 *
 * Do not use .env.local for this workflow.
 */
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND } from "../lib/growth/apollo/apollo-live-pilot-production-env-bootstrap"
import { buildApolloLivePilotEnvReadinessReport } from "../lib/growth/apollo/apollo-live-pilot-env-readiness"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"

function run(label: string, cmd: string): void {
  console.log(`\n=== ${label} ===\n`)
  execSync(cmd, { stdio: "inherit", cwd: process.cwd(), env: process.env })
}

async function main(): Promise<void> {
  bootstrapApolloLivePilotCliEnv()

  fs.mkdirSync(path.join(process.cwd(), "evidence"), { recursive: true })

  const readiness = buildApolloLivePilotEnvReadinessReport()
  console.log(`Env ready for live pilot: ${readiness.ready_for_live_pilot}`)
  if (!readiness.ready_for_live_pilot) {
    console.error("\nBlockers (configure Vercel Production env, then re-run):")
    for (const b of readiness.blockers) console.error(`  - ${b}`)
    console.error("\nPreferred command:")
    console.error(`  ${APOLLO_LIVE_PILOT_VERCEL_PRODUCTION_COMMAND}`)
    console.error("\nSee docs/LE_4_APOLLO_LIVE_PILOT_EXECUTION.md")
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
