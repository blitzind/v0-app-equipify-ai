/** Phase 7.PS-HZ-RUNTIME — Deployed runtime email discovery for corroborated persons. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import { runEmailDiscoveryForCanonicalPerson } from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import type {
  CorroboratedChannelRuntimeContext,
  CorroboratedChannelRuntimeProvenance,
} from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-types"
import type { CorroboratedPersonTarget } from "@/lib/growth/corroborated-contact-channel-completion/corroborated-contact-channel-completion-types"
import {
  probeDeployedGrowthProviderRuntime,
  resolveGrowthDeployedRuntimeBaseUrl,
  resolveGrowthDeployedRuntimeCronSecret,
  runDeployedEmailDiscoveryCert,
} from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"

/** Vercel cron email cert route only accepts the PS-HO-RUNTIME default target. */
const DEPLOYED_EMAIL_CRON_DEFAULT_TARGET = {
  company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
  person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
} as const

function matchesDeployedEmailCronDefaultTarget(target: CorroboratedPersonTarget): boolean {
  return (
    target.company_id === DEPLOYED_EMAIL_CRON_DEFAULT_TARGET.company_id &&
    target.person_id === DEPLOYED_EMAIL_CRON_DEFAULT_TARGET.person_id
  )
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function readDiscoveryCounts(body: Record<string, unknown> | null): {
  candidate_count: number
  verified_count: number
  promoted_count: number
} {
  const result =
    body?.result && typeof body.result === "object"
      ? (body.result as Record<string, unknown>)
      : body

  return {
    candidate_count: asNumber(result?.candidate_count),
    verified_count: asNumber(result?.verified_count),
    promoted_count: asNumber(result?.promoted_count),
  }
}

export async function resolveCorroboratedChannelRuntimeContext(
  admin: SupabaseClient,
): Promise<CorroboratedChannelRuntimeContext> {
  const localCert = evaluateEmailDiscoveryVerificationCertification()
  const local_zerobounce_configured =
    localCert.zerobounce_configured && !localCert.verification_disabled

  if (local_zerobounce_configured) {
    return {
      local_zerobounce_configured: true,
      deployed_runtime_available: false,
      deployed_zerobounce_configured: false,
      deployed_production_safe: false,
      deployed_base_url: null,
      cron_secret_available: Boolean(resolveGrowthDeployedRuntimeCronSecret()),
      email_execution_path: "local",
    }
  }

  const base_url = resolveGrowthDeployedRuntimeBaseUrl()
  const cron_secret = resolveGrowthDeployedRuntimeCronSecret()
  const deployed_probe = await probeDeployedGrowthProviderRuntime({
    base_url,
    cron_secret,
    admin,
  })

  const deployed_runtime_available = deployed_probe.ok
  const deployed_zerobounce_configured = deployed_probe.ok
    ? deployed_probe.diagnostics.loaders.isZeroBounceConfigured
    : false
  const deployed_production_safe = deployed_probe.ok
    ? deployed_probe.diagnostics.production_safe
    : false

  let email_execution_path: CorroboratedChannelRuntimeContext["email_execution_path"] = "unavailable"
  if (
    deployed_runtime_available &&
    deployed_zerobounce_configured &&
    deployed_production_safe
  ) {
    email_execution_path = "deployed_runtime"
  }

  return {
    local_zerobounce_configured: false,
    deployed_runtime_available,
    deployed_zerobounce_configured,
    deployed_production_safe,
    deployed_base_url: deployed_probe.ok ? deployed_probe.base_url : base_url,
    cron_secret_available: Boolean(cron_secret),
    email_execution_path,
  }
}

export async function runEmailDiscoveryForCorroboratedPerson(input: {
  admin: SupabaseClient
  target: CorroboratedPersonTarget
  runtime_context: CorroboratedChannelRuntimeContext
}): Promise<{
  attempted: boolean
  candidate_count: number
  verified_count: number
  promoted_count: number
  error: string | null
  runtime: CorroboratedChannelRuntimeProvenance
  messages: string[]
}> {
  const messages: string[] = []
  const skippedRuntime: CorroboratedChannelRuntimeProvenance = {
    local_env_used: false,
    deployed_runtime_used: false,
    provider_config_source: "unavailable",
    cron_telemetry_run_id: null,
    deployed_base_url: input.runtime_context.deployed_base_url,
    execution_channel: "skipped",
  }

  if (input.runtime_context.email_execution_path === "local") {
    try {
      const result = await runEmailDiscoveryForCanonicalPerson(input.admin, {
        company_id: input.target.company_id,
        person_id: input.target.person_id,
        promote: true,
        require_production_safe_verification: true,
      })
      messages.push(
        `email_local: candidates=${result.candidate_count} verified=${result.verified_count} promoted=${result.promoted_count}`,
      )
      return {
        attempted: true,
        candidate_count: result.candidate_count,
        verified_count: result.verified_count,
        promoted_count: result.promoted_count,
        error: null,
        runtime: {
          local_env_used: true,
          deployed_runtime_used: false,
          provider_config_source: "local_cert_env",
          cron_telemetry_run_id: null,
          deployed_base_url: null,
          execution_channel: "local",
        },
        messages,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      messages.push(`email_local_error: ${message}`)
      return {
        attempted: true,
        candidate_count: 0,
        verified_count: 0,
        promoted_count: 0,
        error: message,
        runtime: {
          local_env_used: true,
          deployed_runtime_used: false,
          provider_config_source: "local_cert_env",
          cron_telemetry_run_id: null,
          deployed_base_url: null,
          execution_channel: "local",
        },
        messages,
      }
    }
  }

  if (input.runtime_context.email_execution_path !== "deployed_runtime") {
    const blockers = [
      !input.runtime_context.deployed_runtime_available
        ? "deployed_runtime_unavailable"
        : null,
      !input.runtime_context.deployed_zerobounce_configured
        ? "deployed_zerobounce_not_configured"
        : null,
      !input.runtime_context.deployed_production_safe
        ? "deployed_runtime_not_production_safe"
        : null,
    ].filter(Boolean)
    const error = blockers.join("; ") || "email_discovery_unavailable"
    messages.push(`email_skipped: ${error}`)
    return {
      attempted: false,
      candidate_count: 0,
      verified_count: 0,
      promoted_count: 0,
      error,
      runtime: skippedRuntime,
      messages,
    }
  }

  const base_url = input.runtime_context.deployed_base_url
  if (!base_url) {
    return {
      attempted: false,
      candidate_count: 0,
      verified_count: 0,
      promoted_count: 0,
      error: "deployed_base_url_unconfigured",
      runtime: skippedRuntime,
      messages: ["email_skipped: deployed_base_url_unconfigured"],
    }
  }

  if (
    !input.runtime_context.cron_secret_available &&
    !matchesDeployedEmailCronDefaultTarget(input.target)
  ) {
    const error =
      "deployed_http_requires_cron_secret_for_non_default_target — set CRON_SECRET for per-person email discovery"
    messages.push(`email_skipped: ${error}`)
    return {
      attempted: false,
      candidate_count: 0,
      verified_count: 0,
      promoted_count: 0,
      error,
      runtime: {
        local_env_used: false,
        deployed_runtime_used: false,
        provider_config_source: "deployed_runtime",
        cron_telemetry_run_id: null,
        deployed_base_url: base_url,
        execution_channel: "skipped",
      },
      messages,
    }
  }

  const run = await runDeployedEmailDiscoveryCert({
    base_url,
    cron_secret: resolveGrowthDeployedRuntimeCronSecret(),
    company_id: input.target.company_id,
    person_id: input.target.person_id,
    admin: input.admin,
  })

  const counts = readDiscoveryCounts(run.body)
  const execution_channel =
    run.channel === "http" ? "deployed_http" : "deployed_vercel_cron"

  if (run.ok) {
    messages.push(
      `email_deployed_${execution_channel}: candidates=${counts.candidate_count} verified=${counts.verified_count} promoted=${counts.promoted_count}`,
    )
  } else {
    messages.push(`email_deployed_error: ${run.error ?? "unknown"}`)
  }

  return {
    attempted: true,
    candidate_count: counts.candidate_count,
    verified_count: counts.verified_count,
    promoted_count: counts.promoted_count,
    error: run.ok ? null : run.error,
    runtime: {
      local_env_used: false,
      deployed_runtime_used: true,
      provider_config_source: "deployed_runtime",
      cron_telemetry_run_id: run.cron_telemetry_run_id,
      deployed_base_url: base_url,
      execution_channel,
    },
    messages,
  }
}
