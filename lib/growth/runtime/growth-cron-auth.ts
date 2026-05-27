import "server-only"

import { NextResponse } from "next/server"

export function verifyGrowthCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 503 })
  }

  const auth = request.headers.get("authorization")
  const headerSecret = request.headers.get("x-cron-secret")
  if (auth !== `Bearer ${secret}` && headerSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  return null
}
