/**
 * Apollo AI-4 — dry-run report before live pilot (no Apollo API calls).
 * Run: pnpm dry-run:apollo-live-pilot-ai-4
 *
 * Production:
 *   vercel env run -e production -- pnpm dry-run:apollo-live-pilot-ai-4
 */
import { createClient } from "@supabase/supabase-js"
import {
  buildApolloLivePilotDryRunReport,
  formatApolloLivePilotDryRunMarkdown,
} from "../lib/growth/apollo/apollo-live-pilot-dry-run"
import { resolveApolloLivePilotTestCompany } from "../lib/growth/apollo/apollo-live-pilot-test-company-selector"
import { bootstrapApolloLivePilotCliEnv } from "./apollo-live-pilot-cli-env-bootstrap"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

async function main(): Promise<void> {
  bootstrapApolloLivePilotCliEnv()

  let targetCompany = null
  const companyId =
    process.env.GROWTH_APOLLO_AI_3_COMPANY_CANDIDATE_ID?.trim() ||
    process.env.GROWTH_APOLLO_AI_4_COMPANY_CANDIDATE_ID?.trim() ||
    null

  const boot = bootstrapVerifiedChannelsCertEnv()
  if (boot) {
    const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    const resolved = await resolveApolloLivePilotTestCompany(admin, {
      company_candidate_id: companyId,
    })
    targetCompany = resolved.company
  }

  const report = buildApolloLivePilotDryRunReport({ target_company: targetCompany })
  console.log(formatApolloLivePilotDryRunMarkdown(report))
  console.log("")
  console.log(
    JSON.stringify(
      {
        ok: report.ready_to_execute_live,
        will_call_apollo_api: report.will_call_apollo_api,
        blockers: report.blockers,
      },
      null,
      2,
    ),
  )
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
