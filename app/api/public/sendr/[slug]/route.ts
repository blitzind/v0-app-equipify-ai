import { NextResponse } from "next/server"
import {
  GROWTH_SENDR_PUBLIC_QA_MARKER,
  GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { loadSendrPublicPageBySlug } from "@/lib/growth/sendr/growth-sendr-public-page-service"
import { parseSendrVisitorRenderContext } from "@/lib/growth/sendr/growth-sendr-visitor-render-context"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  const { slug } = await context.params
  const url = new URL(request.url)
  const renderContext = parseSendrVisitorRenderContext(Object.fromEntries(url.searchParams.entries()))
  const result = await loadSendrPublicPageBySlug(admin, slug, renderContext)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: CORS_HEADERS },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      slug: result.slug,
      page: result.payload,
      qa_marker: GROWTH_SENDR_PUBLIC_QA_MARKER,
      visitor_personalization_qa_marker: GROWTH_SENDR_VISITOR_PERSONALIZATION_QA_MARKER,
    },
    { headers: CORS_HEADERS },
  )
}
