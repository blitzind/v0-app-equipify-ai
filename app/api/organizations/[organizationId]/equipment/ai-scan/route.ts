import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { requireCanCreateRecord } from "@/lib/billing/server-guard"
import { ingestEquipmentScanUpload } from "@/lib/equipment/equipment-scan-ingest"
import type { EquipmentScanActionResult } from "@/lib/equipment/equipment-scan-action-result"

export const runtime = "nodejs"
/** AI scan can exceed default serverless duration on large images. */
export const maxDuration = 120

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function routeLog(stage: string, fields: Record<string, string | number | boolean | null | undefined> = {}) {
  try {
    process.stdout.write(`[equipment_scan_route] ${JSON.stringify({ stage, ...fields })}\n`)
  } catch {
    /* ignore */
  }
}

function jsonResult(body: EquipmentScanActionResult, status = 200) {
  return NextResponse.json(body, { status })
}

/**
 * Multipart equipment AI scan upload (bypasses Server Action transport).
 * Body: `multipart/form-data` with field `file` (image or PDF).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  routeLog("route_enter", { organization_id_suffix: organizationId.length > 8 ? organizationId.slice(-8) : organizationId })

  if (!UUID_RE.test(organizationId)) {
    routeLog("route_return", { early: "invalid_org_id" })
    return jsonResult(
      {
        ok: false,
        code: "invalid_organization",
        stage: "route_enter",
        message: "Invalid workspace identifier.",
      },
      400,
    )
  }

  const session = await requireOrgMemberSession(organizationId)
  if ("error" in session) {
    const status = session.error.status
    routeLog("route_return", { early: "session_denied", http_status: status })
    return jsonResult(
      {
        ok: false,
        code: status === 401 ? "unauthorized" : "forbidden",
        stage: status === 401 ? "auth_check" : "permission_check",
        message:
          status === 401
            ? "Sign in required."
            : "You are not a member of this workspace or do not have access.",
      },
      status,
    )
  }

  const gate = await requireCanCreateRecord(session.supabase, session.userId, organizationId, "equipment")
  if (!gate.ok) {
    routeLog("route_return", { early: "create_gate_denied", code: gate.code })
    return jsonResult(
      {
        ok: false,
        code: gate.code,
        stage: gate.code === "unauthorized" ? "auth_check" : "permission_check",
        message: gate.message,
      },
      gate.httpStatus ?? 403,
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : String(e)
    routeLog("route_return", { early: "formdata_parse_failed", message: msg })
    return jsonResult(
      {
        ok: false,
        code: "multipart_parse_failed",
        stage: "file_received",
        message:
          "Could not read the upload (multipart). The file may be too large for this host, or the connection was interrupted. Try a smaller image or PDF.",
      },
      400,
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    routeLog("route_return", { early: "missing_file" })
    return jsonResult(
      {
        ok: false,
        code: "no_file",
        stage: "file_received",
        message: "Please choose a file to upload.",
      },
      400,
    )
  }

  routeLog("file_received", { bytes: file.size, reported_type: file.type || "empty" })

  let buffer: Buffer
  try {
    buffer = Buffer.from(await file.arrayBuffer())
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 160) : String(e)
    routeLog("route_return", { early: "buffer_failed", message: msg })
    return jsonResult(
      {
        ok: false,
        code: "buffer_read_failed",
        stage: "file_received",
        message: "Could not read the uploaded file. Try again or pick a different file.",
      },
      400,
    )
  }

  routeLog("validation_ok", { buffer_bytes: buffer.byteLength })

  routeLog("extraction_start", {})
  let result: EquipmentScanActionResult
  try {
    result = await ingestEquipmentScanUpload({
      organizationId,
      buffer,
      fileName: file.name || "upload",
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const lower = msg.toLowerCase()
    routeLog("route_return", { early: "ingest_threw", message: msg.slice(0, 200) })
    if (lower.includes("body exceeded") || lower.includes("413")) {
      return jsonResult(
        {
          ok: false,
          code: "payload_too_large",
          stage: "extraction_done",
          message:
            "Upload is too large for the server. Try a smaller image or a PDF under about 4 MB, then try again.",
        },
        413,
      )
    }
    return jsonResult(
      {
        ok: false,
        code: "unexpected",
        stage: "extraction_done",
        message: "Something went wrong while processing the scan. Try again or use manual entry.",
      },
      500,
    )
  }

  routeLog("extraction_done", { ok: result.ok })
  routeLog("route_return", { ok: result.ok })
  return jsonResult(result, 200)
}
