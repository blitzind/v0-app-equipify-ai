/**
 * GE-DATAMOON-1A — Datamoon lead-source provider foundation certification.
 * Run: pnpm test:growth-datamoon-lead-source-provider-ge-datamoon-1a
 */
import assert from "node:assert/strict"

export const GROWTH_DATAMOON_LEAD_SOURCE_PROVIDER_GE_DATAMOON_1A_QA_MARKER =
  "growth-datamoon-lead-source-provider-ge-datamoon-1a-v1" as const

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const keys = new Set([...Object.keys(env), ...Object.keys(process.env)])
  const prior = new Map<string, string | undefined>()
  for (const key of keys) {
    prior.set(key, process.env[key])
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of prior.entries()) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

type CapturedRequest = {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

function createMockFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: CapturedRequest[] = []
  let index = 0

  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    const response = responses[index] ?? responses[responses.length - 1]
    index += 1

    const headers = new Headers(init?.headers)
    const capturedHeaders: Record<string, string> = {}
    headers.forEach((value, key) => {
      capturedHeaders[key.toLowerCase()] = value
    })

    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      headers: capturedHeaders,
      body: typeof init?.body === "string" ? init.body : undefined,
    })

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  return { fetchImpl, calls }
}

async function main() {
  const [config, diagnostics, client, http] = await Promise.all([
    import("../lib/growth/providers/datamoon/datamoon-config"),
    import("../lib/growth/providers/datamoon/datamoon-provider-diagnostics"),
    import("../lib/growth/providers/datamoon/datamoon-client"),
    import("../lib/growth/providers/datamoon/datamoon-http"),
  ])

  const checks: string[] = []

  // Disabled provider defaults
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: undefined,
      DATAMOON_DRY_RUN_ONLY: undefined,
      DATAMOON_ENRICHMENT_API_KEY: undefined,
      DATAMOON_AUDIENCE_EXT_API_KEY: undefined,
      DATAMOON_AUDIENCE_MODULE_API_KEY: undefined,
    },
    async () => {
      assert.equal(config.isDatamoonProviderEnabled(), false)
      assert.equal(config.isDatamoonDryRunOnly(), true)
      assert.equal(config.isDatamoonProviderConfigured(), false)

      const diag = diagnostics.diagnoseDatamoonProvider(process.env)
      assert.equal(diag.enabled, false)
      assert.equal(diag.dryRunOnly, true)
      assert.equal(diag.configured, false)
      assert.deepEqual(diag.availableCapabilities, [])

      const build = await client.buildAudience(
        { type: "advanced_search", filters: [] },
        { env: process.env },
      )
      assert.equal(build.status, "skipped")
      assert.equal(build.error_category, "disabled")

      checks.push("disabled_provider_defaults")
    },
  )

  // Missing keys when live mode requested
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_DEFAULT_MODE: "ext",
      DATAMOON_ENRICHMENT_API_KEY: undefined,
      DATAMOON_AUDIENCE_EXT_API_KEY: undefined,
    },
    async () => {
      assert.equal(config.isDatamoonProviderConfigured(), false)
      const diag = diagnostics.diagnoseDatamoonProvider(process.env)
      assert.equal(diag.configured, false)
      assert.deepEqual(diag.availableCapabilities, [])

      const build = await client.buildAudience(
        { type: "advanced_search", filters: [] },
        { env: process.env },
      )
      assert.equal(build.status, "skipped")
      assert.equal(build.error_category, "missing_key")

      const enrich = await client.enrichByEmail({ email: "test@example.com" }, { env: process.env })
      assert.equal(enrich.status, "skipped")
      assert.equal(enrich.error_category, "missing_key")

      checks.push("missing_keys_live_mode")
    },
  )

  // Dry-run response without network
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: undefined,
      DATAMOON_DEFAULT_MODE: "module",
    },
    async () => {
      const { fetchImpl, calls } = createMockFetch([{ status: 200, body: {} }])

      const build = await client.buildAudience(
        {
          type: "b2b",
          filters: [{ field: "company_name", operator: "contains", value: "Acme" }],
          topic_ids: ["topic-1"],
        },
        { env: process.env, fetchImpl },
      )
      assert.equal(build.status, "dry_run")
      assert.equal(build.dry_run, true)
      assert.equal(build.audience_mode, "module")
      assert.equal(calls.length, 0)

      const fetchResult = await client.fetchAudience("aud-123", { env: process.env, fetchImpl })
      assert.equal(fetchResult.status, "dry_run")
      assert.equal(calls.length, 0)

      const enrich = await client.enrichByEmail({ email: "test@example.com" }, { env: process.env, fetchImpl })
      assert.equal(enrich.status, "dry_run")
      assert.equal(calls.length, 0)

      checks.push("dry_run_no_network")
    },
  )

  // Auth header/body placement
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_DEFAULT_MODE: "ext",
      DATAMOON_AUDIENCE_EXT_API_KEY: "audience-ext-key",
      DATAMOON_ENRICHMENT_API_KEY: "enrichment-key",
    },
    async () => {
      const { fetchImpl, calls } = createMockFetch([
        { status: 200, body: { id: "aud-1", status: "in_progress" } },
        { status: 200, body: { id: "aud-1", status: "completed", records: [] } },
        { status: 200, body: { matched: true } },
        { status: 200, body: { matched: true } },
      ])

      const build = await client.buildAudience(
        { type: "advanced_search", filters: [{ field: "job_title", operator: "=", value: "CEO" }] },
        { env: process.env, fetchImpl },
      )
      assert.equal(build.status, "success")
      assert.equal(calls.length, 1)
      assert.match(calls[0].url, /\/api\/v2\/ext\/audiences\/build$/)
      assert.equal(calls[0].headers["x-api-key"], "audience-ext-key")
      assert.ok(!calls[0].body?.includes("api_key"))

      await client.fetchAudience("aud-1", { env: process.env, fetchImpl })
      assert.equal(calls[1].headers["x-api-key"], "audience-ext-key")
      assert.match(calls[1].url, /\/audiences\/fetch\/aud-1$/)

      await client.enrichByEmail({ email: "test@example.com" }, { env: process.env, fetchImpl })
      assert.match(calls[2].url, /\/GetDataByEmail$/)
      assert.equal(calls[2].headers["x-api-key"], undefined)
      const enrichBody = JSON.parse(calls[2].body ?? "{}") as Record<string, string>
      assert.equal(enrichBody.api_key, "enrichment-key")
      assert.equal(enrichBody.email, "test@example.com")

      await client.enrichByPhone({ phone: "5551234567" }, { env: process.env, fetchImpl })
      const phoneBody = JSON.parse(calls[3].body ?? "{}") as Record<string, string>
      assert.equal(phoneBody.api_key, "enrichment-key")
      assert.equal(phoneBody.phone, "5551234567")

      checks.push("auth_header_body_placement")
    },
  )

  // Audience build body uses record_limit only (GE-DATAMOON-API-BODY-FIX-1)
  for (const mode of ["ext", "module"] as const) {
    const envKey =
      mode === "module" ? "DATAMOON_AUDIENCE_MODULE_API_KEY" : "DATAMOON_AUDIENCE_EXT_API_KEY"
    await withEnv(
      {
        DATAMOON_PROVIDER_ENABLED: "true",
        DATAMOON_DRY_RUN_ONLY: "false",
        DATAMOON_DEFAULT_MODE: mode,
        [envKey]: `${mode}-audience-key`,
      },
      async () => {
        const { fetchImpl, calls } = createMockFetch([
          { status: 200, body: { id: "aud-body-check", status: "in_progress" } },
        ])

        const build = await client.buildAudience(
          {
            type: "advanced_search",
            filters: [{ field: "job_title", operator: "contains", value: "CEO" }],
            limit: 25,
          },
          { env: process.env, fetchImpl, audienceMode: mode },
        )
        assert.equal(build.status, "success")
        assert.equal(calls.length, 1)
        assert.match(
          calls[0].url,
          mode === "module" ? /\/api\/v2\/m\/audiences\/build$/ : /\/api\/v2\/ext\/audiences\/build$/,
        )

        const body = JSON.parse(calls[0].body ?? "{}") as Record<string, unknown>
        assert.equal(body.record_limit, 25)
        assert.equal("limit" in body, false)
      },
    )
  }
  checks.push("audience_build_record_limit_body_ext_module")

  // 422 validation handling
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "false",
      DATAMOON_AUDIENCE_EXT_API_KEY: "audience-ext-key",
    },
    async () => {
      const { fetchImpl } = createMockFetch([
        {
          status: 422,
          body: {
            message: "Validation failed",
            errors: {
              "filters.0.operator": ["The operator 'like' is not valid for field 'job_title'."],
            },
            allowed_fields: ["first_name", "last_name", "personal_emails"],
          },
        },
      ])

      const build = await client.buildAudience(
        { type: "advanced_search", filters: [{ field: "job_title", operator: "like", value: "CEO" }] },
        { env: process.env, fetchImpl },
      )
      assert.equal(build.status, "failed")
      assert.equal(build.error_category, "validation")
      assert.equal(build.http_status, 422)
      assert.ok(build.validation_errors?.["filters.0.operator"]?.[0]?.includes("operator"))
      assert.deepEqual(build.allowed_fields, ["first_name", "last_name", "personal_emails"])

      const classified = http.classifyDatamoonHttpStatus(422)
      assert.equal(classified, "validation")

      checks.push("validation_422_handling")
    },
  )

  // Diagnostics capabilities
  await withEnv(
    {
      DATAMOON_PROVIDER_ENABLED: "true",
      DATAMOON_DRY_RUN_ONLY: "true",
      DATAMOON_DEFAULT_MODE: "ext",
      DATAMOON_AUDIENCE_EXT_API_KEY: "ext-key",
      DATAMOON_ENRICHMENT_API_KEY: "enrich-key",
    },
    async () => {
      const diag = diagnostics.diagnoseDatamoonProvider(process.env)
      assert.equal(diag.configured, true)
      assert.equal(diag.enabled, true)
      assert.equal(diag.dryRunOnly, true)
      assert.equal(diag.audienceMode, "ext")
      assert.deepEqual(diag.availableCapabilities, [
        "audience_build",
        "audience_poll",
        "enrichment_email",
        "enrichment_phone",
      ])
      checks.push("diagnostics_capabilities")
    },
  )

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_DATAMOON_LEAD_SOURCE_PROVIDER_GE_DATAMOON_1A_QA_MARKER,
        checks,
        status: "pass",
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
