import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  approvalEventTitle,
  canApproveTemplate,
  canEditTemplateVersion,
  canRejectTemplate,
  canSubmitTemplateForReview,
  nextVersionNumber,
  validateTemplateForSubmission,
} from "@/lib/growth/content/content-approval"
import { appendContentTimelineEvent, recordContentApprovalEvent } from "@/lib/growth/content/content-events"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type {
  GrowthContentStatus,
  GrowthContentTemplate,
  GrowthContentTemplateType,
  GrowthContentTemplateVersion,
} from "@/lib/growth/content/content-types"
import { buildAllowedVariableKeySet } from "@/lib/growth/content/variable-registry"
import { listContentVariables } from "@/lib/growth/content/snippet-repository"

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_templates")
}

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_template_versions")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

function mapVersion(row: Record<string, unknown>): GrowthContentTemplateVersion {
  return {
    id: asString(row.id),
    templateId: asString(row.template_id),
    versionNumber: asNumber(row.version_number, 1),
    status: asString(row.status) as GrowthContentStatus,
    subject: asString(row.subject),
    body: asString(row.body),
    snippetIds: asStringArray(row.snippet_ids),
    mergeFields: asStringArray(row.merge_fields),
    complianceFooterRequired: row.compliance_footer_required !== false,
    isImmutable: Boolean(row.is_immutable),
    approvedAt: asString(row.approved_at) || null,
    rejectionReason: asString(row.rejection_reason) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapTemplate(
  row: Record<string, unknown>,
  currentVersion: GrowthContentTemplateVersion | null = null,
  approvedVersion: GrowthContentTemplateVersion | null = null,
): GrowthContentTemplate {
  return {
    id: asString(row.id),
    name: asString(row.name),
    templateType: asString(row.template_type) as GrowthContentTemplateType,
    status: asString(row.status) as GrowthContentStatus,
    description: asString(row.description),
    currentVersionId: asString(row.current_version_id) || null,
    approvedVersionId: asString(row.approved_version_id) || null,
    complianceFooterRequired: row.compliance_footer_required !== false,
    currentVersion,
    approvedVersion,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

async function loadVersionsForTemplate(
  admin: SupabaseClient,
  template: Record<string, unknown>,
): Promise<GrowthContentTemplate> {
  const currentId = asString(template.current_version_id)
  const approvedId = asString(template.approved_version_id)
  let currentVersion: GrowthContentTemplateVersion | null = null
  let approvedVersion: GrowthContentTemplateVersion | null = null

  if (currentId) {
    const { data } = await versionsTable(admin).select("*").eq("id", currentId).maybeSingle()
    if (data) currentVersion = mapVersion(data as Record<string, unknown>)
  }
  if (approvedId) {
    const { data } = await versionsTable(admin).select("*").eq("id", approvedId).maybeSingle()
    if (data) approvedVersion = mapVersion(data as Record<string, unknown>)
  }

  return mapTemplate(template, currentVersion, approvedVersion)
}

export async function listContentTemplates(
  admin: SupabaseClient,
  input?: { status?: GrowthContentStatus; templateType?: GrowthContentTemplateType; limit?: number },
): Promise<GrowthContentTemplate[]> {
  let query = templatesTable(admin).select("*").order("updated_at", { ascending: false })
  if (input?.status) query = query.eq("status", input.status)
  if (input?.templateType) query = query.eq("template_type", input.templateType)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as Record<string, unknown>[]
  return Promise.all(rows.map((row) => loadVersionsForTemplate(admin, row)))
}

export async function getContentTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthContentTemplate | null> {
  const { data, error } = await templatesTable(admin).select("*").eq("id", templateId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return loadVersionsForTemplate(admin, data as Record<string, unknown>)
}

export async function getContentTemplateVersion(
  admin: SupabaseClient,
  versionId: string,
): Promise<GrowthContentTemplateVersion | null> {
  const { data, error } = await versionsTable(admin).select("*").eq("id", versionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapVersion(data as Record<string, unknown>)
}

export async function listContentTemplateVersions(
  admin: SupabaseClient,
  templateId: string,
): Promise<GrowthContentTemplateVersion[]> {
  const { data, error } = await versionsTable(admin)
    .select("*")
    .eq("template_id", templateId)
    .order("version_number", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapVersion)
}

export async function createContentTemplate(
  admin: SupabaseClient,
  input: {
    name: string
    templateType: GrowthContentTemplateType
    description?: string
    subject?: string
    body?: string
    complianceFooterRequired?: boolean
    actorUserId?: string | null
  },
): Promise<GrowthContentTemplate> {
  const now = new Date().toISOString()
  const { data: templateRow, error: templateError } = await templatesTable(admin)
    .insert({
      name: input.name.trim(),
      template_type: input.templateType,
      status: "draft",
      description: input.description?.trim() ?? "",
      compliance_footer_required: input.complianceFooterRequired ?? true,
      updated_at: now,
    })
    .select("*")
    .single()
  if (templateError) throw new Error(templateError.message)

  const body = input.body?.trim() ?? ""
  const subject = input.subject?.trim() ?? ""
  const mergeFields = [...new Set([...extractContentMergeFields(subject), ...extractContentMergeFields(body)])]

  const { data: versionRow, error: versionError } = await versionsTable(admin)
    .insert({
      template_id: asString((templateRow as Record<string, unknown>).id),
      version_number: 1,
      status: "draft",
      subject,
      body,
      merge_fields: mergeFields,
      compliance_footer_required: input.complianceFooterRequired ?? true,
      created_by: input.actorUserId ?? null,
      updated_at: now,
    })
    .select("*")
    .single()
  if (versionError) throw new Error(versionError.message)

  const versionId = asString((versionRow as Record<string, unknown>).id)
  await templatesTable(admin)
    .update({ current_version_id: versionId, updated_at: now })
    .eq("id", asString((templateRow as Record<string, unknown>).id))

  await appendContentTimelineEvent(admin, {
    eventType: "content_template_created",
    title: "Content template created",
    summary: input.name,
    metadata: { template_type: input.templateType },
  })

  return getContentTemplate(admin, asString((templateRow as Record<string, unknown>).id)) as Promise<GrowthContentTemplate>
}

export async function updateContentTemplate(
  admin: SupabaseClient,
  templateId: string,
  input: {
    name?: string
    description?: string
    subject?: string
    body?: string
    snippetIds?: string[]
    complianceFooterRequired?: boolean
    actorUserId?: string | null
  },
): Promise<GrowthContentTemplate> {
  const existing = await getContentTemplate(admin, templateId)
  if (!existing) throw new Error("template_not_found")

  const currentVersion = existing.currentVersion
  if (!currentVersion) throw new Error("version_not_found")
  if (!canEditTemplateVersion(currentVersion.isImmutable)) {
    await createDraftVersionFromApproved(admin, templateId, input)
    return getContentTemplate(admin, templateId) as Promise<GrowthContentTemplate>
  }

  const now = new Date().toISOString()
  const subject = input.subject ?? currentVersion.subject
  const body = input.body ?? currentVersion.body
  const mergeFields = [...new Set([...extractContentMergeFields(subject), ...extractContentMergeFields(body)])]

  await versionsTable(admin)
    .update({
      subject,
      body,
      snippet_ids: input.snippetIds ?? currentVersion.snippetIds,
      merge_fields: mergeFields,
      compliance_footer_required: input.complianceFooterRequired ?? currentVersion.complianceFooterRequired,
      updated_at: now,
    })
    .eq("id", currentVersion.id)

  if (input.name || input.description != null || input.complianceFooterRequired != null) {
    await templatesTable(admin)
      .update({
        name: input.name?.trim() ?? existing.name,
        description: input.description?.trim() ?? existing.description,
        compliance_footer_required: input.complianceFooterRequired ?? existing.complianceFooterRequired,
        status: "draft",
        updated_at: now,
      })
      .eq("id", templateId)
  }

  return getContentTemplate(admin, templateId) as Promise<GrowthContentTemplate>
}

async function createDraftVersionFromApproved(
  admin: SupabaseClient,
  templateId: string,
  input: {
    name?: string
    description?: string
    subject?: string
    body?: string
    snippetIds?: string[]
    complianceFooterRequired?: boolean
    actorUserId?: string | null
  },
): Promise<GrowthContentTemplateVersion> {
  const existing = await getContentTemplate(admin, templateId)
  if (!existing?.approvedVersion) throw new Error("approved_version_not_found")

  const versions = await listContentTemplateVersions(admin, templateId)
  const maxVersion = versions.reduce((max, v) => Math.max(max, v.versionNumber), 0)
  const base = existing.approvedVersion
  const subject = input.subject ?? base.subject
  const body = input.body ?? base.body
  const mergeFields = [...new Set([...extractContentMergeFields(subject), ...extractContentMergeFields(body)])]
  const now = new Date().toISOString()

  const { data, error } = await versionsTable(admin)
    .insert({
      template_id: templateId,
      version_number: nextVersionNumber(maxVersion),
      status: "draft",
      subject,
      body,
      snippet_ids: input.snippetIds ?? base.snippetIds,
      merge_fields: mergeFields,
      compliance_footer_required: input.complianceFooterRequired ?? base.complianceFooterRequired,
      created_by: input.actorUserId ?? null,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const version = mapVersion(data as Record<string, unknown>)
  await templatesTable(admin)
    .update({
      current_version_id: version.id,
      status: "draft",
      name: input.name?.trim() ?? existing.name,
      description: input.description?.trim() ?? existing.description,
      updated_at: now,
    })
    .eq("id", templateId)

  await recordContentApprovalEvent(admin, {
    entityType: "template_version",
    entityId: version.id,
    eventType: "draft_created",
    actorUserId: input.actorUserId,
    title: approvalEventTitle("template_version", "draft_created", existing.name),
    description: "New draft version created from approved template.",
  })

  return version
}

export async function submitContentTemplateForReview(
  admin: SupabaseClient,
  input: { templateId: string; actorUserId: string },
): Promise<GrowthContentTemplate> {
  const template = await getContentTemplate(admin, input.templateId)
  if (!template) throw new Error("template_not_found")
  if (!canSubmitTemplateForReview(template.status)) throw new Error("invalid_status")
  const version = template.currentVersion
  if (!version) throw new Error("version_not_found")

  const variables = await listContentVariables(admin)
  const allowedKeys = buildAllowedVariableKeySet(variables)
  const validation = validateTemplateForSubmission({
    subject: version.subject,
    body: version.body,
    allowedKeys,
    complianceFooterRequired: version.complianceFooterRequired,
  })
  if (!validation.ok) throw new Error(validation.reason)

  const now = new Date().toISOString()
  await versionsTable(admin).update({ status: "pending_review", updated_at: now }).eq("id", version.id)
  await templatesTable(admin).update({ status: "pending_review", updated_at: now }).eq("id", input.templateId)

  await recordContentApprovalEvent(admin, {
    entityType: "template",
    entityId: input.templateId,
    eventType: "submitted",
    actorUserId: input.actorUserId,
    title: approvalEventTitle("template", "submitted", template.name),
  })
  await appendContentTimelineEvent(admin, {
    eventType: "content_template_submitted",
    title: "Template submitted for review",
    summary: template.name,
  })

  return getContentTemplate(admin, input.templateId) as Promise<GrowthContentTemplate>
}

export async function approveContentTemplate(
  admin: SupabaseClient,
  input: { templateId: string; actorUserId: string },
): Promise<GrowthContentTemplate> {
  const template = await getContentTemplate(admin, input.templateId)
  if (!template) throw new Error("template_not_found")
  if (!canApproveTemplate(template.status)) throw new Error("invalid_status")
  const version = template.currentVersion
  if (!version) throw new Error("version_not_found")

  const now = new Date().toISOString()
  await versionsTable(admin)
    .update({
      status: "approved",
      is_immutable: true,
      approved_by: input.actorUserId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", version.id)

  await templatesTable(admin)
    .update({
      status: "approved",
      approved_version_id: version.id,
      updated_at: now,
    })
    .eq("id", input.templateId)

  await recordContentApprovalEvent(admin, {
    entityType: "template",
    entityId: input.templateId,
    eventType: "approved",
    actorUserId: input.actorUserId,
    title: approvalEventTitle("template", "approved", template.name),
    metadata: { version_id: version.id, version_number: version.versionNumber },
  })
  await appendContentTimelineEvent(admin, {
    eventType: "content_template_approved",
    title: "Template approved",
    summary: template.name,
    metadata: { version_id: version.id },
  })

  return getContentTemplate(admin, input.templateId) as Promise<GrowthContentTemplate>
}

export async function rejectContentTemplate(
  admin: SupabaseClient,
  input: { templateId: string; actorUserId: string; reason?: string },
): Promise<GrowthContentTemplate> {
  const template = await getContentTemplate(admin, input.templateId)
  if (!template) throw new Error("template_not_found")
  if (!canRejectTemplate(template.status)) throw new Error("invalid_status")
  const version = template.currentVersion
  if (!version) throw new Error("version_not_found")

  const now = new Date().toISOString()
  await versionsTable(admin)
    .update({
      status: "rejected",
      rejection_reason: input.reason?.slice(0, 500) ?? null,
      updated_at: now,
    })
    .eq("id", version.id)
  await templatesTable(admin).update({ status: "rejected", updated_at: now }).eq("id", input.templateId)

  await recordContentApprovalEvent(admin, {
    entityType: "template",
    entityId: input.templateId,
    eventType: "rejected",
    actorUserId: input.actorUserId,
    title: approvalEventTitle("template", "rejected", template.name),
    description: input.reason,
  })
  await appendContentTimelineEvent(admin, {
    eventType: "content_template_rejected",
    title: "Template rejected",
    summary: input.reason ?? template.name,
  })

  return getContentTemplate(admin, input.templateId) as Promise<GrowthContentTemplate>
}

export async function getApprovedTemplateVersionForLiveUse(
  admin: SupabaseClient,
  input: { templateId?: string | null; versionId?: string | null; templateType?: GrowthContentTemplateType },
): Promise<GrowthContentTemplateVersion | null> {
  if (input.versionId) {
    const version = await getContentTemplateVersion(admin, input.versionId)
    if (!version || version.status !== "approved" || !version.isImmutable) return null
    return version
  }
  if (!input.templateId) return null
  const template = await getContentTemplate(admin, input.templateId)
  if (!template || template.status !== "approved") return null
  if (input.templateType && template.templateType !== input.templateType) return null
  return template.approvedVersion
}
