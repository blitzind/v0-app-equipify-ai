import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutboundOperationsDashboard } from "@/lib/growth/operations/outbound-operations-dashboard"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const dashboard = await fetchGrowthOutboundOperationsDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error)
    const message = sanitizeOutboundOperationsApiError(raw)
    const failureReason = classifyOutboundOperationsFailureReason(raw)
    return NextResponse.json(
      {
        ok: false,
        error: "fetch_failed",
        failureReason,
        message,
        dashboard: null,
      },
      { status: 200 },
    )
  }
}

function sanitizeOutboundOperationsApiError(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return "Outbound operations data could not be loaded. Retry shortly."
  if (/is not defined$/i.test(trimmed) || /^ReferenceError/i.test(trimmed)) {
    return "Outbound operations data could not be loaded due to a server configuration issue."
  }
  if (/permission denied/i.test(trimmed) || trimmed.includes("42501")) {
    return "Outbound operations data is blocked by database permissions. Verify Growth migrations and service role grants."
  }
  if (/does not exist/i.test(trimmed) && /relation/i.test(trimmed)) {
    return "Outbound operations tables are not ready on this project. Apply pending Growth migrations, then reload."
  }
  return "Outbound operations data could not be loaded. Retry shortly."
}

function classifyOutboundOperationsFailureReason(message: string): string {
  const lower = message.toLowerCase()
  if (/permission denied|42501/.test(lower)) return "permission_blocked"
  if (/does not exist/.test(lower) && /relation/.test(lower)) return "schema_not_ready"
  if (/is not defined$/.test(lower)) return "fetch_failed"
  return "fetch_failed"
}
