/**
 * Equipify Core production certification (EC-4).
 *
 * Modes:
 *   --mode=readiness          Env/config presence (no secrets printed)
 *   --mode=read-safe          Read-only production DB + route probes
 *   --mode=mutation-dry-run   Revenue path prerequisite validation (no writes)
 *   --mode=payment-dry-run    Payment prerequisite validation (no Stripe sessions)
 *   --mode=browser-revenue    Authenticated Playwright quote/invoice UI (optional)
 *
 * Local (requires production env already injected):
 *   pnpm test:equipify-core-production-readiness
 *   pnpm test:equipify-core-production-read-safe
 *   pnpm test:equipify-core-production-mutation-dry-run
 *   pnpm test:equipify-core-production-payment-dry-run
 *
 * Vercel Production env:
 *   pnpm test:equipify-core-production-readiness:vercel
 *   pnpm test:equipify-core-production-read-safe:vercel
 *   pnpm test:equipify-core-production-mutation-dry-run:vercel
 *   pnpm test:equipify-core-production-payment-dry-run:vercel
 */
import {
  EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER,
  runEquipifyCoreReadinessChecks,
  runEquipifyCoreReadSafeChecks,
  type EquipifyCoreCertMode,
} from "../lib/certification/equipify-core-production-certification"
import {
  runEquipifyCoreMutationDryRunChecks,
  runEquipifyCorePaymentDryRunChecks,
  runEquipifyCoreRevenueBrowserChecks,
} from "../lib/certification/equipify-core-revenue-certification"

function parseMode(argv: string[]): EquipifyCoreCertMode | "browser-revenue" {
  const arg = argv.find((a) => a.startsWith("--mode="))
  const raw = arg?.split("=")[1]?.trim()
  if (
    raw === "readiness" ||
    raw === "read-safe" ||
    raw === "mutation-dry-run" ||
    raw === "payment-dry-run" ||
    raw === "browser-revenue"
  ) {
    return raw
  }
  return "readiness"
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv)
  console.log(`\n=== Equipify Core production certification (${EQUIPIFY_CORE_PRODUCTION_CERT_QA_MARKER}) ===`)
  console.log(`Mode: ${mode}\n`)

  if (mode === "mutation-dry-run") {
    const report = await runEquipifyCoreMutationDryRunChecks()
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
  }

  if (mode === "payment-dry-run") {
    const report = await runEquipifyCorePaymentDryRunChecks()
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
  }

  if (mode === "browser-revenue") {
    const report = await runEquipifyCoreRevenueBrowserChecks()
    console.log(JSON.stringify(report, null, 2))
    process.exit(report.ok ? 0 : 1)
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
