import { NextResponse } from "next/server"

export function mapMediaAssetError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "asset_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Media asset not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch" || message === "storage_key_missing") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (
    message === "invalid_status" ||
    message === "upload_session_not_found" ||
    message.endsWith("_not_implemented")
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}
