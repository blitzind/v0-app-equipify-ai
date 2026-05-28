import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildGrowthOperatorAttentionStrip } from "@/lib/growth/operator-ux/operator-attention-strip"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const strip = await buildGrowthOperatorAttentionStrip(access.admin, access.userId)
    return NextResponse.json({ ok: true, strip })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load operator attention strip."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
