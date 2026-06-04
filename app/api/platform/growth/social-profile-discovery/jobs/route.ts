import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enqueueSocialProfileDiscoveryJob } from "@/lib/growth/social-profile-discovery/social-profile-discovery-queue"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-types"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER } from "@/lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

export const runtime = "nodejs"

const EnqueueSchema = z
  .object({
    company_id: z.string().uuid(),
    person_id: z.string().uuid().optional(),
    discovery_scope: z.enum(["person", "company"]).optional(),
    promote_on_complete: z.boolean().optional(),
    trigger_source: z
      .enum(["manual", "person_created", "company_enriched", "browser_extension", "infrastructure_panel"])
      .optional(),
  })
  .superRefine((data, ctx) => {
    const scope = data.discovery_scope ?? (data.person_id ? "person" : "company")
    if (scope === "person" && !data.person_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "person_id required for person scope." })
    }
    if (scope === "company" && data.person_id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "person_id must be omitted for company scope." })
    }
  })

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const raw = await request.json().catch(() => null)
  const parsed = EnqueueSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation_error", message: "Invalid enqueue payload." },
      { status: 400 },
    )
  }

  const scope = parsed.data.discovery_scope ?? (parsed.data.person_id ? "person" : "company")

  const result = await enqueueSocialProfileDiscoveryJob(access.admin, {
    company_id: parsed.data.company_id,
    person_id: parsed.data.person_id ?? null,
    discovery_scope: scope,
    promote_on_complete: parsed.data.promote_on_complete ?? false,
    trigger_source: parsed.data.trigger_source ?? "manual",
    created_by: access.userId ?? null,
  })

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "enqueue_failed", message: result.reason },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_QA_MARKER,
    runtime_qa_marker: GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER,
    enqueued: result.enqueued,
    job_id: result.job_id ?? null,
    reason: result.enqueued ? null : result.reason,
  })
}
