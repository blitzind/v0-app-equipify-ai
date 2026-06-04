import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enqueuePhoneDiscoveryJob } from "@/lib/growth/phone-discovery/phone-discovery-queue"
import { loadPhoneDiscoveryOperatorStatus } from "@/lib/growth/phone-discovery/phone-discovery-operator-status"
import { GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/phone-discovery/phone-discovery-runtime-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  company_id: z.string().uuid(),
  person_id: z.string().uuid(),
  promote_on_complete: z.boolean().optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const company_id = url.searchParams.get("company_id")?.trim() ?? ""
  const person_id = url.searchParams.get("person_id")?.trim() ?? ""
  if (!company_id || !person_id) {
    return NextResponse.json(
      { ok: false, message: "company_id and person_id are required." },
      { status: 400 },
    )
  }

  const status = await loadPhoneDiscoveryOperatorStatus(access.admin, { company_id, person_id })
  if (!status) {
    return NextResponse.json(
      { ok: false, message: "Person must be linked to a canonical company role." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER,
    status,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Invalid phone discovery payload." }, { status: 400 })
  }

  const result = await enqueuePhoneDiscoveryJob(access.admin, {
    company_id: parsed.data.company_id,
    person_id: parsed.data.person_id,
    promote_on_complete: parsed.data.promote_on_complete ?? true,
    trigger_source: "browser_extension",
    created_by: access.userId ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.reason }, { status: 400 })
  }

  const status = await loadPhoneDiscoveryOperatorStatus(access.admin, {
    company_id: parsed.data.company_id,
    person_id: parsed.data.person_id,
  })

  return NextResponse.json({
    ok: true,
    runtime_qa_marker: GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER,
    enqueued: result.enqueued,
    job_id: result.enqueued && "job_id" in result ? result.job_id : null,
    reason: result.enqueued ? null : result.reason,
    status,
  })
}
