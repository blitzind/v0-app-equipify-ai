import "server-only"

import { NextResponse } from "next/server"

/** Verbose request/response logging for upload routes (local, Vercel preview, or LOGO_UPLOAD_DIAGNOSTICS=1). */
export function logoUploadVerboseLogs(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.LOGO_UPLOAD_DIAGNOSTICS === "1"
  )
}

export function logoRouteJsonError(
  code: string,
  message: string,
  status: number,
  extra?: { step?: string; details?: string | null },
) {
  return NextResponse.json({ error: code, message, ...extra }, { status })
}

export function normalizePublicUrl(u: string): string {
  return u.trim().split("?")[0]
}
