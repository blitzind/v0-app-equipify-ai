/**
 * FUZOR-PRODUCTION-CERTIFICATION-1A — Integrated platform validation.
 * Run: pnpm test:fuzor-production-certification-1a-integrated-platform
 * Production: pnpm test:fuzor-production-certification-1a-integrated-platform:production
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import {
  executeFuzorIntegratedPlatformCertification,
  FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE,
  FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER,
} from "../lib/growth/qa/fuzor-integrated-platform-certification-1a"

const ROOT = process.cwd()
const production = process.argv.includes("--production")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const PLATFORM_WRAPPER_FILES = [
  "lib/growth/aios/ai-event-types.ts",
  "lib/growth/aios/ai-event-registry.ts",
  "lib/growth/aios/ai-event-repository.ts",
  "lib/growth/aios/ai-event-service.ts",
  "lib/growth/aios/ai-event-subscriber-registry.ts",
  "lib/growth/aios/ai-event-schema-health.ts",
  "lib/growth/aios/ai-decision-record-types.ts",
  "lib/growth/aios/ai-decision-record-registry.ts",
  "lib/growth/aios/ai-decision-record-repository.ts",
  "lib/growth/aios/ai-decision-record-service.ts",
  "lib/growth/aios/ai-decision-record-schema-health.ts",
  "lib/growth/aios/ai-context-assembly-types.ts",
  "lib/growth/aios/ai-context-assembly-source-registry.ts",
  "lib/growth/aios/ai-context-assembly-checksum.ts",
  "lib/growth/aios/ai-context-assembly-validator.ts",
  "lib/growth/aios/ai-context-assembly-collector.ts",
  "lib/growth/aios/ai-context-assembly-resolver.ts",
  "lib/growth/aios/ai-context-assembly-repository.ts",
  "lib/growth/aios/ai-context-assembly-service.ts",
  "lib/growth/aios/ai-context-assembly-schema-health.ts",
  "lib/growth/aios/ai-memory-registry-types.ts",
  "lib/growth/aios/ai-memory-registry-repository.ts",
  "lib/growth/aios/ai-memory-registry-service.ts",
  "lib/growth/knowledge-center/knowledge-document-types.ts",
  "lib/growth/knowledge-center/knowledge-repository.ts",
  "lib/growth/runtime/growth-runtime-profile.ts",
  "lib/growth/settings/growth-ai-teammate-identity-repository.ts",
] as const

const PARITY_SCRIPTS = [
  "test:fuzor-adoption-1b-identity-actor-catalog",
  "test:fuzor-adoption-1c-observability-helper-parity",
  "test:fuzor-adoption-1d-configuration-constant-parity",
  "test:fuzor-adoption-1e-knowledge-service-parity",
  "test:fuzor-adoption-1f-persona-repository-parity",
  "test:fuzor-adoption-1g-runtime-profile-parity",
  "test:fuzor-adoption-1h-memory-platform-parity",
  "test:fuzor-adoption-1i-context-platform-parity",
  "test:fuzor-adoption-1j-decision-records-parity",
  "test:fuzor-adoption-1k-event-bus-parity",
  "test:ge-aios-2b-ai-event-foundation",
  "test:ge-aios-2d-decision-record-foundation",
  "test:ge-aios-2j-context-assembly-foundation",
] as const

console.log(`[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] Integrated platform validation (${production ? "production" : "local"})`)
assert.equal(FUZOR_PRODUCTION_CERTIFICATION_1A_QA_MARKER, "fuzor-production-certification-1a-integrated-platform-v1")

for (const file of PLATFORM_WRAPPER_FILES) {
  const source = readSource(file)
  assert.ok(source.includes("@fuzor/"), `${file} must delegate to @fuzor/*`)
}

console.log(`[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] wrapper integrity verified (${PLATFORM_WRAPPER_FILES.length} files)`)

async function main(): Promise<void> {
  const cert = await executeFuzorIntegratedPlatformCertification({ production })
  for (const check of cert.checks) {
    assert.ok(check.pass, `${check.id} failed: ${JSON.stringify(check.detail)}`)
  }

  if (cert.blockers.length > 0) {
    console.error(`[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] BLOCKERS: ${cert.blockers.join(", ")}`)
    process.exit(cert.final_verdict === "INCOMPLETE" ? 2 : 1)
  }

  console.log(
    `[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] integrated capability + multitenancy checks PASS (${cert.checks.length} checks)`,
  )

  if (!production) {
    for (const script of PARITY_SCRIPTS) {
      execSync(`pnpm ${script}`, { cwd: ROOT, stdio: "inherit" })
    }
    console.log(`[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] parity regression suite PASS (${PARITY_SCRIPTS.length} scripts)`)
  }

  console.log(`[${FUZOR_PRODUCTION_CERTIFICATION_1A_PHASE}] ${cert.final_verdict}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
