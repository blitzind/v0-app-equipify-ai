import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { evaluateSocialProfileDiscoveryCertification } from "@/lib/growth/social-profile-discovery/social-profile-discovery-certification"
import {
  runSocialProfileDiscoveryForCanonicalCompany,
  runSocialProfileDiscoveryForCanonicalPerson,
  SocialProfileDiscoveryPreflightError,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-orchestrator"
import { isGrowthSocialProfileDiscoverySchemaReady } from "@/lib/growth/social-profile-discovery/social-profile-discovery-schema-health"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
} from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z
  .object({
    company_id: z.string().uuid(),
    person_id: z.string().uuid().optional(),
    discovery_scope: z.enum(["person", "company"]).optional(),
    promote: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    const scope = data.discovery_scope ?? (data.person_id ? "person" : "company")
    if (scope === "person" && !data.person_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "person_id is required for person-scoped discovery.",
      })
    }
    if (scope === "company" && data.person_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "person_id must be omitted for company-scoped discovery.",
      })
    }
  })

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "company_id and valid discovery scope are required." },
      { status: 400 },
    )
  }

  if (!(await isGrowthSocialProfileDiscoverySchemaReady(access.admin))) {
    return NextResponse.json(
      {
        ok: false,
        reason: "schema_not_ready",
        migration: GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION,
        message: `Apply migration ${GROWTH_SOCIAL_PROFILE_DISCOVERY_MIGRATION} first.`,
      },
      { status: 503 },
    )
  }

  const certification = evaluateSocialProfileDiscoveryCertification()
  const startedMs = Date.now()
  const scope = parsed.data.discovery_scope ?? (parsed.data.person_id ? "person" : "company")

  try {
    const result =
      scope === "person"
        ? await runSocialProfileDiscoveryForCanonicalPerson(access.admin, {
            company_id: parsed.data.company_id,
            person_id: parsed.data.person_id!,
            promote: parsed.data.promote,
            created_by: access.userId,
          })
        : await runSocialProfileDiscoveryForCanonicalCompany(access.admin, {
            company_id: parsed.data.company_id,
            promote: parsed.data.promote,
            created_by: access.userId,
          })

    logGrowthEngine("social_profile_discovery_run", {
      run_id: result.run_id,
      company_id: result.company_id,
      person_id: result.person_id,
      discovery_scope: result.discovery_scope,
      candidate_count: result.candidate_count,
      verified_count: result.verified_count,
      promoted_count: result.promoted_count,
      duration_ms: Date.now() - startedMs,
      actor_user_id: access.userId,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
      certification,
      result,
    })
  } catch (e) {
    if (e instanceof SocialProfileDiscoveryPreflightError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message, certification },
        { status: 400 },
      )
    }
    const message = e instanceof Error ? e.message : "Social profile discovery failed."
    logGrowthEngine("social_profile_discovery_run_failed", { message, actor_user_id: access.userId })
    return NextResponse.json({ ok: false, error: "social_profile_discovery_failed", message }, { status: 500 })
  }
}
