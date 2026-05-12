import type { DraftCustomerMessagePreviewPayload } from "@/lib/aiden/actions/resolvers/draft-customer-message-types"

const MAX_SUBJECT = 240
const MAX_BODY = 20_000

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function mergeDraftCustomerMessagePreviewForPatch(
  existingPayload: Record<string, unknown>,
  body: unknown,
): { ok: true; previewPayload: Record<string, unknown> } | { ok: false; message: string } {
  if (!isRecord(body) || !isRecord(body.preview)) {
    return { ok: false, message: "Request must include a preview object." }
  }
  const root = existingPayload
  const prev = root.preview
  if (!isRecord(prev)) {
    return { ok: false, message: "Existing payload is missing preview." }
  }

  const subjectIn = typeof body.preview.subject === "string" ? body.preview.subject.trim() : ""
  const bodyIn = typeof body.preview.body === "string" ? body.preview.body : ""

  if (subjectIn.length < 2) {
    return { ok: false, message: "Subject must be at least 2 characters." }
  }
  if (subjectIn.length > MAX_SUBJECT) {
    return { ok: false, message: `Subject must be at most ${MAX_SUBJECT} characters.` }
  }
  if (bodyIn.length > MAX_BODY) {
    return { ok: false, message: `Body must be at most ${MAX_BODY} characters.` }
  }

  const nextPreview: DraftCustomerMessagePreviewPayload = {
    ...(prev as DraftCustomerMessagePreviewPayload),
    subject: subjectIn,
    body: bodyIn,
  }

  return { ok: true, previewPayload: { ...root, preview: nextPreview } }
}
