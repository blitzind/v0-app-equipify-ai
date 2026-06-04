import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import {
  runEmailDiscoveryForCanonicalPerson,
  EmailDiscoveryPreflightError,
} from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import {
  GROWTH_EMAIL_DISCOVERY_MIGRATION,
  GROWTH_EMAIL_DISCOVERY_QA_MARKER,
} from "@/lib/growth/email-discovery/email-discovery-types"
import { isGrowthEmailDiscoverySchemaReady } from "@/lib/growth/email-discovery/email-discovery-schema-health"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  company_id: z.string().uuid(),
  person_id: z.string().uuid(),
  lead_id: z.string().uuid().optional().nullable(),
  promote: z.boolean().optional().default(true),
  require_production_safe_verification: z.boolean().optional(),
})

function isProductionDeployment(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
}

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

  if (!(await isGrowthEmailDiscoverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_EMAIL_DISCOVERY_MIGRATION,
        message: `Apply migration ${GROWTH_EMAIL_DISCOVERY_MIGRATION} first.`,
      },
      { status: 503 },
    )
  }

  const verification_certification = evaluateEmailDiscoveryVerificationCertification()
  const requireProductionSafe =
    parsed.data.require_production_safe_verification ?? isProductionDeployment()

  const startedMs = Date.now()
  try {
    const result = await runEmailDiscoveryForCanonicalPerson(access.admin, {
      company_id: parsed.data.company_id,
      person_id: parsed.data.person_id,
      lead_id: parsed.data.lead_id ?? null,
      promote: parsed.data.promote,
      created_by: access.userId,
      require_production_safe_verification: requireProductionSafe,
    })

    logGrowthEngine("email_discovery_run", {
      run_id: result.run_id,
      company_id: result.company_id,
      person_id: result.person_id,
      candidate_count: result.candidate_count,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
      duration_ms: Date.now() - startedMs,
      actor_user_id: access.userId,
      verification_production_safe: verification_certification.production_safe,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
      verification_certification,
      result,
    })
  } catch (e) {
    if (e instanceof EmailDiscoveryPreflightError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message, verification_certification },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Email discovery failed."
    logGrowthEngine("email_discovery_run_failed", {
      message,
      actor_user_id: access.userId,
    })
    return NextResponse.json({ ok: false, error: "email_discovery_failed", message }, { status: 500 })
  }
}
