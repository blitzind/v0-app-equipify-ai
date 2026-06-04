import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_EMAIL_DISCOVERY_ROLE_PAIRS_QA_MARKER,
  loadEmailDiscoveryRolePairs,
} from "@/lib/growth/email-discovery/email-discovery-role-pairs"
import { GROWTH_EMAIL_DISCOVERY_QA_MARKER } from "@/lib/growth/email-discovery/email-discovery-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const company_id = url.searchParams.get("company_id")?.trim() ?? ""
  const person_id = url.searchParams.get("person_id")?.trim() ?? ""
  const limitRaw = Number(url.searchParams.get("limit") ?? "250")
  const limit = Number.isFinite(limitRaw) ? limitRaw : 250

  try {
    const pairs = await loadEmailDiscoveryRolePairs(access.admin, {
      q: q || undefined,
      limit,
      company_id: company_id || undefined,
      person_id: person_id || undefined,
    })
    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_EMAIL_DISCOVERY_QA_MARKER,
      role_pairs_qa_marker: GROWTH_EMAIL_DISCOVERY_ROLE_PAIRS_QA_MARKER,
      pairs,
      count: pairs.length,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load role pairs."
    return NextResponse.json({ ok: false, error: "load_failed", message }, { status: 500 })
  }
}
