import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { runOrgGlobalSearch, sanitizeGlobalSearchQuery } from "@/lib/global-search/run-global-search"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  const q = new URL(request.url).searchParams.get("q") ?? ""

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  if (!sanitizeGlobalSearchQuery(q)) {
    return NextResponse.json({ ok: true as const, groups: [] })
  }

  const groups = await runOrgGlobalSearch(gate.supabase, {
    organizationId,
    userId: gate.userId,
    queryRaw: q,
    permissions: gate.permissions,
  })

  return NextResponse.json({ ok: true as const, groups })
}
