import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import {
  fetchImportOpsMetrics,
  listImportOpsKindOptions,
  listImportOpsOrganizationOptions,
  searchImportOpsRuns,
} from "@/lib/migration-imports/import-ops-metrics"
import { listOperatorEventsForPlatform } from "@/lib/migration-imports/operator-events"

export const runtime = "nodejs"

const ALLOWED_STATUSES = new Set([
  "queued",
  "processing",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
])

function parseStatuses(raw: string | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ALLOWED_STATUSES.has(s))
}

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const statuses = parseStatuses(url.searchParams.get("status"))
  const organizationId = url.searchParams.get("organizationId")?.trim() || undefined
  const importKind = url.searchParams.get("kind")?.trim() || undefined
  const stuckOnly = url.searchParams.get("stuckOnly") === "true"
  const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "75", 10) || 75, 1), 200)
  const eventsLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get("eventsLimit") ?? "30", 10) || 30, 1), 100)

  try {
    const [metrics, runs, orgOptions, kindOptions, recentEvents] = await Promise.all([
      fetchImportOpsMetrics(svc),
      searchImportOpsRuns(svc, {
        status: statuses.length > 0 ? statuses : undefined,
        organizationId,
        importKind,
        search,
        stuckOnly,
        limit,
      }),
      listImportOpsOrganizationOptions(svc),
      listImportOpsKindOptions(svc),
      listOperatorEventsForPlatform({ limit: eventsLimit }),
    ])

    return NextResponse.json({
      ok: true,
      metrics,
      runs,
      filters: {
        statuses: [...ALLOWED_STATUSES],
        organizations: orgOptions,
        kinds: kindOptions,
      },
      recentEvents,
      query: {
        search,
        statuses,
        organizationId: organizationId ?? null,
        kind: importKind ?? null,
        stuckOnly,
        limit,
        eventsLimit,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: "import_ops_failed", message: e instanceof Error ? e.message : "Could not load import operations." },
      { status: 500 },
    )
  }
}
