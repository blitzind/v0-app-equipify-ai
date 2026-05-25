import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthNativeDialerLeadContext } from "@/lib/growth/native-dialer/native-dialer-service"
import { GROWTH_NATIVE_DIALER_QA_MARKER } from "@/lib/growth/native-dialer/native-dialer-types"
import {
  GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE,
  isGrowthNativeDialerSchemaReady,
} from "@/lib/growth/native-dialer/native-dialer-schema-health"

export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid lead id." }, { status: 400 })
  }

  if (!(await isGrowthNativeDialerSchemaReady(access.admin))) {
    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER,
      meta: { schemaReady: false, setupMessage: GROWTH_NATIVE_DIALER_SCHEMA_SETUP_MESSAGE },
      leadContext: null,
    })
  }

  try {
    const leadContext = await fetchGrowthNativeDialerLeadContext(access.admin, leadId)
    if (!leadContext) return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    return NextResponse.json({ ok: true, qaMarker: GROWTH_NATIVE_DIALER_QA_MARKER, leadContext })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load lead context."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
