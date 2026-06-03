/**
 * Regression checks for Growth Engine cron authentication.
 * Run: pnpm test:growth-cron-auth
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  buildGrowthCronAuthFailureLog,
  describeConfiguredGrowthCronSecret,
  diagnoseGrowthCronAuth,
  extractGrowthCronBearerToken,
  hashGrowthCronAuthTokenPrefix,
  verifyGrowthCronRequest,
} from "../lib/growth/runtime/growth-cron-auth"

const TEST_SECRET = "growth-cron-auth-test-secret"

function cronRequest(headers?: HeadersInit): Request {
  return new Request("http://localhost/api/cron/growth-sequence-safe-execute", {
    method: "GET",
    headers,
  })
}

function withSecret(secret: string, fn: () => void): void {
  const previous = process.env.CRON_SECRET
  process.env.CRON_SECRET = secret
  try {
    fn()
  } finally {
    if (previous) process.env.CRON_SECRET = previous
    else delete process.env.CRON_SECRET
  }
}

function testBearerExtraction(): void {
  assert.equal(extractGrowthCronBearerToken(null), null)
  assert.equal(extractGrowthCronBearerToken("Basic abc"), null)
  assert.equal(extractGrowthCronBearerToken(`Bearer ${TEST_SECRET}`), TEST_SECRET)
  assert.equal(extractGrowthCronBearerToken(`bearer ${TEST_SECRET}`), TEST_SECRET)
  assert.equal(extractGrowthCronBearerToken(`Bearer  ${TEST_SECRET}`), TEST_SECRET)
  assert.equal(extractGrowthCronBearerToken(`Bearer ${TEST_SECRET}  `), TEST_SECRET)
  assert.equal(extractGrowthCronBearerToken(`Bearer ${TEST_SECRET}\n`), TEST_SECRET)
}

function testLegacyStrictComparisonWouldFail(): void {
  withSecret(`${TEST_SECRET}\n`, () => {
    const authHeader = `Bearer ${TEST_SECRET}\n`
    const trimmedSecret = process.env.CRON_SECRET?.trim() ?? ""
    assert.notEqual(authHeader, `Bearer ${trimmedSecret}`, "legacy full-string compare should fail")

    const diagnostics = diagnoseGrowthCronAuth(
      cronRequest({ Authorization: authHeader }),
    )
    assert.equal(diagnostics.failureReason, null)
    assert.equal(diagnostics.authBranch, "bearer")
  })
}

function testAuthorizationVariants(): void {
  withSecret(TEST_SECRET, () => {
    for (const authorization of [
      `Bearer ${TEST_SECRET}`,
      `bearer ${TEST_SECRET}`,
      `Bearer  ${TEST_SECRET}`,
      `Bearer ${TEST_SECRET}\n`,
    ]) {
      const diagnostics = diagnoseGrowthCronAuth(cronRequest({ Authorization: authorization }))
      assert.equal(diagnostics.failureReason, null, `expected bearer auth for ${JSON.stringify(authorization)}`)
      assert.equal(diagnostics.authBranch, "bearer")
    }
  })
}

function testXCronSecretHeader(): void {
  withSecret(TEST_SECRET, () => {
    const diagnostics = diagnoseGrowthCronAuth(
      cronRequest({ "x-cron-secret": ` ${TEST_SECRET} ` }),
    )
    assert.equal(diagnostics.failureReason, null)
    assert.equal(diagnostics.authBranch, "x-cron-secret")
  })
}

function testEnvSecretTrimming(): void {
  withSecret(`  ${TEST_SECRET}  `, () => {
    const diagnostics = diagnoseGrowthCronAuth(
      cronRequest({ Authorization: `Bearer ${TEST_SECRET}` }),
    )
    assert.equal(diagnostics.failureReason, null)
    assert.equal(diagnostics.authBranch, "bearer")
  })
}

function testUnauthorizedDiagnostics(): void {
  withSecret(TEST_SECRET, () => {
    const missing = diagnoseGrowthCronAuth(cronRequest())
    assert.equal(missing.failureReason, "authorization_missing")
    assert.equal(missing.cronSecretConfigured, true)
    assert.equal(missing.authorizationHeaderPresent, false)
    assert.equal(missing.xCronSecretHeaderPresent, false)

    const mismatch = diagnoseGrowthCronAuth(
      cronRequest({ Authorization: "Bearer wrong-secret" }),
    )
    assert.equal(mismatch.failureReason, "token_mismatch")
    assert.equal(mismatch.authorizationHeaderPresent, true)
    assert.equal(mismatch.authBranch, null)
  })
}

function testDescribeConfiguredGrowthCronSecret(): void {
  const previous = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  try {
    assert.deepEqual(describeConfiguredGrowthCronSecret(), {
      configured: false,
      length: 0,
      hashPrefix: "",
    })
  } finally {
    if (previous) process.env.CRON_SECRET = previous
  }

  withSecret(TEST_SECRET, () => {
    const described = describeConfiguredGrowthCronSecret()
    assert.equal(described.configured, true)
    assert.equal(described.length, TEST_SECRET.length)
    assert.equal(described.hashPrefix, hashGrowthCronAuthTokenPrefix(TEST_SECRET))
    assert.equal(
      described.hashPrefix,
      createHash("sha256").update(TEST_SECRET, "utf8").digest("hex").slice(0, 8),
    )
  })
}

function testFailureLogHashDiagnostics(): void {
  withSecret(TEST_SECRET, () => {
    const mismatchLog = buildGrowthCronAuthFailureLog(
      cronRequest({ Authorization: "Bearer wrong-secret" }),
      diagnoseGrowthCronAuth(cronRequest({ Authorization: "Bearer wrong-secret" })),
      "/api/cron/growth-sequence-safe-execute",
    )
    assert.ok(mismatchLog)
    assert.equal(mismatchLog.envSecretLength, TEST_SECRET.length)
    assert.equal(
      mismatchLog.envSecretHashPrefix,
      createHash("sha256").update(TEST_SECRET, "utf8").digest("hex").slice(0, 8),
    )
    assert.equal(mismatchLog.incomingTokenLength, "wrong-secret".length)
    assert.equal(
      mismatchLog.incomingTokenHashPrefix,
      createHash("sha256").update("wrong-secret", "utf8").digest("hex").slice(0, 8),
    )
    assert.notEqual(mismatchLog.envSecretHashPrefix, mismatchLog.incomingTokenHashPrefix)
    assert.equal(mismatchLog.failureReason, "token_mismatch")
    assert.equal(mismatchLog.cronRoute, "/api/cron/growth-sequence-safe-execute")

    const matchingPrefix = hashGrowthCronAuthTokenPrefix(TEST_SECRET)
    const successDiagnostics = diagnoseGrowthCronAuth(
      cronRequest({ Authorization: `Bearer ${TEST_SECRET}` }),
    )
    assert.equal(buildGrowthCronAuthFailureLog(cronRequest(), successDiagnostics), null)
    assert.equal(
      hashGrowthCronAuthTokenPrefix(` ${TEST_SECRET} `.trim()),
      matchingPrefix,
    )
  })
}

function testMissingConfiguredSecret(): void {
  const previous = process.env.CRON_SECRET
  delete process.env.CRON_SECRET
  try {
    const diagnostics = diagnoseGrowthCronAuth(cronRequest({ Authorization: "Bearer anything" }))
    assert.equal(diagnostics.failureReason, "cron_secret_not_configured")
    assert.equal(diagnostics.cronSecretConfigured, false)

    const response = verifyGrowthCronRequest(cronRequest(), "/api/cron/example")
    assert.ok(response)
    assert.equal(response.status, 503)
  } finally {
    if (previous) process.env.CRON_SECRET = previous
  }
}

function testVerifyGrowthCronRequestResponses(): void {
  withSecret(TEST_SECRET, () => {
    const ok = verifyGrowthCronRequest(
      cronRequest({ Authorization: `Bearer ${TEST_SECRET}` }),
      "/api/cron/growth-sequence-safe-execute",
    )
    assert.equal(ok, null)

    const unauthorized = verifyGrowthCronRequest(cronRequest(), "/api/cron/growth-sequence-safe-execute")
    assert.ok(unauthorized)
    assert.equal(unauthorized.status, 401)
  })
}

function main(): void {
  testBearerExtraction()
  testLegacyStrictComparisonWouldFail()
  testAuthorizationVariants()
  testXCronSecretHeader()
  testEnvSecretTrimming()
  testDescribeConfiguredGrowthCronSecret()
  testFailureLogHashDiagnostics()
  testUnauthorizedDiagnostics()
  testMissingConfiguredSecret()
  testVerifyGrowthCronRequestResponses()
  console.log("growth cron auth tests passed")
}

main()
