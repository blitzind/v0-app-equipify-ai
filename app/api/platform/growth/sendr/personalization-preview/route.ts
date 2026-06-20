import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_WORKSPACE_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { previewSendrPersonalization } from "@/lib/growth/sendr/growth-sendr-personalization-preview-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const BodySchema = z.object({
  leadId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  variableMap: z.record(z.string()).optional(),
  customVariables: z.record(z.string()).optional(),
  fallbacks: z.record(z.string()).optional(),
  sampleTemplates: z.record(z.string()).optional(),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    let variableMap = parsed.data.variableMap ?? {}
    if (parsed.data.companyId && !parsed.data.leadId) {
      const { data } = await access.admin
        .schema("growth")
        .from("companies")
        .select("name, industry, city, state")
        .eq("id", parsed.data.companyId)
        .maybeSingle()
      if (data) {
        const row = data as Record<string, unknown>
        variableMap = {
          ...variableMap,
          company_name: String(row.name ?? ""),
          industry: String(row.industry ?? ""),
          city: String(row.city ?? ""),
          state: String(row.state ?? ""),
        }
      }
    }

    const preview = await previewSendrPersonalization(access.admin, {
      leadId: parsed.data.leadId,
      variableMap,
      customVariables: parsed.data.customVariables,
      fallbacks: parsed.data.fallbacks,
      sampleTemplates: parsed.data.sampleTemplates,
    })

    return NextResponse.json({
      ok: true,
      preview,
      qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "preview_failed" },
      { status: 500 },
    )
  }
}
