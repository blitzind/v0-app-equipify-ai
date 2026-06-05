import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { processDensityScaleUpVerifiedEmailQueueIfScheduled } from "@/lib/growth/benchmark/apollo-replacement-benchmark-density-scale-up-execute"
import { processBenchmarkVerifiedEmailQueueIfScheduled } from "@/lib/growth/benchmark/apollo-replacement-benchmark-verified-email-execute"
import { runEmailDiscoveryForCanonicalPerson } from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import { GROWTH_EMAIL_DISCOVERY_QA_MARKER } from "@/lib/growth/email-discovery/email-discovery-types"
import { isGrowthEmailDiscoverySchemaReady } from "@/lib/growth/email-discovery/email-discovery-schema-health"
import { runGrowthCronJob } from "@/lib/growth/runtime/growth-cron-runner"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { buildGrowthProviderRuntimeDiagnosticsSnapshot } from "@/lib/growth/qa/growth-provider-runtime-diagnostics"

export const runtime = "nodejs"
export const maxDuration = 120

const CRON_ROUTE = growthCronApiPath("growth-email-discovery-cert-run")

/** 7.PS-HO-RUNTIME cert default — Biomedical Repair Service / Thanh. */
const PS_HO_RUNTIME_BIOMEDICAL_DEFAULTS = {
  company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
  person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
} as const

const QuerySchema = z.object({
  company_id: z.string().uuid().optional(),
  person_id: z.string().uuid().optional(),
  promote: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
})

/** Cron-triggered email discovery for production runtime certification (7.PS-HO-RUNTIME). */
export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse({
    company_id: url.searchParams.get("company_id") ?? PS_HO_RUNTIME_BIOMEDICAL_DEFAULTS.company_id,
    person_id: url.searchParams.get("person_id") ?? PS_HO_RUNTIME_BIOMEDICAL_DEFAULTS.person_id,
    promote: url.searchParams.get("promote") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_query",
        message: "company_id and person_id must be valid uuids when provided.",
      },
      { status: 400 },
    )
  }

  return runGrowthCronJob(
    {
      cronRoute: CRON_ROUTE,
      category: "discovery",
      request,
      admin,
      enforceProductionSafety: false,
    },
    async () => {
      if (!(await isGrowthEmailDiscoverySchemaReady(admin))) {
        throw new Error("schema_not_ready")
      }

      const provider_snapshot = buildGrowthProviderRuntimeDiagnosticsSnapshot(process.env)
      const verification_certification = evaluateEmailDiscoveryVerificationCertification()

      if (!provider_snapshot.loaders.isZeroBounceConfigured) {
        return {
          ok: false,
          error: "zerobounce_not_configured_in_runtime",
          provider_snapshot,
          verification_certification,
          processed: 0,
        }
      }

      if (!verification_certification.production_safe) {
        return {
          ok: false,
          error: "verification_not_production_safe",
          provider_snapshot,
          verification_certification,
          processed: 0,
        }
      }

      const benchmark_queue = await processBenchmarkVerifiedEmailQueueIfScheduled(admin)
      if (benchmark_queue.processed && benchmark_queue.cert_payload) {
        return {
          ...benchmark_queue.cert_payload,
          qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
          provider_snapshot,
          verification_certification,
          processed:
            typeof benchmark_queue.cert_payload.processed === "number"
              ? benchmark_queue.cert_payload.processed
              : 0,
          verified_count:
            typeof benchmark_queue.cert_payload.emails_verified === "number"
              ? benchmark_queue.cert_payload.emails_verified
              : 0,
          promoted_count:
            typeof benchmark_queue.cert_payload.emails_promoted === "number"
              ? benchmark_queue.cert_payload.emails_promoted
              : 0,
        }
      }

      const scale_up_queue = await processDensityScaleUpVerifiedEmailQueueIfScheduled(admin)
      if (scale_up_queue.processed && scale_up_queue.cert_payload) {
        return {
          ...scale_up_queue.cert_payload,
          qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
          provider_snapshot,
          verification_certification,
          processed:
            typeof scale_up_queue.cert_payload.processed === "number"
              ? scale_up_queue.cert_payload.processed
              : 0,
          verified_count:
            typeof scale_up_queue.cert_payload.emails_verified === "number"
              ? scale_up_queue.cert_payload.emails_verified
              : 0,
          promoted_count:
            typeof scale_up_queue.cert_payload.emails_promoted === "number"
              ? scale_up_queue.cert_payload.emails_promoted
              : 0,
        }
      }

      const result = await runEmailDiscoveryForCanonicalPerson(admin, {
        company_id: parsed.data.company_id,
        person_id: parsed.data.person_id,
        promote: parsed.data.promote,
        require_production_safe_verification: true,
      })

      return {
        ok: true,
        qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
        provider_snapshot,
        verification_certification,
        result,
        processed: 1,
        verified_count: result.verified_count,
        promoted_count: result.promoted_count,
        candidate_count: result.candidate_count,
      }
    },
    (result) => ({
      processedCount: result.processed ?? 0,
      failedCount: result.ok === false ? 1 : 0,
      metadata: {
        cert_result: result,
      },
    }),
  )
}

export async function GET(request: Request) {
  return POST(request)
}
