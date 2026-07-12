/**
 * GE-AIOS-HOTFIX-LIVE-1C-5D — Cross-request cookie auth isolation.
 * Run: pnpm test:ge-aios-hotfix-live-1c-5d-cookie-auth-isolation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  resolveCookieSessionAuthSnapshot,
  type GrowthEngineCookieAuthUser,
  type GrowthEngineCookieGetUserResult,
} from "../lib/growth/growth-engine-cookie-session-auth"

export const GE_AIOS_HOTFIX_LIVE_1C_5D_QA_MARKER =
  "ge-aios-hotfix-live-1c-5d-cookie-auth-isolation-v1" as const

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function makeClient(label: string, user: GrowthEngineCookieAuthUser | null, delayMs: number) {
  let getUserCalls = 0
  return {
    label,
    get getUserCalls() {
      return getUserCalls
    },
    auth: {
      async getUser(): Promise<GrowthEngineCookieGetUserResult> {
        getUserCalls += 1
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return { data: { user }, error: null }
      },
    },
  }
}

/** Old contaminated pattern — must demonstrate cross-request leakage. */
async function resolveCookieSessionUserContaminated(
  cookieClient: { auth: { getUser: () => Promise<GrowthEngineCookieGetUserResult> } },
  inflightRef: { current: Promise<Awaited<ReturnType<typeof resolveCookieSessionAuthSnapshot>>> | null },
) {
  if (!inflightRef.current) {
    inflightRef.current = resolveCookieSessionAuthSnapshot({
      getUser: () => cookieClient.auth.getUser(),
      raceAuthOperation: async (operation) => operation,
    }).finally(() => {
      inflightRef.current = null
    })
  }
  return inflightRef.current
}

async function runConcurrentIsolation(): Promise<void> {
  const unauthenticated = makeClient("unauthenticated", null, 40)
  const authenticated = makeClient(
    "authenticated",
    { id: "user-b", email: "ops@equipify.ai" },
    40,
  )

  const [unauthResult, authResult] = await Promise.all([
    resolveCookieSessionAuthSnapshot({
      getUser: () => unauthenticated.auth.getUser(),
      raceAuthOperation: async (operation) => operation,
    }),
    resolveCookieSessionAuthSnapshot({
      getUser: () => authenticated.auth.getUser(),
      raceAuthOperation: async (operation) => operation,
    }),
  ])

  assert.equal(unauthenticated.getUserCalls, 1, "unauthenticated request must call getUser")
  assert.equal(authenticated.getUserCalls, 1, "authenticated request must call getUser")
  assert.equal(unauthResult.cookieUser, null)
  assert.deepEqual(authResult.cookieUser, { userId: "user-b", userEmail: "ops@equipify.ai" })
  assert.notEqual(unauthResult, authResult)
  console.log("  ✓ concurrent requests each execute getUser and keep isolated results")

  const reverseUnauth = makeClient("reverse-unauth", null, 40)
  const reverseAuth = makeClient("reverse-auth", { id: "user-a", email: "admin@equipify.ai" }, 40)
  const [authFirst, unauthSecond] = await Promise.all([
    resolveCookieSessionAuthSnapshot({
      getUser: () => reverseAuth.auth.getUser(),
      raceAuthOperation: async (operation) => operation,
    }),
    resolveCookieSessionAuthSnapshot({
      getUser: () => reverseUnauth.auth.getUser(),
      raceAuthOperation: async (operation) => operation,
    }),
  ])
  assert.deepEqual(authFirst.cookieUser, { userId: "user-a", userEmail: "admin@equipify.ai" })
  assert.equal(unauthSecond.cookieUser, null)
  assert.equal(reverseAuth.getUserCalls, 1)
  assert.equal(reverseUnauth.getUserCalls, 1)
  console.log("  ✓ authenticated request cannot leak into concurrent unauthenticated request")
}

async function runContaminatedPatternFails(): Promise<void> {
  const inflightRef: {
    current: Promise<Awaited<ReturnType<typeof resolveCookieSessionAuthSnapshot>>> | null
  } = { current: null }

  const requestA = makeClient("A-unauth", null, 40)
  const requestB = makeClient("B-auth", { id: "user-b", email: "ops@equipify.ai" }, 40)

  const [resultA, resultB] = await Promise.all([
    resolveCookieSessionUserContaminated(requestA, inflightRef),
    resolveCookieSessionUserContaminated(requestB, inflightRef),
  ])

  assert.equal(requestA.getUserCalls, 1)
  assert.equal(requestB.getUserCalls, 0, "old singleton must skip Request B getUser")
  assert.equal(resultA, resultB)
  assert.equal(resultB.cookieUser, null, "old singleton contaminates authenticated Request B")
  console.log("  ✓ old module-scoped inflight pattern still demonstrates contamination (negative control)")
}

function runSourceGuards(): void {
  const sessionSource = readSource("lib/growth/growth-engine-session.ts")
  const helperSource = readSource("lib/growth/growth-engine-cookie-session-auth.ts")
  const accessSource = readSource("lib/growth/rbac/growth-access-resolution.ts")

  assert.doesNotMatch(
    sessionSource,
    /let inflightCookieSessionAuth/,
    "module-scoped inflightCookieSessionAuth must be removed",
  )
  assert.doesNotMatch(sessionSource, /inflightCookieSessionAuth/)
  assert.match(sessionSource, /resolveCookieSessionAuthSnapshot/)
  assert.match(sessionSource, /cookieClient\.auth\.getUser\(\)/)
  assert.match(helperSource, /Each invocation must call getUser/)
  assert.match(accessSource, /cookie_auth_timeout/)
  assert.match(accessSource, /deployment_id/)
  assert.match(accessSource, /auth_attempted/)
  assert.doesNotMatch(accessSource, /cookie_value|access_token|refresh_token|Authorization/)
  console.log("  ✓ source guards: no module auth singleton; sanitized unauthenticated diagnostics retained")
}

async function main(): Promise<void> {
  console.log(`[${GE_AIOS_HOTFIX_LIVE_1C_5D_QA_MARKER}] cookie auth isolation certification`)
  runSourceGuards()
  await runContaminatedPatternFails()
  await runConcurrentIsolation()
  console.log(`[${GE_AIOS_HOTFIX_LIVE_1C_5D_QA_MARKER}] PASS`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
