import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createApolloPilotCohort,
  listApolloPilotCohorts,
} from "@/lib/growth/apollo/apollo-pilot-route"

export const runtime = "nodejs"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const cohorts = await listApolloPilotCohorts(access.admin)
    return NextResponse.json({ ok: true, cohorts })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const cohort_name = asString(body?.cohort_name)
  const target_company_count = Number(body?.target_company_count ?? 25)
  const companiesRaw = body?.companies

  const companies =
    Array.isArray(companiesRaw)
      ? companiesRaw
          .map((entry) => {
            if (!entry || typeof entry !== "object") return null
            const record = entry as Record<string, unknown>
            const company_candidate_id = asString(record.company_candidate_id)
            if (!company_candidate_id) return null
            return {
              company_candidate_id,
              company_name: asString(record.company_name) || undefined,
              domain: asString(record.domain) || null,
            }
          })
          .filter(Boolean)
      : []

  try {
    const result = await createApolloPilotCohort(access.admin, {
      cohort_name,
      target_company_count,
      created_by: access.userId,
      created_by_email: access.userEmail,
      companies: companies as Array<{
        company_candidate_id: string
        company_name?: string
        domain?: string | null
      }>,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 400 })
  }
}
