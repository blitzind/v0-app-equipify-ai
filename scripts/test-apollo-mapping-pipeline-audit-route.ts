/**
 * Apollo mapping pipeline audit route structure checks.
 * Run: pnpm test:apollo-mapping-pipeline-audit-route
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM,
  APOLLO_MAPPING_PIPELINE_AUDIT_ROUTE_QA_MARKER,
  assertApolloMappingPipelineAuditExecuteAllowed,
  buildApolloMappingPipelineAuditReadinessPayload,
  validateApolloMappingPipelineAuditConfirmation,
} from "../lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route-gates"

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function testGatesFileExists(): void {
  const gatesPath = resolve(
    process.cwd(),
    "lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route-gates.ts",
  )
  const routePath = resolve(
    process.cwd(),
    "lib/growth/apollo/apollo-mapped-contact-pipeline-audit-route.ts",
  )
  assert(existsSync(gatesPath), "gates module file must exist")
  assert(existsSync(routePath), "route orchestration file must exist")
}

function testGatesBlockWithoutAck(): void {
  const env = {
    VERCEL_ENV: "production",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "test-key",
  } as NodeJS.ProcessEnv
  const gates = assertApolloMappingPipelineAuditExecuteAllowed(env)
  assert(!gates.ok, "expected gates blocked without audit ack")
  assert(
    gates.blockers.some((row) => row.includes("GROWTH_APOLLO_MAPPING_PIPELINE_AUDIT_ACK")),
    "mapping pipeline audit ack blocker",
  )
}

function testGatesPassWithAck(): void {
  const gates = assertApolloMappingPipelineAuditExecuteAllowed({
    VERCEL_ENV: "production",
    GROWTH_APOLLO_MAPPING_PIPELINE_AUDIT_ACK: "1",
    GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
    GROWTH_APOLLO_USE_MOCK: "false",
    GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
    APOLLO_API_KEY: "test-key",
  } as NodeJS.ProcessEnv)
  assert(gates.ok, "expected gates open with production acks and Apollo configured")
}

function testConfirmationToken(): void {
  const valid = validateApolloMappingPipelineAuditConfirmation({
    confirm: APOLLO_MAPPING_PIPELINE_AUDIT_EXECUTE_CONFIRM,
  })
  assert(valid.ok, "expected valid confirmation")
  const invalid = validateApolloMappingPipelineAuditConfirmation({ confirm: "NOPE" })
  assert(!invalid.ok, "expected invalid confirmation")
}

function testReadinessPayload(): void {
  const payload = buildApolloMappingPipelineAuditReadinessPayload({
    env: {
      VERCEL_ENV: "production",
      GROWTH_APOLLO_MAPPING_PIPELINE_AUDIT_ACK: "1",
      GROWTH_APOLLO_LIVE_BENCHMARK_ACK: "1",
      GROWTH_APOLLO_USE_MOCK: "false",
      GROWTH_CONTACT_DISCOVERY_APOLLO_ENABLED: "true",
      APOLLO_API_KEY: "test-key",
    } as NodeJS.ProcessEnv,
  })
  assert(payload.qa_marker === APOLLO_MAPPING_PIPELINE_AUDIT_ROUTE_QA_MARKER, "qa marker")
  assert(payload.ready, "expected ready payload")
  assert(payload.target_company.domain === "medicalequipmentsolutions.com", "target domain")
}

function testRoutesImportGatesModule(): void {
  const readiness = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-mapping-pipeline-audit/readiness/route.ts"),
    "utf8",
  )
  const execute = readFileSync(
    resolve(process.cwd(), "app/api/platform/growth/apollo-mapping-pipeline-audit/execute/route.ts"),
    "utf8",
  )
  assert(
    readiness.includes("apollo-mapped-contact-pipeline-audit-route"),
    "readiness route imports orchestration module",
  )
  assert(
    execute.includes("apollo-mapped-contact-pipeline-audit-route-gates"),
    "execute route imports gates module",
  )
  assert(execute.includes("auto_enrollment: false"), "safety log present")
}

function main(): void {
  testGatesFileExists()
  console.log("  ✓ gates and route modules present on disk")
  testGatesBlockWithoutAck()
  console.log("  ✓ mapping pipeline audit ack gate")
  testGatesPassWithAck()
  console.log("  ✓ production gates with ack")
  testConfirmationToken()
  console.log("  ✓ confirmation token")
  testReadinessPayload()
  console.log("  ✓ readiness payload")
  testRoutesImportGatesModule()
  console.log("  ✓ production routes wired")
  console.log("\nApollo mapping pipeline audit route checks passed.")
}

main()
