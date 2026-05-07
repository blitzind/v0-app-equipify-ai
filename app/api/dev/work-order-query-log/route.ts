import { NextResponse } from "next/server"

/** Dev-only: receive anonymized client-side work order query failures for debugging (no org/user ids). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  try {
    const body = (await request.json()) as { phase?: string; code?: string; message?: string; retryPath?: string }
    console.warn("[work-order-query-log]", {
      phase: body.phase,
      code: body.code,
      message: body.message,
      retryPath: body.retryPath,
    })
  } catch {
    console.warn("[work-order-query-log] invalid JSON body")
  }
  return NextResponse.json({ ok: true })
}
