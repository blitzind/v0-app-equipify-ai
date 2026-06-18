/**
 * EC-6 — revenue fixture + portal certification.
 *
 * Usage:
 *   pnpm test:equipify-core-revenue-ec6:vercel
 */
import { runEquipifyCoreRevenueEc6Certification } from "../lib/certification/equipify-core-revenue-ec6-certification"

async function main(): Promise<void> {
  const report = await runEquipifyCoreRevenueEc6Certification()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exit(1)
})
