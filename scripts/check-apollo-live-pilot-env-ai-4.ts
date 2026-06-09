/**
 * Apollo AI-4 — environment readiness check (no secrets, no API calls).
 * Run: pnpm check:apollo-live-pilot-env-ai-4
 */
import { readFileSync } from "node:fs"
import {
  buildApolloLivePilotEnvReadinessReport,
  formatApolloLivePilotEnvReadinessMarkdown,
} from "../lib/growth/apollo/apollo-live-pilot-env-readiness"

function loadEnvFile(path: string): void {
  try {
    const raw = readFileSync(path, "utf8")
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

loadEnvFile(".env.local")
loadEnvFile(".env.local.active")

const report = buildApolloLivePilotEnvReadinessReport()
console.log(formatApolloLivePilotEnvReadinessMarkdown(report))
console.log("")
console.log(JSON.stringify({ ok: report.ready_for_live_pilot, blockers: report.blockers }, null, 2))

if (!report.ready_for_live_pilot) process.exit(1)
