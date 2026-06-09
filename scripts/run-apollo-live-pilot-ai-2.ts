/**
 * Apollo AI-2 controlled live pilot — single company, real API.
 * Run: pnpm run:apollo-live-pilot-ai-2
 *
 * Requires:
 *   GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED=true
 *   GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID=<uuid>
 *   GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED=true
 *   GROWTH_APOLLO_USE_MOCK=false
 *   APOLLO_API_KEY=...
 *   GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
 *
 * Optional:
 *   GROWTH_APOLLO_AI_2_OUTPUT_PATH=./evidence/apollo-ai-2-pilot.json
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { analyzeApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-analysis"
import { validateApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-evidence-types"
import {
  assertApolloAi2LivePilotAllowed,
  runApolloLivePilotAi2,
} from "../lib/growth/apollo/apollo-live-pilot-runner"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

async function main(): Promise<void> {
  const allowed = assertApolloAi2LivePilotAllowed()
  if (!allowed.ok) {
    console.error(JSON.stringify({ ok: false, error: allowed.error }))
    process.exit(1)
  }

  const company_candidate_id = process.env.GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID?.trim()
  if (!company_candidate_id) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Set GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID to a single test company candidate.",
      }),
    )
    process.exit(1)
  }

  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const result = await runApolloLivePilotAi2(admin, { company_candidate_id })

  if (!result.evidence) {
    console.error(JSON.stringify({ ok: false, error: result.error ?? "Pilot produced no evidence." }))
    process.exit(1)
  }

  const validation = validateApolloLivePilotEvidence(result.evidence)
  const analysis = analyzeApolloLivePilotEvidence(result.evidence)
  const payload = {
    ok: result.ok,
    validation,
    analysis,
    evidence: result.evidence,
  }

  const outputPath = process.env.GROWTH_APOLLO_AI_2_OUTPUT_PATH?.trim()
  const json = `${JSON.stringify(payload, null, 2)}\n`
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true })
    fs.writeFileSync(path.resolve(outputPath), json, "utf8")
    console.log(`Wrote pilot evidence: ${path.resolve(outputPath)}`)
  } else {
    console.log(json)
  }

  console.log(
    `\nGo/No-Go: ${analysis.go_no_go.verdict} — ${analysis.go_no_go.justification}`,
  )

  if (!validation.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
