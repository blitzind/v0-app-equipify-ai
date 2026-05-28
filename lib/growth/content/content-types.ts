/** Client-safe Growth Engine content library types (Phase 2S). */

export const GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER = "growth-template-snippet-system-v1" as const

export const GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER =
  "growth-content-library-layout-aligned-v1" as const

export const GROWTH_CONTENT_PRIVACY_NOTE =
  "Content library is platform-admin only. Templates require approval before live send — no autonomous sending, no unapproved promotion, no secrets, no unsafe merge fields."

export const GROWTH_CONTENT_TEMPLATE_TYPES = [
  "sequence_email",
  "reply_draft",
  "booking_followup",
  "manual_call_script",
  "linkedin_manual",
  "sms_future",
  "voicemail_future",
] as const
export type GrowthContentTemplateType = (typeof GROWTH_CONTENT_TEMPLATE_TYPES)[number]

export const GROWTH_CONTENT_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "archived",
  "rejected",
] as const
export type GrowthContentStatus = (typeof GROWTH_CONTENT_STATUSES)[number]

export const GROWTH_CONTENT_SNIPPET_CATEGORIES = [
  "intro",
  "value_prop",
  "case_study",
  "objection",
  "pricing",
  "meeting_request",
  "breakup",
  "compliance_footer",
  "personalization",
  "industry_specific",
] as const
export type GrowthContentSnippetCategory = (typeof GROWTH_CONTENT_SNIPPET_CATEGORIES)[number]

export const GROWTH_CONTENT_VARIABLE_NAMESPACES = [
  "lead",
  "sender",
  "sequence",
  "booking",
  "compliance",
  "custom",
] as const
export type GrowthContentVariableNamespace = (typeof GROWTH_CONTENT_VARIABLE_NAMESPACES)[number]

export const GROWTH_CONTENT_APPROVAL_ENTITY_TYPES = [
  "template",
  "snippet",
  "template_version",
  "snippet_version",
] as const
export type GrowthContentApprovalEntityType = (typeof GROWTH_CONTENT_APPROVAL_ENTITY_TYPES)[number]

export const GROWTH_CONTENT_APPROVAL_EVENT_TYPES = [
  "submitted",
  "approved",
  "rejected",
  "archived",
  "draft_created",
] as const
export type GrowthContentApprovalEventType = (typeof GROWTH_CONTENT_APPROVAL_EVENT_TYPES)[number]

export type GrowthContentTemplateVersion = {
  id: string
  templateId: string
  versionNumber: number
  status: GrowthContentStatus
  subject: string
  body: string
  snippetIds: string[]
  mergeFields: string[]
  complianceFooterRequired: boolean
  isImmutable: boolean
  approvedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthContentTemplate = {
  id: string
  name: string
  templateType: GrowthContentTemplateType
  status: GrowthContentStatus
  description: string
  currentVersionId: string | null
  approvedVersionId: string | null
  complianceFooterRequired: boolean
  currentVersion: GrowthContentTemplateVersion | null
  approvedVersion: GrowthContentTemplateVersion | null
  createdAt: string
  updatedAt: string
}

export type GrowthContentSnippetVersion = {
  id: string
  snippetId: string
  versionNumber: number
  status: GrowthContentStatus
  content: string
  mergeFields: string[]
  isImmutable: boolean
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthContentSnippet = {
  id: string
  name: string
  category: GrowthContentSnippetCategory
  status: GrowthContentStatus
  description: string
  currentVersionId: string | null
  approvedVersionId: string | null
  currentVersion: GrowthContentSnippetVersion | null
  approvedVersion: GrowthContentSnippetVersion | null
  createdAt: string
  updatedAt: string
}

export type GrowthContentVariable = {
  id: string
  variableKey: string
  label: string
  description: string
  namespace: GrowthContentVariableNamespace
  allowed: boolean
  exampleValue: string
  fallbackToken: string
}

export type GrowthContentApprovalEvent = {
  id: string
  entityType: GrowthContentApprovalEntityType
  entityId: string
  eventType: GrowthContentApprovalEventType
  title: string
  description: string
  createdAt: string
}

export type GrowthContentRenderPreviewResult = {
  subject: string
  body: string
  html: string
  warnings: string[]
  blockedVariables: string[]
  missingVariables: string[]
  usedVariables: string[]
  templateVersionId: string | null
  complianceFooterVisible: boolean
}

export type GrowthContentDashboard = {
  qa_marker: typeof GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER
  approvedTemplates: number
  pendingReview: number
  drafts: number
  snippets: number
  unsafeVariablesBlocked: number
  templates: GrowthContentTemplate[]
  snippetList: GrowthContentSnippet[]
  variables: GrowthContentVariable[]
  approvalEvents: GrowthContentApprovalEvent[]
}

export function contentStatusLabel(status: GrowthContentStatus): string {
  switch (status) {
    case "draft":
      return "Draft"
    case "pending_review":
      return "Pending review"
    case "approved":
      return "Approved"
    case "archived":
      return "Archived"
    case "rejected":
      return "Rejected"
    default:
      return status
  }
}

export function templateTypeLabel(type: GrowthContentTemplateType): string {
  return type.replace(/_/g, " ")
}

export function snippetCategoryLabel(category: GrowthContentSnippetCategory): string {
  return category.replace(/_/g, " ")
}

export function mergeFieldSyntax(key: string): string {
  return `{{${key}}}`
}
