import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendContentTimelineEvent } from "@/lib/growth/content/content-events"
import { renderContentTemplate } from "@/lib/growth/content/content-renderer"
import {
  GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER,
  type GrowthContentDashboard,
  type GrowthContentRenderPreviewResult,
  type GrowthContentTemplateType,
} from "@/lib/growth/content/content-types"
import { isBlockedContentVariable } from "@/lib/growth/content/merge-field-validator"
import {
  getApprovedSnippetsByIds,
  listContentApprovalEvents,
  listContentSnippets,
  listContentVariables,
} from "@/lib/growth/content/snippet-repository"
import {
  getContentTemplate,
  listContentTemplates,
} from "@/lib/growth/content/template-repository"

export async function fetchGrowthContentDashboard(admin: SupabaseClient): Promise<GrowthContentDashboard> {
  const [templates, snippetList, variables, approvalEvents] = await Promise.all([
    listContentTemplates(admin, { limit: 100 }),
    listContentSnippets(admin, { limit: 100 }),
    listContentVariables(admin),
    listContentApprovalEvents(admin, { limit: 40 }),
  ])

  return {
    qa_marker: GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER,
    approvedTemplates: templates.filter((t) => t.status === "approved").length,
    pendingReview: templates.filter((t) => t.status === "pending_review").length,
    drafts: templates.filter((t) => t.status === "draft").length,
    snippets: snippetList.filter((s) => s.status === "approved").length,
    unsafeVariablesBlocked: variables.filter((v) => !v.allowed || isBlockedContentVariable(v.variableKey)).length,
    templates,
    snippetList,
    variables,
    approvalEvents,
  }
}

export async function renderContentTemplatePreview(
  admin: SupabaseClient,
  input: {
    templateId: string
    values?: Record<string, string>
    actorUserId?: string | null
  },
): Promise<GrowthContentRenderPreviewResult> {
  const template = await getContentTemplate(admin, input.templateId)
  if (!template?.currentVersion) throw new Error("template_not_found")

  const variables = await listContentVariables(admin)
  const snippets = await getApprovedSnippetsByIds(admin, template.currentVersion.snippetIds)
  let body = template.currentVersion.body
  if (snippets.length > 0) {
    body = `${body}\n\n${snippets.map((s) => s.content).join("\n\n")}`.trim()
  }

  const rendered = renderContentTemplate({
    subject: template.currentVersion.subject,
    body,
    variables,
    values: input.values,
    complianceFooterRequired: template.currentVersion.complianceFooterRequired,
    useExampleValues: true,
  })

  await appendContentTimelineEvent(admin, {
    eventType: "content_render_previewed",
    title: "Content render preview",
    summary: template.name,
    metadata: { template_id: template.id, version_id: template.currentVersion.id },
  })

  return {
    ...rendered,
    templateVersionId: template.currentVersion.id,
  }
}

export async function resolveApprovedTemplateContent(
  admin: SupabaseClient,
  input: {
    templateVersionId?: string | null
    templateId?: string | null
    templateType?: GrowthContentTemplateType
    mergeValues?: Record<string, string>
  },
): Promise<{
  subject: string
  body: string
  templateVersionId: string
  templateId: string
} | null> {
  const { getApprovedTemplateVersionForLiveUse, getContentTemplateVersion } = await import(
    "@/lib/growth/content/template-repository"
  )

  let version = null
  if (input.templateVersionId) {
    version = await getContentTemplateVersion(admin, input.templateVersionId)
    if (!version || version.status !== "approved" || !version.isImmutable) return null
  } else {
    version = await getApprovedTemplateVersionForLiveUse(admin, {
      templateId: input.templateId,
      templateType: input.templateType,
    })
  }
  if (!version) return null

  const template = await getContentTemplate(admin, version.templateId)
  if (!template || template.status !== "approved") return null

  const variables = await listContentVariables(admin)
  const snippets = await getApprovedSnippetsByIds(admin, version.snippetIds)
  let body = version.body
  if (snippets.length > 0) {
    body = `${body}\n\n${snippets.map((s) => s.content).join("\n\n")}`.trim()
  }

  const rendered = renderContentTemplate({
    subject: version.subject,
    body,
    variables,
    values: input.mergeValues,
    complianceFooterRequired: version.complianceFooterRequired,
    useExampleValues: false,
  })

  return {
    subject: rendered.subject,
    body: rendered.body,
    templateVersionId: version.id,
    templateId: version.templateId,
  }
}
