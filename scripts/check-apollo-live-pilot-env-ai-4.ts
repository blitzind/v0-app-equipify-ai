/**
 * Apollo AI-4 — environment readiness check (no secrets, no API calls).
 * Run: pnpm check:apollo-live-pilot-env-ai-4
 *
 * Production (Vercel env — preferred):
 *   vercel env run -e production -- pnpm check:apollo-live-pilot-env-ai-4
 */
import {
  buildApolloLivePilotEnvReadinessReport,
  formatApolloLivePilotEnvReadinessMarkdown,
} from "../lib/growth/apollo/apollo-live-pilot-env-readiness"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"

bootstrapApolloLivePilotCliEnv()

const report = buildApolloLivePilotEnvReadinessReport()
console.log(formatApolloLivePilotEnvReadinessMarkdown(report))
console.log("")
console.log(JSON.stringify({ ok: report.ready_for_live_pilot, blockers: report.blockers }, null, 2))

if (!report.ready_for_live_pilot) process.exit(1)
