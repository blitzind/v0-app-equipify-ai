/**
 * Apollo AI-3 live pilot execution + production certification.
 * Run: pnpm run:apollo-live-pilot-ai-3
 *
 * Executes one live Apollo pilot (AI-2 runner) and produces AI-3 certification.
 *
 * Requires:
 *   GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true  (or GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED=true)
 *   GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID=...  (or GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID)
 *   GROWTH_APOLLO_USE_MOCK=false
 *   APOLLO_API_KEY=...
 *   GROWTH_APOLLO_LIVE_BENCHMARK_ACK=1
 *
 * Optional:
 *   GROWTH_APOLLO_AI_3_OUTPUT_PATH=./evidence/apollo-ai-3-pilot.json
 *   GROWTH_APOLLO_AI_3_REPORT_PATH=./evidence/apollo-ai-3-certification.md
 *   APOLLO_VD4_LIVE_CERTIFIED=true  (if VD-4 Voice Drop live cert complete)
 *
 * Production:
 *   vercel env run -e production -- pnpm run:apollo-live-pilot-ai-3
 */
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  certifyApolloProductionRollout,
  formatApolloAi3CertificationMarkdown,
} from "../lib/growth/apollo/apollo-integration-ai-3-production-certification"
import { buildApolloLivePilotEvidenceBundle } from "../lib/growth/apollo/apollo-live-pilot-evidence-bundle"
import { validateApolloLivePilotEvidence } from "../lib/growth/apollo/apollo-live-pilot-evidence-types"
import { runApolloLivePilotAi2 } from "../lib/growth/apollo/apollo-live-pilot-runner"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

function pilotEnabled(): boolean {
  return (
    process.env.GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED === "true" ||
    process.env.GROWTH_APOLLO_AI_2_LIVE_PILOT_ENABLED === "true"
  )
}

function companyCandidateId(): string | null {
  return (
    process.env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    process.env.GROWTH_APOLLO_AI_2_COMPANY_CANDIDATE_ID?.trim() ||
    null
  )
}

async function main(): Promise<void> {
  bootstrapApolloLivePilotCliEnv()

  if (!pilotEnabled()) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Set GROWTH_APOLLO_AI_3_LIVE_PILOT_ENABLED=true (or AI-2 equivalent).",
      }),
    )
    process.exit(1)
  }

  const company_candidate_id = companyCandidateId()
  if (!company_candidate_id) {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Set GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID to one test company.",
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
  const pilot = await runApolloLivePilotAi2(admin, { company_candidate_id })

  if (!pilot.evidence) {
    console.error(JSON.stringify({ ok: false, error: pilot.error ?? "No evidence produced." }))
    process.exit(1)
  }

  const validation = validateApolloLivePilotEvidence(pilot.evidence)
  const certification = certifyApolloProductionRollout({
    evidence: pilot.evidence,
    voice_drop_vd4_live_certified: process.env.APOLLO_VD4_LIVE_CERTIFIED === "true",
    compliance_orchestration_enabled: process.env.VOICE_COMPLIANCE_ORCHESTRATION_ENABLED === "true",
  })

  const outputPath =
    process.env.GROWTH_APOLLO_AI_3_OUTPUT_PATH?.trim() ||
    process.env.GROWTH_APOLLO_AI_2_OUTPUT_PATH?.trim()

  const payload = buildApolloLivePilotEvidenceBundle({
    evidence: pilot.evidence,
    validation,
    certification: certification.certification,
    ok: pilot.ok && certification.ok && validation.ok,
    output_path: outputPath,
  })
  const json = `${JSON.stringify(payload, null, 2)}\n`

  if (outputPath) {
    const resolved = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, json, "utf8")
    console.log(`Wrote pilot evidence: ${resolved}`)
  } else {
    console.log(json)
  }

  if (certification.certification) {
    const reportPath =
      process.env.GROWTH_APOLLO_AI_3_REPORT_PATH?.trim() ||
      path.join(path.dirname(outputPath ? path.resolve(outputPath) : process.cwd()), "apollo-ai-3-certification.md")
    const markdown = formatApolloAi3CertificationMarkdown(certification.certification)
    fs.writeFileSync(reportPath, `${markdown}\n`, "utf8")
    console.log(`Wrote certification report: ${reportPath}`)
    console.log(
      `\nFinal Go/No-Go: ${certification.certification.final_go_no_go.verdict}`,
    )
    console.log(certification.certification.final_go_no_go.justification)
  }

  if (!validation.ok || !certification.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
