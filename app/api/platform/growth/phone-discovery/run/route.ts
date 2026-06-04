import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { EmailDiscoveryPreflightError } from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { evaluatePhoneDiscoveryCertification } from "@/lib/growth/phone-discovery/phone-discovery-certification"
import {
  runPhoneDiscoveryForCanonicalPerson,
  PhoneDiscoveryPreflightError,
} from "@/lib/growth/phone-discovery/phone-discovery-orchestrator"
import {
  GROWTH_PHONE_DISCOVERY_MIGRATION,
  GROWTH_PHONE_DISCOVERY_QA_MARKER,
} from "@/lib/growth/phone-discovery/phone-discovery-types"
import { isGrowthPhoneDiscoverySchemaReady } from "@/lib/growth/phone-discovery/phone-discovery-schema-health"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  company_id: z.string().uuid(),
  person_id: z.string().uuid(),
  promote: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "company_id and person_id (uuid) are required." },
      { status: 400 },
    )
  }

  if (!(await isGrowthPhoneDiscoverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_PHONE_DISCOVERY_MIGRATION,
        message: `Apply migration ${GROWTH_PHONE_DISCOVERY_MIGRATION} first.`,
      },
      { status: 503 },
    )
  }

  const certification = evaluatePhoneDiscoveryCertification()
  const startedMs = Date.now()

  try {
    const result = await runPhoneDiscoveryForCanonicalPerson(access.admin, {
      company_id: parsed.data.company_id,
      person_id: parsed.data.person_id,
      promote: parsed.data.promote,
      created_by: access.userId,
    })

    logGrowthEngine("phone_discovery_run", {
      run_id: result.run_id,
      company_id: result.company_id,
      person_id: result.person_id,
      candidate_count: result.candidate_count,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
      duration_ms: Date.now() - startedMs,
      actor_user_id: access.userId,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_PHONE_DISCOVERY_QA_MARKER,
      certification,
      result,
    })
  } catch (e) {
    if (e instanceof PhoneDiscoveryPreflightError || e instanceof EmailDiscoveryPreflightError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message, certification },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Phone discovery failed."
    logGrowthEngine("phone_discovery_run_failed", { message, actor_user_id: access.userId })
    return NextResponse.json({ ok: false, error: "phone_discovery_failed", message }, { status: 500 })
  }
}
