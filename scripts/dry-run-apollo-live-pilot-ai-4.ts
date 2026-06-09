/**
 * Apollo AI-4 — dry-run report before live pilot (no Apollo API calls).
 * Run: pnpm dry-run:apollo-live-pilot-ai-4
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import {
  buildApolloLivePilotDryRunReport,
  formatApolloLivePilotDryRunMarkdown,
} from "../lib/growth/apollo/apollo-live-pilot-dry-run"
import { resolveApolloLivePilotTestCompany } from "../lib/growth/apollo/apollo-live-pilot-test-company-selector"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

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

async function main(): Promise<void> {
  loadEnvFile(".env.local")
  loadEnvFile(".env.local.active")

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
