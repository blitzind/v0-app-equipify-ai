import { NextResponse } from "next/server"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gatherOrgInsightsContext } from "@/lib/insights/gather-org-context"
import {
  generateOperationalInsightsWithOpenAI,
  InsightsConfigError,
} from "@/lib/insights/openai-generate-insights"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  organizationId?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to generate insights." }, { status: 401 })
  }

  const { data: member, error: memberErr } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memberErr || !member) {
    return NextResponse.json(
      { error: "forbidden", message: "You do not have access to this organization." },
      { status: 403 },
    )
  }

  const featureGate = await requireFeatureAccess(supabase, organizationId, "ai")
  if (!featureGate.ok) {
    return NextResponse.json(
      { error: "feature_denied", message: featureGate.message },
      { status: featureGate.httpStatus },
    )
  }

  try {
    const context = await gatherOrgInsightsContext(supabase, organizationId)
    const ai = await generateOperationalInsightsWithOpenAI(context)
    return NextResponse.json({
      ok: true,
      generatedAt: context.generatedAtIso,
      summary: ai.summary,
      insights: ai.insights,
    })
  } catch (e) {
    if (e instanceof InsightsConfigError) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_configured",
          message: e.message,
        },
        { status: 503 },
      )
    }
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
  }
}
