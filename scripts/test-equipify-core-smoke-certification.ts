/**
 * EC-7 — smoke certification harness verification.
 *
 * Local: structural checks + doc generation contract.
 * Production: run via `pnpm test:equipify-core-smoke-certification:vercel`.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER,
  EQUIPIFY_CORE_SMOKE_MODULES,
} from "../lib/certification/equipify-core-smoke-modules"
import { renderSmokeCertificationMarkdown } from "../lib/certification/equipify-core-smoke-certification"

const ROOT = process.cwd()

function testHarnessStructure(): void {
  console.log(`\n=== EC-7 smoke harness structure (${EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER}) ===\n`)

  const required = [
    "lib/certification/equipify-core-smoke-modules.ts",
    "lib/certification/equipify-core-smoke-certification.ts",
    "scripts/certify-equipify-core-smoke.ts",
    "scripts/test-equipify-core-smoke-certification.ts",
  ]
  for (const rel of required) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)), `Missing ${rel}`)
  }
  console.log("  ✓ harness files exist")

  assert.equal(EQUIPIFY_CORE_SMOKE_MODULES.length, 12)
  console.log(`  ✓ ${EQUIPIFY_CORE_SMOKE_MODULES.length} smoke modules defined`)

  const sample = renderSmokeCertificationMarkdown({
    qa_marker: EQUIPIFY_CORE_SMOKE_CERT_QA_MARKER,
    mode: "smoke",
    production_host: "https://app.equipify.ai",
    organization_id: "test-org",
    executed_at: new Date().toISOString(),
    checks: [
      {
        id: "sample_check",
        category: "authentication",
        status: "pass",
        detail: "sample",
        criticality: "critical",
      },
    ],
    modules: [],
    ok: true,
  })
  assert.ok(sample.includes("## Module matrix"))
  assert.ok(sample.includes("EC-7"))
  console.log("  ✓ markdown renderer produces module matrix")

  console.log("\nEC-7 harness structure PASS\n")
}

async function main(): Promise<void> {
  testHarnessStructure()

  const { runEquipifyCoreSmokeCertification } = await import(
    "../lib/certification/equipify-core-smoke-certification"
  )
  const report = await runEquipifyCoreSmokeCertification({ writeDoc: true })
  console.log(JSON.stringify({ ok: report.ok, modules: report.modules }, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
