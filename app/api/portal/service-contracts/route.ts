import { NextResponse } from "next/server"
import { requirePortalSession } from "@/lib/portal/require-portal-session"
import type { ServiceContractRow } from "@/lib/service-contracts/types"
import { contractIsActivelyCovering, summarizeContractForPortal } from "@/lib/service-contracts/coverage"

export const runtime = "nodejs"

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data: rows, error } = await svc
    .from("org_service_contracts")
    .select(
      "id, contract_name, contract_number, start_date, end_date, coverage_type, status, customer_id",
    )
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .order("end_date", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date()
  const active = (rows ?? []).filter((r) => contractIsActivelyCovering(r as ServiceContractRow, now))

  return NextResponse.json({
    contracts: active.map((r) => summarizeContractForPortal(r as ServiceContractRow)),
  })
}
