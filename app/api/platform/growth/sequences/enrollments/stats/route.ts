import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchPatternEnrollmentStats } from "@/lib/growth/sequence-enrollment/pattern-enrollment-stats"
import { GROWTH_ENROLLMENT_PLANES_DOC } from "@/lib/growth/sequence-enrollment/enrollment-planes-doc"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const stats = await fetchPatternEnrollmentStats(access.admin)
    return NextResponse.json({
      ok: true,
      stats,
      planes: GROWTH_ENROLLMENT_PLANES_DOC,
    })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load enrollment stats." }, { status: 500 })
  }
}
