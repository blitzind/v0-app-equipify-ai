import { NextResponse } from "next/server"
import { buildHumanInterventionReadinessPayload } from "@/lib/growth/human-interventions/human-intervention-route-gates"

export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({
    ok: true,
    ...buildHumanInterventionReadinessPayload(),
  })
}
