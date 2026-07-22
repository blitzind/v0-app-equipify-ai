/**
 * FUZOR-ADOPTION-1E-PRODUCTION-BOOTSTRAP-FIX-1A — verified-channels Supabase bootstrap tests.
 */
import assert from "node:assert/strict"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_PRODUCTION_SUPABASE_CREDENTIAL_RESOLUTION_QA_MARKER,
  isSupabaseServiceRoleJwt,
  resolveSupabaseCredentialsFromCliLinkedProject,
  sanitizeSupabaseCertEnvValue,
} from "../lib/growth/qa/growth-production-supabase-credential-resolution"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const PHASE = "FUZOR-ADOPTION-1E-PRODUCTION-BOOTSTRAP-FIX-1A" as const

function buildTestServiceRoleJwt(ref = "testproject"): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role", iss: "supabase", ref }),
  ).toString("base64url")
  return `${header}.${payload}.test-signature`
}

function buildOidcLikeJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ iss: "https://oidc.vercel.com/blitzify", sub: "owner" }),
  ).toString("base64url")
  return `${header}.${payload}.oidc-signature`
}

function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void | Promise<void>,
): void | Promise<void> {
  const previous: Record<string, string | undefined> = {}
  for (const key of Object.keys(overrides)) {
    previous[key] = process.env[key]
    const value = overrides[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    return fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function testBlankValuesRejected(): void {
  assert.equal(sanitizeSupabaseCertEnvValue('""'), "")
  assert.equal(isSupabaseServiceRoleJwt('""'), false)
  assert.equal(isSupabaseServiceRoleJwt(""), false)
  assert.equal(isSupabaseServiceRoleJwt(buildOidcLikeJwt()), false)
}

function testProcessEnvCredentialPrecedence(): void {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: buildTestServiceRoleJwt("processref"),
      NEXT_PUBLIC_SUPABASE_URL: "https://processref.supabase.co",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: undefined,
    },
    () => {
      const boot = bootstrapVerifiedChannelsCertEnv({
        sources: [],
        inheritProcessEnvProviderKeys: false,
        protectedSnapshot: {
          SUPABASE_SERVICE_ROLE_KEY: '""',
        },
      })
      assert.ok(boot, "expected process env credential to bootstrap verified channels")
      assert.equal(boot?.env_source, "process_env")
      assert.equal(boot?.url, "https://processref.supabase.co")
    },
  )
}

function testCliFallbackHelper(): void {
  const cliJwt = buildTestServiceRoleJwt("linkedref")
  const resolution = resolveSupabaseCredentialsFromCliLinkedProject({
    env: {},
    fetchServiceRoleKey: () => cliJwt,
    resolveProjectRef: () => "linkedref",
  })
  assert.ok(resolution)
  assert.equal(resolution?.env_source, "supabase_cli_linked_project")
  assert.equal(resolution?.url, "https://linkedref.supabase.co")
}

function testVerifiedChannelsCliFallbackIntegration(): void {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_URL: "",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
      VERCEL_ENV: "production",
    },
    () => {
      const boot = bootstrapVerifiedChannelsCertEnv({
        sources: [".env.vercel.production"],
        inheritProcessEnvProviderKeys: false,
        protectedSnapshot: {
          SUPABASE_SERVICE_ROLE_KEY: "",
          SUPABASE_URL: "",
          NEXT_PUBLIC_SUPABASE_URL: "",
        },
      })
      assert.ok(boot, "expected linked Supabase CLI fallback under vercel production env run")
      assert.equal(boot?.env_source, "supabase_cli_linked_project")
      assert.ok(boot?.url.startsWith("https://"))
      assert.ok(boot?.jwt.startsWith("eyJ"))
    },
  )
}

function testExplicitFailureWhenAllSourcesUnavailable(): void {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: '""',
      NEXT_PUBLIC_SUPABASE_URL: "",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: undefined,
    },
    () => {
      const boot = bootstrapVerifiedChannelsCertEnv({
        sources: [],
        inheritProcessEnvProviderKeys: false,
        protectedSnapshot: {
          SUPABASE_SERVICE_ROLE_KEY: '""',
        },
      })
      assert.equal(boot, null)
    },
  )

  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
    },
    () => {
      const resolution = resolveSupabaseCredentialsFromCliLinkedProject({
        resolveProjectRef: () => null,
        fetchServiceRoleKey: () => buildTestServiceRoleJwt("missing"),
      })
      assert.equal(resolution, null)
    },
  )
}

function testNotificationBootstrapProcessEnvUnchanged(): void {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: buildTestServiceRoleJwt("notifyref"),
      NEXT_PUBLIC_SUPABASE_URL: "https://notifyref.supabase.co",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: undefined,
    },
    () => {
      const boot = bootstrapGrowthOperatorNotificationsCertEnv()
      assert.ok(boot)
      assert.equal(boot?.env_source, "process_env")
      assert.equal(boot?.url, "https://notifyref.supabase.co")
    },
  )
}

async function testGs3BootstrapEntryPoint(): Promise<void> {
  withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_URL: "",
      EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN: "1",
      VERCEL_ENV: "production",
    },
    async () => {
      const boot = bootstrapVerifiedChannelsCertEnv({
        sources: [
          ".env.vercel.production",
          ".vercel/.env.production.local",
          ".env.production.local",
          ".env.local.rebuild",
        ],
        inheritProcessEnvProviderKeys: true,
        protectedSnapshot: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
          SUPABASE_URL: process.env.SUPABASE_URL ?? "",
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
        },
      })
      assert.ok(boot, "GS-3 bootstrap must not return supabase_unavailable")

      const { executeKnowledgeCenterFoundationCertification } = await import(
        "../lib/growth/knowledge-center/knowledge-certification"
      )
      const { createClient } = await import("@supabase/supabase-js")
      const admin = createClient(boot!.url, boot!.jwt, { auth: { persistSession: false } })
      const dryRun = await executeKnowledgeCenterFoundationCertification(admin, { dry_run: true })
      assert.equal(dryRun.ok, true)
      assert.equal(dryRun.final_verdict, "PASS")
      assert.equal(dryRun.dry_run, true)
    },
  )
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Verified channels Supabase bootstrap fix`)
  console.log(`QA marker: ${GROWTH_PRODUCTION_SUPABASE_CREDENTIAL_RESOLUTION_QA_MARKER}`)

  testBlankValuesRejected()
  console.log("  ✓ blank Supabase values rejected")

  testProcessEnvCredentialPrecedence()
  console.log("  ✓ valid process env credentials still win")

  testCliFallbackHelper()
  console.log("  ✓ CLI fallback helper resolves linked project credentials")

  testVerifiedChannelsCliFallbackIntegration()
  console.log("  ✓ verified-channels bootstrap uses CLI fallback under vercel production env run")

  testExplicitFailureWhenAllSourcesUnavailable()
  console.log("  ✓ explicit null when all sources unavailable")

  testNotificationBootstrapProcessEnvUnchanged()
  console.log("  ✓ notification bootstrap behavior unchanged for process env")

  await testGs3BootstrapEntryPoint()
  console.log("  ✓ GS-3 certification entry point reachable (dry_run)")

  console.log(`\n[${PHASE}] PASS\n`)
}

main().catch((error) => {
  console.error(`[${PHASE}] FAIL`, error instanceof Error ? error.message : error)
  process.exit(1)
})
