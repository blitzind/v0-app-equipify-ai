/**
 * LE-3 — seed one Apollo live pilot test discovery candidate (no Apollo HTTP).
 * Run: pnpm seed:apollo-live-pilot-test-company
 *
 * Requires:
 *   APOLLO_TEST_COMPANY_SEED_ACK=1
 *   APOLLO_TEST_COMPANY_NAME=...
 *   APOLLO_TEST_COMPANY_DOMAIN=...
 *   APOLLO_TEST_COMPANY_WEBSITE=...
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import {
  seedApolloLivePilotTestCompany,
  validateApolloLivePilotTestCompanySeedEnv,
} from "../lib/growth/apollo/apollo-live-pilot-test-company-seed"
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

  const envCheck = validateApolloLivePilotTestCompanySeedEnv()
  if (!envCheck.ok || !envCheck.input) {
    console.error(JSON.stringify({ ok: false, errors: envCheck.errors }, null, 2))
    process.exit(1)
  }

  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "Supabase credentials unavailable." }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const result = await seedApolloLivePilotTestCompany(admin, envCheck.input)

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        created: result.created,
        message: result.message,
        company_candidate_id: result.company_candidate_id,
        company_name: result.company_name,
        domain: result.domain,
        website: result.website,
        source_marker: result.source_marker,
        env_hint: result.env_hint,
        next_steps: result.ok
          ? [
              "Add env_hint to .env.local",
              "pnpm select:apollo-live-pilot-test-company-ai-4",
              "pnpm dry-run:apollo-live-pilot-ai-4",
            ]
          : [],
      },
      null,
      2,
    ),
  )

  if (!result.ok) process.exit(1)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
