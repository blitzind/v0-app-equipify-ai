/**
 * Apollo search query audit route structure checks.
 * Run: pnpm test:apollo-search-query-audit-route
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM,
  APOLLO_SEARCH_QUERY_AUDIT_ROUTE_QA_MARKER,
  assertApolloSearchQueryAuditExecuteAllowed,
  buildApolloSearchQueryAuditReadinessPayload,
  validateApolloSearchQueryAuditConfirmation,
} from "../lib/growth/apollo/apollo-search-query-audit-route-gates"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function testGatesBlockWithoutAck(): void {
  const env = {
    VERCEL_ENV: "production",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "test-key",
  } as NodeJS.ProcessEnv
  const gates = assertApolloSearchQueryAuditExecuteAllowed(env)
  assert(!gates.ok, "expected gates blocked without audit ack")
  assert(gates.blockers.some((row) => row.includes("GROWTH_APOLLO_SEARCH_QUERY_AUDIT_ACK")), "audit ack blocker")
}

function testConfirmationToken(): void {
  const valid = validateApolloSearchQueryAuditConfirmation({
    confirm: APOLLO_SEARCH_QUERY_AUDIT_EXECUTE_CONFIRM,
  })
  assert(valid.ok, "expected valid confirmation")
  const invalid = validateApolloSearchQueryAuditConfirmation({ confirm: "NOPE" })
  assert(!invalid.ok, "expected invalid confirmation")
}

function testReadinessPayload(): void {
  const payload = buildApolloSearchQueryAuditReadinessPayload({
    env: {
      VERCEL_ENV: "production",
      GROWTH_APOLLO_SEARCH_QUERY_AUDIT_ACK: "1",
      GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
      GROWTH_APOLLO_USE_MOCK: "false",
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      APOLLO_API_KEY: "test-key",
    } as NodeJS.ProcessEnv,
    resolved_companies: [
      { company_name: "Medical Equipment Solutions", domain: "example.com" },
      { company_name: "A to Z Medical Equipment & Supplies LLC", domain: "example.com" },
      { company_name: "Next Level DME", domain: "example.com" },
      { company_name: "OMI MedTech", domain: "example.com" },
      { company_name: "MedTech AZ", domain: "example.com" },
    ],
  })
  assert(payload.qa_marker === APOLLO_SEARCH_QUERY_AUDIT_ROUTE_QA_MARKER, "qa marker")
  assert(payload.target_companies.length === 5, "five target companies")
}

function testRoutesExist(): void {
  const readiness = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-search-query-audit/readiness/route.ts"),
    "utf8",
  )
  const execute = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-search-query-audit/execute/route.ts"),
    "utf8",
  )
  assert(readiness.includes("buildApolloSearchQueryAuditProductionReadiness"), "readiness route wired")
  assert(execute.includes("executeApolloSearchQueryAuditInProduction"), "execute route wired")
  assert(execute.includes("auto_enrollment: false"), "safety log present")
}

function main(): void {
  testGatesBlockWithoutAck()
  console.log("  ✓ audit ack gate")
  testConfirmationToken()
  console.log("  ✓ confirmation token")
  testReadinessPayload()
  console.log("  ✓ readiness payload")
  testRoutesExist()
  console.log("  ✓ production routes wired")
  console.log("\nApollo search query audit route checks passed.")
}

main()
