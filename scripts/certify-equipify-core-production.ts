/**
 * Equipify Core production certification (EC-2).
 *
 * Modes:
 *   --mode=readiness     Env/config presence (no secrets printed)
 *   --mode=read-safe     Read-only production DB + route probes
 *   --mode=mutation-dry-run   (not implemented in EC-2)
 *   --mode=payment-dry-run    (not implemented in EC-2)
 *
 * Local (requires production env already injected):
 *   pnpm test:equipify-core-production-readiness
 *   pnpm test:equipify-core-production-read-safe
 *
 * Vercel Production env:
 *   pnpm test:equipify-core-production-readiness:vercel
 *   pnpm test:equipify-core-production-read-safe:vercel
 */
import {
  EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
  runEquipifyCoreReadinessChecks,
  runEquipifyCoreReadSafeChecks,
  unsupportedModeReport,
  type EquipifyCoreCertMode,
} from "../lib/certification/equipify-core-production-certification"

function parseMode(argv: string[]): EquipifyCoreCertMode {
  const arg = argv.find((a) => a.startsWith("--mode="))
  const raw = arg?.split("=")[1]?.trim()
  if (
    raw === "readiness" ||
    raw === "read-safe" ||
    raw === "mutation-dry-run" ||
    raw === "payment-dry-run"
  ) {
    return raw
  }
  return "readiness"
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv)
  console.log(`\n=== Equipify Core production certification (${EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER}) ===`)
  console.log(`Mode: ${mode}\n`)

  if (mode === "mutation-dry-run" || mode === "payment-dry-run") {
    const report = unsupportedModeReport(mode)
    console.log(JSON.stringify(report, null, 2))
    process.exit(1)
  }

  if (mode === "readiness") {
    const report = runEquipifyCoreReadinessChecks()
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
  }

  const report = await runEquipifyCoreReadSafeChecks()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      qa_marker: EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exit(1)
})
