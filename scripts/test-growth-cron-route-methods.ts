/**
 * Regression checks for Growth Engine cron route HTTP method support (Vercel GET invocations).
 * Run: pnpm test:growth-cron-route-methods
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import Module from "node:module"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import { verifyGrowthCronRequest } from "../lib/growth/runtime/growth-cron-auth"

const TEST_SECRET = "growth-cron-route-methods-test-secret"
const SAFE_EXECUTE_PATH = "/api/cron/growth-sequence-safe-execute"
const SCHEDULER_PATH = "/api/cron/growth-sequence-scheduler"

function cronRequest(routePath: string, method: string, headers?: HeadersInit): Request {
  return new Request(`http://localhost${routePath}`, { method, headers })
}

function readRouteSource(routeId: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), `app/api/cron/${routeId}/route.ts`),
    "utf8",
  )
}

function testAllGrowthCronRoutesExposeGet(): void {
  for (const routeId of GROWTH_CRON_ROUTE_IDS) {
    const source = readRouteSource(routeId)
    assert.match(source, /export async function GET/, `missing GET handler for ${routeId}`)
    assert.match(source, /export async function POST/, `missing POST handler for ${routeId}`)
    assert.match(
      source,
      /export async function GET[\s\S]*return POST\(request\)/,
      `GET must delegate to POST for ${routeId}`,
    )
  }
}

function testGrowthCronAuthSupportsGet(): void {
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = TEST_SECRET

  try {
    const unauthGet = verifyGrowthCronRequest(cronRequest(SAFE_EXECUTE_PATH, "GET"))
    assert.ok(unauthGet)
    assert.equal(unauthGet.status, 401)

    const bearerGet = verifyGrowthCronRequest(
      cronRequest(SAFE_EXECUTE_PATH, "GET", { Authorization: `Bearer ${TEST_SECRET}` }),
    )
    assert.equal(bearerGet, null)

    const headerGet = verifyGrowthCronRequest(
      cronRequest(SAFE_EXECUTE_PATH, "GET", { "x-cron-secret": TEST_SECRET }),
    )
    assert.equal(headerGet, null)
  } finally {
    if (previousSecret) process.env.CRON_SECRET = previousSecret
    else delete process.env.CRON_SECRET
  }
}

type RouteMocks = {
  restore: () => void
  cronJobCalls: Array<{ cronRoute: string; requestMethod: string }>
}

function installRouteMocks(options: { mockCronRunner: boolean }): RouteMocks {
  const cronJobCalls: Array<{ cronRoute: string; requestMethod: string }> = []
  const originalLoad = Module._load as typeof Module._load

  const mockAdmin = {
    schema: () => ({
      from: () => ({
        select: () => ({
          limit: async () => ({ error: { message: "mock_schema_unavailable" } }),
        }),
        insert: async () => ({ error: { message: "mock_schema_unavailable" } }),
      }),
    }),
  }

  Module._load = function patchedLoad(request, parent, isMain) {
    const resolved = String(request)
    if (resolved.includes("supabase/admin")) {
      return { createServiceRoleClient: () => mockAdmin }
    }
    if (options.mockCronRunner && resolved.includes("growth-cron-runner")) {
      return {
        runGrowthCronJob: async (ctx: { cronRoute: string; request: Request }) => {
          cronJobCalls.push({
            cronRoute: ctx.cronRoute,
            requestMethod: ctx.request.method,
          })
          return new Response(JSON.stringify({ ok: true, cron_route: ctx.cronRoute }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        },
      }
    }
    if (resolved.includes("sequence-job-runner")) {
      return {
        runApprovedDueSequenceExecutionJobs: async () => ({
          executed: 0,
          failed: 0,
          skipped: 0,
        }),
      }
    }
    if (resolved.includes("run-sequence-scheduler")) {
      return {
        runGrowthSequenceScheduler: async () => ({
          planned: 0,
          skippedSuppressed: 0,
          skippedAlreadyQueued: 0,
        }),
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  return {
    restore: () => {
      Module._load = originalLoad
    },
    cronJobCalls,
  }
}

async function testSafeExecuteRouteMethods(): Promise<void> {
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = TEST_SECRET
  const authHeaders = { Authorization: `Bearer ${TEST_SECRET}` }
  const mocks = installRouteMocks({ mockCronRunner: false })

  try {
    const route = await import("../app/api/cron/growth-sequence-safe-execute/route")

    const unauth = await route.GET(cronRequest(SAFE_EXECUTE_PATH, "GET"))
    assert.equal(unauth.status, 401)

    const getResp = await route.GET(cronRequest(SAFE_EXECUTE_PATH, "GET", authHeaders))
    assert.equal(getResp.status, 200)
    const getBody = (await getResp.json()) as { ok?: boolean; cron_route?: string }
    assert.equal(getBody.ok, true)
    assert.equal(getBody.cron_route, SAFE_EXECUTE_PATH)

    const postResp = await route.POST(cronRequest(SAFE_EXECUTE_PATH, "POST", authHeaders))
    assert.equal(postResp.status, 200)
    const postBody = (await postResp.json()) as { ok?: boolean; cron_route?: string }
    assert.equal(postBody.ok, true)
    assert.equal(postBody.cron_route, SAFE_EXECUTE_PATH)
  } finally {
    mocks.restore()
    if (previousSecret) process.env.CRON_SECRET = previousSecret
    else delete process.env.CRON_SECRET
  }
}

async function testSequenceSchedulerRouteMethods(): Promise<void> {
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = TEST_SECRET
  const authHeaders = { Authorization: `Bearer ${TEST_SECRET}` }
  const mocks = installRouteMocks({ mockCronRunner: true })

  try {
    const route = await import("../app/api/cron/growth-sequence-scheduler/route")

    const getResp = await route.GET(cronRequest(SCHEDULER_PATH, "GET", authHeaders))
    assert.equal(getResp.status, 200)
    assert.equal(mocks.cronJobCalls.length, 1)
    assert.equal(mocks.cronJobCalls[0]?.cronRoute, SCHEDULER_PATH)
    assert.equal(mocks.cronJobCalls[0]?.requestMethod, "GET")

    mocks.cronJobCalls.length = 0
    const postResp = await route.POST(cronRequest(SCHEDULER_PATH, "POST", authHeaders))
    assert.equal(postResp.status, 200)
    assert.equal(mocks.cronJobCalls.length, 1)
    assert.equal(mocks.cronJobCalls[0]?.cronRoute, SCHEDULER_PATH)
    assert.equal(mocks.cronJobCalls[0]?.requestMethod, "POST")
  } finally {
    mocks.restore()
    if (previousSecret) process.env.CRON_SECRET = previousSecret
    else delete process.env.CRON_SECRET
  }
}

async function main(): Promise<void> {
  testAllGrowthCronRoutesExposeGet()
  testGrowthCronAuthSupportsGet()
  await testSafeExecuteRouteMethods()
  await testSequenceSchedulerRouteMethods()
  console.log("growth cron route method tests passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
