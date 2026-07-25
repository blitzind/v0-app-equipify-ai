/**
 * AVA-HOME-REVIEW-QUEUE-1B — Client preview + bulk action helpers (reuse existing APIs).
 */

import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  mapReviewQueueClientError,
  type GrowthHomeReviewQueueRow,
} from "@/lib/growth/home/growth-home-review-queue-1b"

export const GROWTH_HOME_REVIEW_QUEUE_PREVIEW_CLIENT_1B_QA_MARKER =
  "ava-home-review-queue-preview-client-1b-v1" as const

export type GrowthHomeReviewQueuePreviewData = {
  qaMarker: typeof GROWTH_HOME_REVIEW_QUEUE_PREVIEW_CLIENT_1B_QA_MARKER
  companyName: string
  websiteLabel: string
  websiteHref: string | null
  recipient: string | null
  subject: string
  body: string
  mailboxLabel: string | null
  confidenceLabel: string | null
  rationale: string | null
  warnings: string[]
  approvalStateLabel: string
  generationStatus: GrowthAiCopilotGeneration["status"]
  generationId: string
  leadId: string
}

export type GrowthHomeReviewQueueBulkItemResult = {
  rowId: string
  packageId: string
  companyName: string
  ok: boolean
  message: string | null
}

export type GrowthHomeReviewQueueBulkResult = {
  selectedCount: number
  successCount: number
  failureCount: number
  results: GrowthHomeReviewQueueBulkItemResult[]
}

function contactFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const classification = (generation.classification ?? {}) as Record<string, unknown>
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const name = (recommended as { name?: string; email?: string }).name?.trim()
    const email = (recommended as { name?: string; email?: string }).email?.trim()
    if (name && email) return `${name} <${email}>`
    if (email) return email
    if (name) return name
  }

  const contacts = Array.isArray(generation.inputSnapshot?.contactsSupplied)
    ? generation.inputSnapshot.contactsSupplied
    : []
  for (const row of contacts) {
    if (!row || typeof row !== "object") continue
    const contact = row as { name?: string; email?: string; contactabilityStatus?: string }
    if (contact.contactabilityStatus === "contactable" && contact.email?.trim()) {
      return contact.name?.trim()
        ? `${contact.name.trim()} <${contact.email.trim()}>`
        : contact.email.trim()
    }
  }

  return null
}

function confidenceLabelFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const confidence = generation.classification?.confidence
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null
  const percent = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence)
  return `${percent}%`
}

function warningsFromGeneration(generation: GrowthAiCopilotGeneration): string[] {
  const warnings: string[] = []
  if (generation.sentAt) warnings.push("Already sent")
  if (generation.status === "discarded") warnings.push("Discarded")
  const classification = (generation.classification ?? {}) as Record<string, unknown>
  const missing = classification.missingInformation
  if (Array.isArray(missing)) {
    for (const row of missing) {
      if (typeof row === "string" && row.trim()) warnings.push(row.trim())
    }
  }
  return warnings.slice(0, 4)
}

export async function fetchReviewQueueGeneration(
  leadId: string,
  packageId: string,
): Promise<GrowthAiCopilotGeneration> {
  const response = await fetch(`/api/platform/growth/leads/${leadId}/copilot/generations`, {
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    generations?: GrowthAiCopilotGeneration[]
    error?: string
    message?: string
    reviewHref?: string
  }

  if (!response.ok || !payload.ok) {
    throw new Error(
      mapReviewQueueClientError({
        error: payload.error,
        message: payload.message,
        status: response.status,
      }),
    )
  }

  const generation =
    payload.generations?.find((row) => row.id === packageId) ??
    payload.generations?.find((row) => row.status === "draft" || row.status === "approved") ??
    null

  if (!generation) {
    throw new Error(mapReviewQueueClientError({ error: "approval_generation_not_found" }))
  }

  return generation
}

export async function fetchReviewQueuePreview(row: GrowthHomeReviewQueueRow): Promise<GrowthHomeReviewQueuePreviewData> {
  const generation = await fetchReviewQueueGeneration(row.leadId, row.packageId)

  const signatureResponse = await fetch(
    `/api/platform/growth/copilot/generations/${generation.id}/signature-preview`,
    { cache: "no-store" },
  )
  const signaturePayload = (await signatureResponse.json().catch(() => ({}))) as {
    ok?: boolean
    unsignedBody?: string
    signatureText?: string | null
    senderAccountId?: string | null
    message?: string
    error?: string
  }

  let body = generation.generatedContent?.trim() ?? ""
  if (signatureResponse.ok && signaturePayload.ok && signaturePayload.unsignedBody) {
    body = signaturePayload.unsignedBody
    if (signaturePayload.signatureText?.trim()) {
      body = `${body}\n\n${signaturePayload.signatureText.trim()}`
    }
  }

  const approvalStateLabel =
    generation.status === "approved"
      ? "Approved"
      : generation.sentAt
        ? "Sent"
        : generation.status === "draft"
          ? "Awaiting approval"
          : generation.status

  return {
    qaMarker: GROWTH_HOME_REVIEW_QUEUE_PREVIEW_CLIENT_1B_QA_MARKER,
    companyName: row.companyName,
    websiteLabel: row.website.label,
    websiteHref: row.website.href,
    recipient: contactFromGeneration(generation),
    subject: generation.generatedSubject?.trim() || row.subject || "Prepared outreach",
    body,
    mailboxLabel: signaturePayload.senderAccountId ? "Assigned sending mailbox" : "Mailbox assigned at send",
    confidenceLabel: confidenceLabelFromGeneration(generation) ?? (row.fitPercent != null ? `${row.fitPercent}%` : null),
    rationale: row.rationale,
    warnings: warningsFromGeneration(generation),
    approvalStateLabel,
    generationStatus: generation.status,
    generationId: generation.id,
    leadId: generation.leadId,
  }
}

async function approveReviewQueueRow(row: GrowthHomeReviewQueueRow): Promise<GrowthHomeReviewQueueBulkItemResult> {
  try {
    const response = await fetch(`/api/platform/growth/copilot/generations/${row.packageId}`, {
      method: "POST",
    })
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      message?: string
      generation?: GrowthAiCopilotGeneration
    }
    if (!response.ok || !payload.ok) {
      return {
        rowId: row.id,
        packageId: row.packageId,
        companyName: row.companyName,
        ok: false,
        message: mapReviewQueueClientError({
          error: payload.error,
          message: payload.message,
          status: response.status,
        }),
      }
    }
    return {
      rowId: row.id,
      packageId: row.packageId,
      companyName: row.companyName,
      ok: true,
      message: null,
    }
  } catch (error) {
    return {
      rowId: row.id,
      packageId: row.packageId,
      companyName: row.companyName,
      ok: false,
      message: error instanceof Error ? error.message : mapReviewQueueClientError({}),
    }
  }
}

async function sendReviewQueueRow(row: GrowthHomeReviewQueueRow): Promise<GrowthHomeReviewQueueBulkItemResult> {
  try {
    const response = await fetch(`/api/platform/growth/copilot/generations/${row.packageId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanApproved: true, humanApprovalConfirmed: true }),
    })
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      message?: string
    }
    if (!response.ok || !payload.ok) {
      return {
        rowId: row.id,
        packageId: row.packageId,
        companyName: row.companyName,
        ok: false,
        message: mapReviewQueueClientError({
          error: payload.error,
          message: payload.message,
          status: response.status,
        }),
      }
    }
    return {
      rowId: row.id,
      packageId: row.packageId,
      companyName: row.companyName,
      ok: true,
      message: null,
    }
  } catch (error) {
    return {
      rowId: row.id,
      packageId: row.packageId,
      companyName: row.companyName,
      ok: false,
      message: error instanceof Error ? error.message : mapReviewQueueClientError({}),
    }
  }
}

export async function bulkApproveReviewQueueRows(
  rows: GrowthHomeReviewQueueRow[],
): Promise<GrowthHomeReviewQueueBulkResult> {
  const results: GrowthHomeReviewQueueBulkItemResult[] = []
  for (const row of rows) {
    results.push(await approveReviewQueueRow(row))
  }
  return {
    selectedCount: rows.length,
    successCount: results.filter((row) => row.ok).length,
    failureCount: results.filter((row) => !row.ok).length,
    results,
  }
}

export async function bulkSendReviewQueueRows(
  rows: GrowthHomeReviewQueueRow[],
): Promise<GrowthHomeReviewQueueBulkResult> {
  const results: GrowthHomeReviewQueueBulkItemResult[] = []
  for (const row of rows) {
    results.push(await sendReviewQueueRow(row))
  }
  return {
    selectedCount: rows.length,
    successCount: results.filter((row) => row.ok).length,
    failureCount: results.filter((row) => !row.ok).length,
    results,
  }
}

export async function discardReviewQueueRow(row: GrowthHomeReviewQueueRow): Promise<void> {
  const response = await fetch(`/api/platform/growth/copilot/generations/${row.packageId}`, {
    method: "DELETE",
  })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    message?: string
  }
  if (!response.ok || !payload.ok) {
    throw new Error(
      mapReviewQueueClientError({
        error: payload.error,
        message: payload.message,
        status: response.status,
      }),
    )
  }
}
