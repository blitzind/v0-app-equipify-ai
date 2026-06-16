import { NextResponse } from "next/server"

export function mapMediaVideoUploadError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  if (message === "asset_not_found") {
    return NextResponse.json({ ok: false, error: message, message: "Video asset not found." }, { status: 404 })
  }
  if (message === "organization_scope_mismatch") {
    return NextResponse.json({ ok: false, error: message }, { status: 403 })
  }
  if (
    message === "invalid_video_mime_type" ||
    message === "invalid_file_size" ||
    message === "file_too_large" ||
    message === "invalid_checksum" ||
    message === "invalid_asset_type" ||
    message === "invalid_status" ||
    message === "duplicate_upload" ||
    message === "duplicate_upload_session" ||
    message === "upload_session_not_found" ||
    message === "upload_session_expired" ||
    message === "upload_object_missing"
  ) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: false, error: "request_failed", message }, { status: 500 })
}
