import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runGrowthLeadEngineSandboxPipeline } from "@/lib/growth/lead-engine/run-sandbox-pipeline"
import type { GrowthLeadEngineSandboxInput } from "@/lib/growth/lead-engine/workspace-types"

export const runtime = "nodejs"

function asSandboxInput(body: Record<string, unknown>): GrowthLeadEngineSandboxInput {
  return {
    companyName: typeof body.companyName === "string" ? body.companyName.trim() : "",
    domain: typeof body.domain === "string" ? body.domain.trim() : "",
    industry: typeof body.industry === "string" ? body.industry.trim() : "",
    location: typeof body.location === "string" ? body.location.trim() : "",
    notes: typeof body.notes === "string" ? body.notes.trim() : "",
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const input = asSandboxInput(body)

    if (!input.companyName) {
      return NextResponse.json(
        { ok: false, error: "validation_error", message: "companyName is required." },
        { status: 400 },
      )
    }

    const result = runGrowthLeadEngineSandboxPipeline(input)
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "sandbox_failed", message }, { status: 500 })
  }
}
