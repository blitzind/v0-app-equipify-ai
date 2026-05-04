import { NextResponse } from "next/server"
import {
  ConfigError,
  generateTemplateDraftFromCertificateFile,
} from "@/lib/calibration-templates/openai-generate-template"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_BYTES = 20 * 1024 * 1024

const ALLOWED_MIME = new Set(["application/pdf", "image/png", "image/jpeg"])

function resolveMime(file: File): string | null {
  const raw = (file.type || "").trim().toLowerCase()
  if (raw === "image/jpg") return "image/jpeg"
  if (raw && ALLOWED_MIME.has(raw)) return raw

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "pdf") return "application/pdf"
  if (ext === "png") return "image/png"
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg"
  return null
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const entry = form.get("file")
    if (!entry || !(entry instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 })
    }

    if (entry.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File is too large (max ${Math.round(MAX_BYTES / (1024 * 1024))} MB).` },
        { status: 400 },
      )
    }

    const mimeType = resolveMime(entry)
    if (!mimeType) {
      return NextResponse.json(
        { error: "Invalid file type. Use PDF, PNG, or JPEG." },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await entry.arrayBuffer())
    const draft = await generateTemplateDraftFromCertificateFile({
      buffer,
      fileName: entry.name || "certificate",
      mimeType,
    })

    return NextResponse.json({
      suggestedName: draft.suggestedName,
      equipmentCategoryId: draft.equipmentCategoryId,
      fields: draft.fields,
      confidenceMessage: draft.confidenceMessage,
      extractionWarnings: draft.extractionWarnings,
    })
  } catch (e) {
    if (e instanceof ConfigError) {
      return NextResponse.json({ error: e.message }, { status: 503 })
    }
    const msg = e instanceof Error ? e.message : "Import failed. Try again."
    return NextResponse.json({ error: msg }, { status: 422 })
  }
}
