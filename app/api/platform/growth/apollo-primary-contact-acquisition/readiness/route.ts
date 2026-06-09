import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloPrimaryContactAcquisitionProductionReadiness } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-production-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const readiness = await buildApolloPrimaryContactAcquisitionProductionReadiness(access.admin)
  return NextResponse.json(readiness)
}
