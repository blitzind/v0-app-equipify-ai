import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listRevenuePlaybooks } from "@/lib/growth/revenue-execution/revenue-playbooks"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({ ok: true, playbooks: listRevenuePlaybooks() })
}
