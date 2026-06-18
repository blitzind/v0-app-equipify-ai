/**
 * EC-7 — Equipify Core production smoke certification entrypoint.
 */
import { runEquipifyCoreSmokeCertification } from "../lib/certification/equipify-core-smoke-certification"

async function main(): Promise<void> {
  const report = await runEquipifyCoreSmokeCertification({ writeDoc: true })
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
