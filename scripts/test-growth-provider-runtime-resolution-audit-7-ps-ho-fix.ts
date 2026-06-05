/**
 * Phase 7.PS-HO-FIX — Provider runtime resolution audit.
 * Run: pnpm test:growth-provider-runtime-resolution-audit-7-ps-ho-fix
 */
import {
  isEmailVerificationDisabled,
  isEmailVerificationFixtureEnabled,
  isZeroBounceConfigured,
  getZeroBounceApiKey,
  resolveZeroBounceValidateUrl,
} from "../lib/growth/contact-verification/providers/zerobounce-config"
import {
  getPdlApiKey,
  isPdlApiConfigured,
  isPdlDiscoveryDisabled,
  resolvePdlPersonSearchBaseUrl,
} from "../lib/growth/providers/pdl/pdl-config"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
} from "../lib/growth/qa/growth-provider-deployed-runtime-probe"
import {
  auditProviderRuntimeEnvResolution,
  GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
} from "../lib/growth/qa/provider-runtime-env-resolution"
import {
  auditVerifiedChannelsCertEnv,
  bootstrapVerifiedChannelsCertEnv,
} from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

export const GROWTH_PROVIDER_RUNTIME_RESOLUTION_AUDIT_7_PS_HO_FIX_QA_MARKER =
  "growth-provider-runtime-resolution-audit-7-ps-ho-fix-v1" as const

function providerInitChecks() {
  const zbKey = getZeroBounceApiKey()
  const pdlKey = getPdlApiKey()
  return {
    zerobounce: {
      configured: isZeroBounceConfigured(),
      verification_disabled: isEmailVerificationDisabled(),
      fixture_enabled: isEmailVerificationFixtureEnabled(),
      can_build_validate_url: Boolean(zbKey && resolveZeroBounceValidateUrl("audit@example.com", zbKey).includes("api.zerobounce.net")),
      masked_key: zbKey ? `present(len=${zbKey.length})` : "(missing)",
    },
    pdl: {
      configured: isPdlApiConfigured(),
      discovery_disabled: isPdlDiscoveryDisabled(),
      can_build_search_url: Boolean(pdlKey && resolvePdlPersonSearchBaseUrl().includes("peopledatalabs.com")),
      masked_key: pdlKey ? `present(len=${pdlKey.length})` : "(missing)",
    },
  }
}

async function main() {
  const before_audit = auditProviderRuntimeEnvResolution()
  const before_runtime = providerInitChecks()
  const boot = bootstrapVerifiedChannelsCertEnv()
  const { createClient } = await import("@supabase/supabase-js")
  const admin = boot
    ? createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
    : null
  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url: resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai",
    cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
    admin,
  })
  const after_audit = auditProviderRuntimeEnvResolution({ runtimeProcessEnv: process.env })
  const after_runtime = providerInitChecks()
  const file_audit = auditVerifiedChannelsCertEnv()

  const certification = deployed_probe.ok
    ? deployed_probe.diagnostics.loaders.isZeroBounceConfigured &&
      deployed_probe.diagnostics.loaders.isPdlApiConfigured
      ? "PASS"
      : "PASS_PARTIAL"
    : after_runtime.zerobounce.configured && after_runtime.pdl.configured
      ? "PASS"
      : "FAIL_RESOLUTION"

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_PROVIDER_RUNTIME_RESOLUTION_AUDIT_7_PS_HO_FIX_QA_MARKER,
        resolution_qa_marker: GROWTH_PROVIDER_RUNTIME_ENV_RESOLUTION_QA_MARKER,
        certification,
        bootstrap_ok: Boolean(boot),
        before_bootstrap: {
          resolution: before_audit,
          runtime: before_runtime,
        },
        after_bootstrap: {
          resolution: after_audit,
          runtime: after_runtime,
          file_env_audit: file_audit,
        },
        provider_status_delta: {
          zerobounce_configured: {
            before: before_runtime.zerobounce.configured,
            after: after_runtime.zerobounce.configured,
          },
          pdl_configured: {
            before: before_runtime.pdl.configured,
            after: after_runtime.pdl.configured,
          },
        },
        local_cert_env_status: after_audit.local_cert_env_status,
        deployed_runtime_status: deployed_probe,
        local_resolution_notes: after_audit.local_resolution_notes,
        remediation: after_audit.remediation,
      },
      null,
      2,
    ),
  )

  if (certification !== "PASS") process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
