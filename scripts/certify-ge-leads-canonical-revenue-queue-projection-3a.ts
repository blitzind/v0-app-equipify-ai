/**
 * GE-LEADS-CANONICAL-3A — Production certification: legacy Revenue Queue vs canonical projection.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-revenue-queue-projection-3a.ts
 */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { certifyRevenueQueueProjectionParity } from "@/lib/growth/revenue-queue/revenue-queue-projection-cert"
import { loadRevenueQueueProjections } from "@/lib/growth/revenue-queue/revenue-queue-projection-loader"

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error("Could not bootstrap production Supabase env.")
    process.exit(1)
  }

  const [cert, projections] = await Promise.all([
    certifyRevenueQueueProjectionParity(boot.admin, { inboxLimit: 200, leadsLimit: 200 }),
    loadRevenueQueueProjections(boot.admin, { limit: 200, includeArchived: true }),
  ])

  console.log(
    JSON.stringify(
      {
        qa_marker: "GE-LEADS-CANONICAL-3A-PROJECTION-CERT",
        env_source: boot.env_source,
        supabase_host: new URL(boot.url).host,
        certification: cert,
        canonical_projection_sample: {
          total: projections.total,
          missing_fields_histogram: projections.items.reduce<Record<string, number>>((acc, item) => {
            for (const field of item.missing_projection_fields) {
              acc[field] = (acc[field] ?? 0) + 1
            }
            return acc
          }, {}),
          sample_ids: projections.items.slice(0, 5).map((item) => item.growth_lead_id),
        },
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
