import { NextResponse } from "next/server"

export function mapMediaVideoThumbnailError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "asset_not_found" || message === "thumbnail_not_found") {
    return NextResponse.json({ ok: false, error: message }, { status: 404 })
  }
  if (message === "organization_scope_mismatch") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (
    message === "invalid_thumbnail_mime_type" ||
    message === "invalid_file_size" ||
    message === "file_too_large" ||
    message === "invalid_checksum" ||
    message === "invalid_asset_type" ||
    message === "invalid_status" ||
    message === "duplicate_thumbnail" ||
    message === "upload_session_not_found" ||
    message === "upload_session_expired"
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}
