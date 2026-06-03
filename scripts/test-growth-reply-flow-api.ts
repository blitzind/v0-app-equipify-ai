/**
 * Regression checks for Growth reply-flow QA API route.
 * Run: pnpm test:growth-reply-flow-api
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_REPLY_FLOW_API_QA_MARKER,
  growthReplyFlowApiRequestSchema,
  parseGrowthReplyFlowApiRequest,
  sanitizeGrowthReplyFlowApiErrorMessage,
} from "../lib/growth/qa/reply-flow-api-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_REPLY_FLOW_API_QA_MARKER, "growth-reply-flow-api-v1")

const routeSource = readSource("app/api/platform/growth/qa/reply-flow/route.ts")
assert.match(routeSource, /requireGrowthQaAccelerationAccess/)
assert.match(routeSource, /runGrowthReplyFlowHarness/)
assert.match(routeSource, /parseGrowthReplyFlowApiRequest/)
assert.match(routeSource, /sanitizeGrowthReplyFlowApiErrorMessage/)
assert.match(routeSource, /access\.admin/)
assert.match(routeSource, /access\.userId/)
assert.match(routeSource, /access\.userEmail/)
assert.match(routeSource, /export const runtime = "nodejs"/)
assert.doesNotMatch(routeSource, /error\.stack/)
assert.doesNotMatch(routeSource, /createServiceRoleClient/)

const parsed = parseGrowthReplyFlowApiRequest({
  fresh: true,
  contactEmail: "mike@fuzor.io",
  step: "all",
  pattern: "email_then_call",
})
assert.equal(parsed.fresh, true)
assert.equal(parsed.contactEmail, "mike@fuzor.io")
assert.equal(parsed.step, "all")
assert.equal(parsed.pattern, "email_then_call")

assert.throws(() => parseGrowthReplyFlowApiRequest({ step: "invalid" }))
assert.throws(() => parseGrowthReplyFlowApiRequest({ contactEmail: "not-an-email" }))
assert.throws(() => parseGrowthReplyFlowApiRequest({ fresh: true, unknown: true }))

const strictKeys = Object.keys(growthReplyFlowApiRequestSchema.shape)
assert.ok(strictKeys.includes("pattern"))
assert.ok(strictKeys.includes("skipExecute"))

const sanitized = sanitizeGrowthReplyFlowApiErrorMessage(
  new Error("Enrollment failed: token eyJhbGciOiJIUzI1NiJ9.x.y at lib/foo.ts:12:34"),
)
assert.doesNotMatch(sanitized, /eyJ/)
assert.doesNotMatch(sanitized, /foo\.ts:12/)
assert.match(sanitized, /Enrollment failed/)

const packageJson = readSource("package.json")
assert.match(packageJson, /"test:growth-reply-flow-api"/)

console.log("growth reply flow api tests passed")
