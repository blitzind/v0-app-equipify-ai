import { NextResponse } from "next/server"
import { buildIntentPixelScript } from "@/lib/growth/intent-pixel/pixel-script"

export const runtime = "nodejs"

function resolveCollectUrl(request: Request): string {
  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim()
  const origin = url.origin
  const collect = new URL("/api/growth/intent-pixel/collect", origin)
  if (siteKey) collect.searchParams.set("site_key", siteKey)
  return collect.toString()
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const siteKey = url.searchParams.get("site_key")?.trim() || "equipify-sandbox"
  const collectUrl = resolveCollectUrl(request)

  const script = buildIntentPixelScript({
    collectUrl,
    siteKey,
  })

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  })
}
