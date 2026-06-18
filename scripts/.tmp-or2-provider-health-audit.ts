import "server-only"

import { createClient } from "@supabase/supabase-js"
import { loadGrowthPdlProviderHealth } from "../lib/growth/contact-discovery/contact-discovery-provider-health-repository"
import { isPdlApiConfigured } from "../lib/growth/providers/pdl/pdl-config"
import { isZeroBounceConfigured } from "../lib/growth/contact-verification/providers/zerobounce-config"
import { diagnoseApolloContactDiscoveryConfig } from "../lib/growth/providers/apollo/apollo-config-diagnostics"
import { bootstrapGrowthEngineE2EProductionEnv } from "../lib/growth/e2e/growth-engine-e2e-production-env"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function envKeyStatus(key: string): "present" | "missing" | "empty" {
  const v = process.env[key]
  if (v === undefined || v === null) return "missing"
  if (!String(v).trim()) return "empty"
  return "present"
}

bootstrapGrowthEngineE2EProductionEnv()

async function main() {
  const apollo = diagnoseApolloContactDiscoveryConfig(process.env)

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.error("Supabase env missing for provider DB probes")
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const pdlHealth = await loadGrowthPdlProviderHealth(admin)

  const { count: senderCount } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  const { count: warmupCount } = await admin
    .schema("growth")
    .from("warmup_profiles")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  const { count: poolCount } = await admin
    .schema("growth")
    .from("sender_pools")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  const { count: domainCount } = await admin
    .schema("growth")
    .from("sending_domains")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)

  const { data: mailboxes } = await admin
    .schema("growth")
    .from("mailboxes")
    .select("provider, status")
    .is("deleted_at", null)
    .limit(50)

  const gmailMailboxes = (mailboxes ?? []).filter((m) => String(m.provider).toLowerCase().includes("google"))
  const m365Mailboxes = (mailboxes ?? []).filter((m) =>
    String(m.provider).toLowerCase().includes("microsoft") || String(m.provider).toLowerCase().includes("office"),
  )

  console.log(
    JSON.stringify(
      {
        apollo: {
          status: apollo.ready_for_live_search ? "configured" : apollo.api_key_present ? "partially configured" : "blocked",
          APOLLO_API_KEY: envKeyStatus("APOLLO_API_KEY"),
          GROWTH_APOLLO_API_KEY: envKeyStatus("GROWTH_APOLLO_API_KEY"),
          mock_mode: apollo.mock_mode,
          apollo_enabled: apollo.apollo_enabled,
        },
        pdl: {
          status: isPdlApiConfigured() && !pdlHealth.env_disabled ? "configured" : isPdlApiConfigured() ? "partially configured" : "blocked",
          PEOPLE_DATA_LABS_API_KEY: envKeyStatus("PEOPLE_DATA_LABS_API_KEY"),
          PDL_API_KEY: envKeyStatus("PDL_API_KEY"),
          sandbox_mode: pdlHealth.sandbox_mode,
        },
        zerobounce: {
          status: isZeroBounceConfigured() ? "configured" : "blocked",
          ZEROBOUNCE_API_KEY: envKeyStatus("ZEROBOUNCE_API_KEY"),
          GROWTH_ZEROBOUNCE_API_KEY: envKeyStatus("GROWTH_ZEROBOUNCE_API_KEY"),
        },
        gmail: {
          status: gmailMailboxes.length > 0 ? "configured" : envKeyStatus("GOOGLE_CLIENT_ID") === "present" ? "partially configured" : "blocked",
          connected_mailboxes: gmailMailboxes.length,
          GOOGLE_CLIENT_ID: envKeyStatus("GOOGLE_CLIENT_ID"),
        },
        microsoft_365: {
          status: m365Mailboxes.length > 0 ? "configured" : envKeyStatus("MICROSOFT_CLIENT_ID") === "present" ? "partially configured" : "blocked",
          connected_mailboxes: m365Mailboxes.length,
          MICROSOFT_CLIENT_ID: envKeyStatus("MICROSOFT_CLIENT_ID"),
        },
        sending_domains: {
          status: (domainCount ?? 0) > 0 ? "configured" : "blocked",
          domain_count: domainCount ?? 0,
        },
        dns_verification: {
          status: (domainCount ?? 0) > 0 ? "partially configured" : "blocked",
          note: "DNS state per-domain — run deliverability scan for pass/fail",
        },
        mailbox_health: {
          status: (senderCount ?? 0) > 0 ? "partially configured" : "blocked",
          sender_accounts: senderCount ?? 0,
          total_mailboxes: (mailboxes ?? []).length,
        },
        warmup: {
          status: (warmupCount ?? 0) > 0 ? "configured" : (senderCount ?? 0) > 0 ? "partially configured" : "blocked",
          warmup_profiles: warmupCount ?? 0,
        },
        sender_pools: {
          status: (poolCount ?? 0) > 0 ? "configured" : "blocked",
          pool_count: poolCount ?? 0,
        },
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
