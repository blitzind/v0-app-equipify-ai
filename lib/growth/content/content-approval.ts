import type {
  GrowthContentApprovalEntityType,
  GrowthContentApprovalEventType,
  GrowthContentStatus,
} from "@/lib/growth/content/content-types"
import { extractContentMergeFields, isBlockedContentVariable } from "@/lib/growth/content/merge-field-validator"
import { requiresComplianceFooter } from "@/lib/growth/content/merge-field-validator"

export function canSubmitTemplateForReview(status: GrowthContentStatus): boolean {
  return status === "draft" || status === "rejected"
}

export function canApproveTemplate(status: GrowthContentStatus): boolean {
  return status === "pending_review"
}

export function canRejectTemplate(status: GrowthContentStatus): boolean {
  return status === "pending_review"
}

export function canEditTemplateVersion(isImmutable: boolean): boolean {
  return !isImmutable
}

export function nextVersionNumber(currentMax: number): number {
  return currentMax + 1
}

export function validateTemplateForSubmission(input: {
  subject: string
  body: string
  allowedKeys: Set<string>
  complianceFooterRequired?: boolean
}): { ok: true } | { ok: false; reason: string } {
  const fields = [...extractContentMergeFields(input.subject), ...extractContentMergeFields(input.body)]
  const blocked = fields.filter(isBlockedContentVariable)
  if (blocked.length > 0) {
    return { ok: false, reason: `Unsafe merge fields blocked: ${blocked.join(", ")}` }
  }

  const unknown = fields.filter((key) => !input.allowedKeys.has(key))
  if (unknown.length > 0) {
    return { ok: false, reason: `Unknown merge fields: ${unknown.join(", ")}` }
  }

  if (input.complianceFooterRequired !== false && !requiresComplianceFooter(input.body)) {
    return {
      ok: false,
      reason: "Compliance footer required — include {{unsubscribe.link}} merge field in body.",
    }
  }

  if (!input.body.trim()) {
    return { ok: false, reason: "Template body is required." }
  }

  return { ok: true }
}

export function validateSnippetForApproval(input: {
  content: string
  allowedKeys: Set<string>
}): { ok: true } | { ok: false; reason: string } {
  const fields = extractContentMergeFields(input.content)
  const blocked = fields.filter(isBlockedContentVariable)
  if (blocked.length > 0) {
    return { ok: false, reason: `Unsafe merge fields blocked: ${blocked.join(", ")}` }
  }
  const unknown = fields.filter((key) => !input.allowedKeys.has(key))
  if (unknown.length > 0) {
    return { ok: false, reason: `Unknown merge fields: ${unknown.join(", ")}` }
  }
  if (!input.content.trim()) {
    return { ok: false, reason: "Snippet content is required." }
  }
  return { ok: true }
}

export function approvalEventTitle(
  entityType: GrowthContentApprovalEntityType,
  eventType: GrowthContentApprovalEventType,
  entityName: string,
): string {
  switch (eventType) {
    case "submitted":
      return `${entityType} submitted for review: ${entityName}`
    case "approved":
      return `${entityType} approved: ${entityName}`
    case "rejected":
      return `${entityType} rejected: ${entityName}`
    case "archived":
      return `${entityType} archived: ${entityName}`
    case "draft_created":
      return `New draft version created: ${entityName}`
    default:
      return `${entityType} ${eventType}: ${entityName}`
  }
}
