/**
 * GE-AIOS-LIVE-2D — Production-authoritative DataMoon validation helpers (client-safe).
 *
 * Generalizes CONTACT-1C / runtime-config-proof philosophy:
 * local vercel env run cannot read encrypted Production secrets — deployed runtime is authoritative.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { classifyBooleanFromDeployedOrLocal } from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-classifiers"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import {
  fetchDeployedDatamoonDiscoveryHealth,
  GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH,
  type DeployedDatamoonDiscoveryHealthSnapshot,
} from "@/lib/growth/qa/growth-datamoon-discovery-health-deployed-probe"
import {
  fetchSupabaseAnonKeyFromCli,
  resolveLinkedSupabaseProjectRef,
} from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { getPlatformAdminEmails } from "@/lib/platform-admin-policy"
import {
  auditDatamoonProductionEnvPresence,
  DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-production-configuration-audit-2b"
import type {
  DatamoonAutonomousDiscoveryStatusLabel,
  DatamoonAutonomousDiscoveryStopReason,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

export const GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER =
  "ge-aios-live-2d-production-authoritative-datamoon-validation-v1" as const

export const LOCAL_ENCRYPTED_PRODUCTION_SECRETS_UNREADABLE_NOTE =
  "Local vercel env run cannot materialize encrypted Vercel Production secrets — local process.env is non-authoritative." as const

export const DEPLOYED_PRODUCTION_RUNTIME_AUTHORITATIVE_NOTE =
  "Authoritative Production DataMoon configuration: GET /api/platform/growth/ai-os/datamoon-discovery-health on deployed runtime." as const

function isPresentEnvValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim() !== '""' && value.trim() !== "''"
}

export function isLocalEncryptedProductionSecretsUnreadable(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") return false
  return DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS.every(
    (key) => !isPresentEnvValue(env[key]),
  )
}

export function auditLocalDatamoonEnvPresenceNonAuthoritative(
  env: NodeJS.ProcessEnv = process.env,
): {
  scope: "local_vercel_env_run_subprocess"
  authoritative: false
  secretsReadable: boolean
  requiredEnv: ReturnType<typeof auditDatamoonProductionEnvPresence>
  note: string
} {
  const requiredEnv = auditDatamoonProductionEnvPresence(env)
  const secretsReadable = DATAMOON_PRODUCTION_CONFIGURATION_ENV_KEYS.some(
    (key) => requiredEnv[key] === "present",
  )
  return {
    scope: "local_vercel_env_run_subprocess",
    authoritative: false,
    secretsReadable,
    requiredEnv,
    note: secretsReadable
      ? "Local subprocess has readable DataMoon values — still prefer deployed runtime for Production certification."
      : LOCAL_ENCRYPTED_PRODUCTION_SECRETS_UNREADABLE_NOTE,
  }
}

export type ProductionAuthoritativeDatamoonConfiguration = {
  authority: "deployed_runtime" | "local_inconclusive"
  configurationCompleteForProduction: boolean | null
  datamoonEnabled: boolean | null
  datamoonConfigured: boolean | null
  datamoonEligibleForAutonomousDiscovery: boolean | null
  stopReason: DatamoonAutonomousDiscoveryStopReason | null
  statusLabel: DatamoonAutonomousDiscoveryStatusLabel | null
  statusDisplay: string | null
  productionMisconfigured: boolean
  configurationUnknown: boolean
  note: string
}

function inferStatusLabelFromLegacySnapshot(
  snapshot: DeployedDatamoonDiscoveryHealthSnapshot,
): DatamoonAutonomousDiscoveryStatusLabel {
  if (snapshot.datamoonEligibleForAutonomousDiscovery) return "idle"
  if (!snapshot.datamoonEnabled) return "needs_configuration"
  if (!snapshot.datamoonConfigured) return "needs_configuration"
  return "needs_configuration"
}

export function interpretDeployedDatamoonDiscoveryHealthSnapshot(
  snapshot: DeployedDatamoonDiscoveryHealthSnapshot,
): ProductionAuthoritativeDatamoonConfiguration {
  const configurationCompleteForProduction =
    typeof snapshot.configurationCompleteForProduction === "boolean"
      ? snapshot.configurationCompleteForProduction
      : snapshot.datamoonEnabled &&
        snapshot.datamoonConfigured &&
        snapshot.datamoonEligibleForAutonomousDiscovery

  const stopReason =
    snapshot.stopReason ??
    (!snapshot.datamoonEnabled
      ? "datamoon_disabled"
      : !snapshot.datamoonConfigured
        ? "datamoon_not_configured"
        : !snapshot.datamoonEligibleForAutonomousDiscovery
          ? "datamoon_dry_run_only"
          : null)

  const statusLabel = snapshot.statusLabel ?? inferStatusLabelFromLegacySnapshot(snapshot)
  const statusDisplay =
    snapshot.statusDisplay ??
    (snapshot.datamoonEligibleForAutonomousDiscovery
      ? "Idle"
      : stopReason === "datamoon_disabled"
        ? "DataMoon is disabled for this environment."
        : stopReason === "datamoon_not_configured"
          ? "DataMoon needs configuration before autonomous discovery can run."
          : stopReason === "datamoon_dry_run_only"
            ? "DataMoon dry-run mode is active — live Production discovery requires live credentials."
            : "Autonomous discovery unavailable.")

  const productionMisconfigured =
    !configurationCompleteForProduction ||
    stopReason === "datamoon_disabled" ||
    stopReason === "datamoon_not_configured" ||
    stopReason === "datamoon_dry_run_only" ||
    statusLabel === "needs_configuration"

  return {
    authority: "deployed_runtime",
    configurationCompleteForProduction,
    datamoonEnabled: snapshot.datamoonEnabled,
    datamoonConfigured: snapshot.datamoonConfigured,
    datamoonEligibleForAutonomousDiscovery: snapshot.datamoonEligibleForAutonomousDiscovery,
    stopReason,
    statusLabel,
    statusDisplay,
    productionMisconfigured,
    configurationUnknown: false,
    note: DEPLOYED_PRODUCTION_RUNTIME_AUTHORITATIVE_NOTE,
  }
}

export function buildInconclusiveProductionDatamoonConfiguration(input?: {
  reason?: string
}): ProductionAuthoritativeDatamoonConfiguration {
  return {
    authority: "local_inconclusive",
    configurationCompleteForProduction: null,
    datamoonEnabled: null,
    datamoonConfigured: null,
    datamoonEligibleForAutonomousDiscovery: null,
    stopReason: null,
    statusLabel: null,
    statusDisplay: null,
    productionMisconfigured: false,
    configurationUnknown: true,
    note:
      input?.reason ??
      "Deployed Production DataMoon health unavailable — cannot infer Production misconfiguration from local env.",
  }
}

export async function resolveProductionPlatformAdminEmail(input: {
  admin?: SupabaseClient
  organizationId?: string | null
}): Promise<string | null> {
  const fromEnv = getPlatformAdminEmails()[0]?.trim().toLowerCase()
  if (fromEnv) return fromEnv

  if (!input.admin) return null

  if (input.organizationId) {
    const { data: members } = await input.admin
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", input.organizationId)
      .order("created_at", { ascending: true })
      .limit(20)

    const ownerUserId =
      members?.find((row) => row.role === "owner")?.user_id ??
      members?.find((row) => row.role === "admin")?.user_id ??
      members?.[0]?.user_id

    if (typeof ownerUserId === "string") {
      const { data: profile } = await input.admin
        .from("profiles")
        .select("email")
        .eq("id", ownerUserId)
        .maybeSingle()
      const profileEmail = profile?.email?.trim().toLowerCase()
      if (profileEmail) return profileEmail

      const user = await input.admin.auth.admin.getUserById(ownerUserId)
      const authEmail = user.data.user?.email?.trim().toLowerCase()
      if (authEmail) return authEmail
    }
  }

  const { data: profile } = await input.admin
    .from("profiles")
    .select("email")
    .not("email", "is", null)
    .limit(1)
    .maybeSingle()
  const profileEmail = profile?.email?.trim().toLowerCase()
  if (profileEmail) return profileEmail

  const listed = await input.admin.auth.admin.listUsers({ page: 1, perPage: 50 })
  const authEmail = listed.data.users.find((user) => user.email?.trim())?.email?.trim().toLowerCase()
  return authEmail ?? null
}

export async function resolveProductionPlatformAdminBearer(input: {
  supabaseUrl: string
  serviceRoleKey: string
  env?: NodeJS.ProcessEnv
  admin?: SupabaseClient
  organizationId?: string | null
}): Promise<{ accessToken: string | null; email: string | null; error: string | null }> {
  const env = input.env ?? process.env
  let anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ""
  if (!anonKey) {
    const projectRef = resolveLinkedSupabaseProjectRef()
    if (projectRef) {
      anonKey = fetchSupabaseAnonKeyFromCli(projectRef) ?? ""
    }
  }
  if (!anonKey) {
    return { accessToken: null, email: null, error: "anon_key_unavailable_for_deployed_probe" }
  }

  const adminEmail = await resolveProductionPlatformAdminEmail({
    admin: input.admin,
    organizationId: input.organizationId,
  })
  if (!adminEmail) {
    return { accessToken: null, email: null, error: "no_platform_admin_email_configured" }
  }

  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: input.supabaseUrl,
    service_role_key: input.serviceRoleKey,
    anon_key: anonKey,
    admin_email: adminEmail,
  })
  return {
    accessToken: minted.access_token,
    email: minted.email,
    error: minted.error,
  }
}

export async function resolveProductionAuthoritativeDatamoonValidation(input: {
  supabaseUrl: string
  serviceRoleKey: string
  env?: NodeJS.ProcessEnv
  admin?: SupabaseClient
  organizationId?: string | null
}): Promise<{
  qaMarker: typeof GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER
  healthRoutePath: typeof GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH
  localEnv: ReturnType<typeof auditLocalDatamoonEnvPresenceNonAuthoritative>
  deployedProbe: Awaited<ReturnType<typeof fetchDeployedDatamoonDiscoveryHealth>> | null
  configuration: ProductionAuthoritativeDatamoonConfiguration
}> {
  const env = input.env ?? process.env
  const localEnv = auditLocalDatamoonEnvPresenceNonAuthoritative(env)

  const bearer = await resolveProductionPlatformAdminBearer(input)
  if (!bearer.accessToken) {
    return {
      qaMarker: GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
      healthRoutePath: GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH,
      localEnv,
      deployedProbe: null,
      configuration: buildInconclusiveProductionDatamoonConfiguration({
        reason: bearer.error ?? "deployed_health_probe_unavailable",
      }),
    }
  }

  const deployedProbe = await fetchDeployedDatamoonDiscoveryHealth({
    bearerToken: bearer.accessToken,
  })

  if (!deployedProbe.ok) {
    return {
      qaMarker: GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
      healthRoutePath: GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH,
      localEnv,
      deployedProbe,
      configuration: buildInconclusiveProductionDatamoonConfiguration({
        reason: deployedProbe.error,
      }),
    }
  }

  return {
    qaMarker: GROWTH_PRODUCTION_AUTHORITATIVE_DATAMOON_VALIDATION_2D_QA_MARKER,
    healthRoutePath: GROWTH_DATAMOON_DISCOVERY_HEALTH_ROUTE_PATH,
    localEnv,
    deployedProbe,
    configuration: interpretDeployedDatamoonDiscoveryHealthSnapshot(deployedProbe.snapshot),
  }
}

export function classifyDatamoonBooleanFromDeployedOrLocal(input: {
  deployedValue: boolean | null | undefined
  localValue: boolean
  env?: NodeJS.ProcessEnv
}): ReturnType<typeof classifyBooleanFromDeployedOrLocal> {
  const env = input.env ?? process.env
  const localEnvPresent = isPresentEnvValue(env.DATAMOON_PROVIDER_ENABLED)
  return classifyBooleanFromDeployedOrLocal({
    deployedValue: input.deployedValue,
    localValue: input.localValue,
    localEnvPresent,
    vercelProductionEnvRun: env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
  })
}

export function localEnvMustNotFailProductionConfiguration(
  configuration: ProductionAuthoritativeDatamoonConfiguration,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (configuration.authority === "deployed_runtime") {
    return true
  }
  return (
    isLocalEncryptedProductionSecretsUnreadable(env) &&
    configuration.configurationUnknown &&
    !configuration.productionMisconfigured
  )
}
