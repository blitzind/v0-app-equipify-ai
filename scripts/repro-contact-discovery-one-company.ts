import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES } from "@/lib/growth/contact-discovery/contact-discovery-operator-providers"
import { runContactDiscoveryProviders } from "@/lib/growth/contact-discovery/contact-discovery-registry"
import {
  resolveCompanyCandidateContext,
  runContactDiscoveryForCompany,
} from "@/lib/growth/contact-discovery/contact-repository"
import { probeGrowthContactDiscoverySchema } from "@/lib/growth/contact-discovery/contact-schema-health"
import { isPdlApiConfigured, isPdlDiscoveryDisabled } from "@/lib/growth/providers/pdl/pdl-client"

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

async function main() {
  loadEnvFile(".env.local.active")
  const companyId = process.argv[2] ?? "a2fa31a8-acf6-4c26-b2a1-d79cf2fad6d3"
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing Supabase env")
    process.exit(1)
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })

  const health = await probeGrowthContactDiscoverySchema(admin)
  console.log("schema_health", JSON.stringify(health, null, 2))
  console.log("pdl_configured", isPdlApiConfigured(), "pdl_disabled", isPdlDiscoveryDisabled())
  console.log(
    "GROWTH_RESEARCH_WEBSITE_ENABLED",
    process.env.GROWTH_RESEARCH_WEBSITE_ENABLED ?? "(unset)",
  )

  const ctx = await resolveCompanyCandidateContext(admin, companyId)
  console.log("context", ctx)

  if (ctx) {
    const results = await runContactDiscoveryProviders(
      admin,
      {
        company_candidate_id: ctx.company_candidate_id,
        company_name: ctx.company_name,
        domain: ctx.domain,
        website_url: ctx.website_url,
        growth_lead_id: ctx.growth_lead_id,
        industry: ctx.industry,
        limit: 20,
      },
      { provider_types: [...OPERATOR_CONTACT_DISCOVERY_PROVIDER_TYPES] },
    )
    for (const r of results) {
      console.log(
        JSON.stringify({
          provider: r.provider_name,
          status: r.status,
          message: r.message,
          contacts_returned: r.contacts.length,
        }),
      )
    }
  }

  const snapshot = await runContactDiscoveryForCompany(admin, {
    company_candidate_id: companyId,
  })
  console.log(
    "snapshot",
    JSON.stringify({
      schema_ready: snapshot.schema_ready,
      provider_messages: snapshot.provider_messages,
      contact_count: snapshot.contacts.length,
      run_id: snapshot.run?.id ?? null,
      run_status: snapshot.run?.status ?? null,
    }),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
