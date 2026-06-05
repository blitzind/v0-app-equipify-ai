import { NextResponse } from "next/server"
import { z } from "zod"
import {
  runEmailDiscoveryForCanonicalPerson,
  EmailDiscoveryPreflightError,
} from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import { GROWTH_EMAIL_DISCOVERY_QA_MARKER } from "@/lib/growth/email-discovery/email-discovery-types"
import { isGrowthEmailDiscoverySchemaReady } from "@/lib/growth/email-discovery/email-discovery-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { verifyGrowthCronRequest } from "@/lib/growth/runtime/growth-cron-auth"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  company_id: z.string().uuid(),
  person_id: z.string().uuid(),
  promote: z.boolean().optional().default(true),
})

/** Cron-only email discovery for production runtime certification (7.PS-HO-RUNTIME). */
export async function POST(request: Request) {
  const cronFailure = verifyGrowthCronRequest(request, "platform/growth/email-discovery/cert-run")
  if (cronFailure) return cronFailure

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "company_id and person_id (uuid) are required." },
      { status: 400 },
    )
  }

  const admin = createServiceRoleSupabaseClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_unavailable" }, { status: 503 })
  }

  if (!(await isGrowthEmailDiscoverySchemaReady(admin))) {
    return NextResponse.json({ ok: false, error: "schema_not_ready" }, { status: 503 })
  }

  const provider_snapshot = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
  const verification_certification = evaluateEmailDiscoveryVerificationCertification()

  if (!provider_snapshot.loaders.isZeroBounceConfigured) {
    return NextResponse.json(
      {
        ok: false,
        error: "zerobounce_not_configured_in_runtime",
        provider_snapshot,
        verification_certification,
      },
      { status: 503 },
    )
  }

  if (!verification_certification.production_safe) {
    return NextResponse.json(
      {
        ok: false,
        error: "verification_not_production_safe",
        provider_snapshot,
        verification_certification,
      },
      { status: 503 },
    )
  }

  try {
    const result = await runEmailDiscoveryForCanonicalPerson(admin, {
      company_id: parsed.data.company_id,
      person_id: parsed.data.person_id,
      promote: parsed.data.promote,
      require_production_safe_verification: true,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
      provider_snapshot,
      verification_certification,
      result,
    })
  } catch (e) {
    if (e instanceof EmailDiscoveryPreflightError) {
      return NextResponse.json(
        {
          ok: false,
          error: e.code,
          message: e.message,
          provider_snapshot,
          verification_certification,
        },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Email discovery failed."
    return NextResponse.json(
      {
        ok: false,
        error: "email_discovery_failed",
        message,
        provider_snapshot,
        verification_certification,
      },
      { status: 500 },
    )
  }
}
