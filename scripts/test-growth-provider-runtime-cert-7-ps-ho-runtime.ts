/**
 * Phase 7.PS-HO-RUNTIME — Provider runtime verification (local vs deployed).
 * Run: pnpm test:growth-provider-runtime-cert-7-ps-ho-runtime
 *
 * Requires for deployed probe:
 *   GROWTH_ENGINE_PUBLIC_BASE_URL or GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_URL
 *   CRON_SECRET (in cert runner shell — not from KEY="" local files)
 */
import { createClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "../lib/growth/email-discovery/email-discovery-certification"
import {
  buildLocalProviderLoaderStatus,
  GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
} from "../lib/growth/qa/growth-provider-runtime-diagnostics"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedEmailDiscoveryCert,
  GROWTH_PROVIDER_DEPLOYED_RUNTIME_PROBE_QA_MARKER,
} from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import {
  auditProviderRuntimeEnvResolution,
  GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
} from "../lib/growth/qa/provider-runtime-env-resolution"
import {
  bootstrapVerifiedChannelsCertEnv,
  auditVerifiedChannelsCertEnv,
} from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PROVIDER_RUNTIME_CERT_7_PS_HO_RUNTIME_QA_MARKER =
  "growth-provider-runtime-cert-7-ps-ho-runtime-v1" as const

const BIOMEDICAL_TARGET = {
  company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
  person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
  company_name: "Biomedical Repair Service",
  email: "thanh@biomed-service.com",
} as const

async function loadEmailState(
  admin: ReturnType<typeof createClient>,
  person_id: string,
) {
  const { data, error } = await admin
    .schema("growth")
    .from("person_emails")
    .select("email, verification_status, provider_name, discovery_source")
    .eq("person_id", person_id)
    .eq("email", BIOMEDICAL_TARGET.email)
    .limit(1)
  if (error) return { error: error.message }
  return data?.[0] ?? null
}

async function main() {
  const local_before = auditProviderRuntimeEnvResolution()
  const boot = bootstrapVerifiedChannelsCertEnv()
  const local_after_resolution = auditProviderRuntimeEnvResolution({
    runtimeProcessEnv: process.env,
  })
  const local_loader = buildLocalProviderLoaderStatus(process.env)
  const file_audit = auditVerifiedChannelsCertEnv()
  const email_cert_local = evaluateEmailDiscoveryVerificationCertification()

  const base_url =
    resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai"
  const cron_secret = resolveGrowthDeployedRuntimeCronSecret()

  const admin_client = boot
    ? createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    : null

  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url,
    cron_secret,
    admin: admin_client,
  })

  const deployed_runtime_status = deployed_probe.ok
    ? {
        probed: true,
        base_url: deployed_probe.base_url,
        auth_method: deployed_probe.auth_method,
        zerobounce_configured: deployed_probe.diagnostics.loaders.isZeroBounceConfigured,
        pdl_configured: deployed_probe.diagnostics.loaders.isPdlApiConfigured,
        production_safe: deployed_probe.diagnostics.production_safe,
        keys: deployed_probe.diagnostics.keys,
        runtime: deployed_probe.diagnostics.runtime,
      }
    : {
        probed: deployed_probe.probed,
        base_url: deployed_probe.base_url,
        error: deployed_probe.error,
        detail: deployed_probe.detail ?? null,
        http_status: deployed_probe.http_status,
      }

  const provider_loader_status = deployed_probe.ok
    ? {
        source: "deployed_runtime" as const,
        isZeroBounceConfigured: deployed_probe.diagnostics.loaders.isZeroBounceConfigured,
        isPdlApiConfigured: deployed_probe.diagnostics.loaders.isPdlApiConfigured,
        fixture_enabled: deployed_probe.diagnostics.loaders.fixture_enabled,
        verification_disabled: deployed_probe.diagnostics.loaders.email_verification_disabled,
      }
    : {
        source: "local_cert_runner_fallback" as const,
        isZeroBounceConfigured: local_loader.isZeroBounceConfigured,
        isPdlApiConfigured: local_loader.isPdlApiConfigured,
        fixture_enabled: local_loader.fixture_enabled,
        verification_disabled: local_loader.verification_disabled,
        note: "Deployed probe unavailable — local status is not authoritative for Production.",
      }

  let email_discovery: Record<string, unknown> = { attempted: false, reason: "deployed_runtime_not_proven" }
  let email_row_before: unknown = null
  let email_row_after: unknown = null

  if (admin_client) {
    email_row_before = await loadEmailState(admin_client, BIOMEDICAL_TARGET.person_id)
  }

  if (
    deployed_probe.ok &&
    deployed_probe.diagnostics.loaders.isZeroBounceConfigured &&
    deployed_probe.diagnostics.production_safe &&
    admin_client
  ) {
    const run = await runDeployedEmailDiscoveryCert({
      base_url: deployed_probe.base_url,
      cron_secret,
      company_id: BIOMEDICAL_TARGET.company_id,
      person_id: BIOMEDICAL_TARGET.person_id,
      admin: admin_client,
    })
    email_discovery = {
      attempted: true,
      channel: "deployed_runtime",
      target: BIOMEDICAL_TARGET,
      http_status: run.http_status,
      ok: run.ok,
      error: run.error,
      result: run.body,
    }
    if (admin_client) {
      email_row_after = await loadEmailState(admin_client, BIOMEDICAL_TARGET.person_id)
    }
  } else if (provider_loader_status.isZeroBounceConfigured && email_cert_local.production_safe) {
    email_discovery = {
      attempted: false,
      reason: "local_loader_configured_but_deployed_runtime_not_proven",
      note: "Email discovery must run on deployed runtime to avoid false negatives from local KEY=\"\" files.",
    }
  }

  const deployed_proven = deployed_probe.ok && deployed_probe.diagnostics.loaders.isZeroBounceConfigured
  const email_row_after_ok =
    email_row_after &&
    typeof email_row_after === "object" &&
    !("error" in (email_row_after as Record<string, unknown>))
      ? (email_row_after as { verification_status?: string; provider_name?: string })
      : null
  let discovery_candidates: Array<{ verification_provider?: string }> = []
  if (
    email_discovery &&
    typeof email_discovery === "object" &&
    email_discovery.result &&
    typeof email_discovery.result === "object"
  ) {
    const nested = email_discovery.result as {
      result?: { candidates?: Array<{ verification_provider?: string }> }
    }
    discovery_candidates = nested.result?.candidates ?? []
  }
  const email_verified =
    email_row_after_ok?.verification_status === "verified" ||
    discovery_candidates.some((c) => c.verification_provider === "zerobounce")
  const provider_backed = email_verified

  let certification: "PASS" | "PASS_PARTIAL" | "FAIL" = "FAIL"
  if (deployed_proven && email_verified && provider_backed) {
    certification = "PASS"
  } else if (deployed_proven) {
    certification = "PASS_PARTIAL"
  } else if (deployed_probe.error === "deployed_endpoint_not_found") {
    certification = "FAIL"
  } else if (!deployed_probe.ok && !local_loader.isZeroBounceConfigured) {
    certification = "FAIL"
  }

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROVIDER_RUNTIME_CERT_7_PS_HO_RUNTIME_QA_MARKER,
        diagnostics_qa_marker: GROWTH_PROVIDER_RUNTIME_DIAGNOSTICS_QA_MARKER,
        probe_qa_marker: GROWTH_PROVIDER_DEPLOYED_RUNTIME_PROBE_QA_MARKER,
        resolution_qa_marker: GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
        certification,
        root_cause:
          deployed_probe.ok && !deployed_probe.diagnostics.loaders.isZeroBounceConfigured
            ? "Deployed runtime probed but provider loaders still false — check Vercel Production env on deployed revision."
            : !deployed_probe.ok
              ? `Cannot prove deployed runtime: ${deployed_probe.error}`
              : local_before.local_cert_env_status.file_placeholder_keys.length > 0
                ? "Local cert false negative from KEY=\"\" placeholders; use deployed_runtime_status for authority."
                : null,
        local_cert_env_status: local_after_resolution.local_cert_env_status,
        local_resolution_notes: local_after_resolution.local_resolution_notes,
        deployed_runtime_status,
        provider_loader_status,
        local_provider_loader_status: local_loader,
        file_env_audit_keys: {
          ZEROBOUNCE_API_KEY: file_audit.keys.ZEROBOUNCE_API_KEY.status,
          PEOPLE_DATA_LABS_API_KEY: file_audit.keys.PEOPLE_DATA_LABS_API_KEY.status,
          PDL_API_KEY: file_audit.keys.PDL_API_KEY.status,
        },
        email_discovery,
        email_verification: {
          before: email_row_before,
          after: email_row_after,
          provider_backed,
        },
        probe_config: {
          base_url_resolved: base_url,
          cron_secret_present: Boolean(cron_secret),
          probe_channel: deployed_probe.ok ? deployed_probe.probe_channel : deployed_probe.probe_channel ?? null,
          vercel_cron_fallback_available: Boolean(admin_client),
        },
        remediation: local_after_resolution.remediation,
      },
      null,
      2,
    ),
  )

  if (certification === "FAIL") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
