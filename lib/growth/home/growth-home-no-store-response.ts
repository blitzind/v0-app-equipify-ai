import { NextResponse } from "next/server"
import { GROWTH_HOME_NO_STORE_CACHE_CONTROL } from "@/lib/growth/home/growth-home-workspace-api-contract"

/** Force dynamic rendering for Home data APIs (no static/ISR cache). */
export const growthHomeRouteDynamic = "force-dynamic" as const

export function growthHomeNoStoreJson<T extends Record<string, unknown>>(
  body: T,
  init?: { status?: number },
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": GROWTH_HOME_NO_STORE_CACHE_CONTROL,
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}
