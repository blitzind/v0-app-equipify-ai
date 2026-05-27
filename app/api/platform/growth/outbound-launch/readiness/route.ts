import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthInfrastructureReadinessCatalog } from "@/lib/growth/infrastructure/infrastructure-readiness"
import {
  GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
  type OutboundLaunchReadinessSummary,
} from "@/lib/growth/outbound-launch/outbound-launch-motion"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const catalog = buildGrowthInfrastructureReadinessCatalog()
  const provider_surfaces = catalog
    .filter((entry) =>
      ["outbound_provider", "webhook_ingestion", "transport_send", "mailbox_provider"].includes(
        entry.surfaceId,
      ),
    )
    .map((entry) => ({
      surfaceId: entry.surfaceId,
      title: entry.title,
      status: entry.readiness.status,
      label: entry.readiness.label,
      detail: entry.readiness.detail,
    }))

  const blocking = provider_surfaces.filter((row) =>
    ["error", "disabled"].includes(row.status),
  )
  const warning = provider_surfaces.filter((row) =>
    ["stub", "preview_only", "degraded", "simulated"].includes(row.status),
  )

  const summary: OutboundLaunchReadinessSummary = {
    qa_marker: GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
    provider_surfaces,
    outbound_ready: blocking.length === 0,
    readiness_message:
      blocking.length > 0
        ? `Provider not ready: ${blocking.map((b) => b.title).join(", ")}. Connect providers before execute.`
        : warning.length > 0
          ? `Preview/stub mode: ${warning.map((w) => w.title).join(", ")}. Draft and approve still allowed — verify before send.`
          : null,
  }

  return NextResponse.json({ ok: true, summary })
}
