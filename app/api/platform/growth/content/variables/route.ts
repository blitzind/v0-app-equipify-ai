import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listContentVariables } from "@/lib/growth/content/snippet-repository"
import { isGrowthContentLibrarySchemaReady } from "@/lib/growth/content/schema-health"
import { GROWTH_CONTENT_PRIVACY_NOTE } from "@/lib/growth/content/content-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthContentLibrarySchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const variables = await listContentVariables(access.admin)
    return NextResponse.json({ ok: true, variables, privacy_note: GROWTH_CONTENT_PRIVACY_NOTE })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
