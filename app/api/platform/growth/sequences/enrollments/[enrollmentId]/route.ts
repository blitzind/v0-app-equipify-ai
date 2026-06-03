import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchPatternEnrollmentDetail } from "@/lib/growth/sequence-enrollment/enrollment-detail"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ enrollmentId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { enrollmentId } = await context.params
  try {
    const detail = await fetchPatternEnrollmentDetail(access.admin, enrollmentId, {
      actingUserEmail: access.userEmail,
    })
    if (!detail) {
      return NextResponse.json({ error: "not_found", message: "Enrollment not found." }, { status: 404 })
    }
    return NextResponse.json({ ok: true, detail })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load enrollment detail." }, { status: 500 })
  }
}
