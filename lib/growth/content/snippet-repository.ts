import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { approvalEventTitle, validateSnippetForApproval } from "@/lib/growth/content/content-approval"
import { appendContentTimelineEvent, recordContentApprovalEvent } from "@/lib/growth/content/content-events"
import { extractContentMergeFields } from "@/lib/growth/content/merge-field-validator"
import type {
  GrowthContentApprovalEvent,
  GrowthContentSnippet,
  GrowthContentSnippetCategory,
  GrowthContentSnippetVersion,
  GrowthContentStatus,
  GrowthContentVariable,
} from "@/lib/growth/content/content-types"
import { buildAllowedVariableKeySet } from "@/lib/growth/content/variable-registry"

function snippetsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_snippets")
}

function snippetVersionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_snippet_versions")
}

function variablesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_variable_registry")
}

function approvalEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("content_approval_events")
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

function mapVariable(row: Record<string, unknown>): GrowthContentVariable {
  return {
    id: asString(row.id),
    variableKey: asString(row.variable_key),
    label: asString(row.label),
    description: asString(row.description),
    namespace: asString(row.namespace) as GrowthContentVariable["namespace"],
    allowed: row.allowed !== false,
    exampleValue: asString(row.example_value),
    fallbackToken: asString(row.fallback_token) || "[missing]",
  }
}

function mapSnippetVersion(row: Record<string, unknown>): GrowthContentSnippetVersion {
  return {
    id: asString(row.id),
    snippetId: asString(row.snippet_id),
    versionNumber: asNumber(row.version_number, 1),
    status: asString(row.status) as GrowthContentStatus,
    content: asString(row.content),
    mergeFields: asStringArray(row.merge_fields),
    isImmutable: Boolean(row.is_immutable),
    approvedAt: asString(row.approved_at) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapSnippet(
  row: Record<string, unknown>,
  currentVersion: GrowthContentSnippetVersion | null = null,
  approvedVersion: GrowthContentSnippetVersion | null = null,
): GrowthContentSnippet {
  return {
    id: asString(row.id),
    name: asString(row.name),
    category: asString(row.category) as GrowthContentSnippetCategory,
    status: asString(row.status) as GrowthContentStatus,
    description: asString(row.description),
    currentVersionId: asString(row.current_version_id) || null,
    approvedVersionId: asString(row.approved_version_id) || null,
    currentVersion,
    approvedVersion,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

async function loadSnippetWithVersions(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthContentSnippet> {
  const currentId = asString(row.current_version_id)
  const approvedId = asString(row.approved_version_id)
  let currentVersion: GrowthContentSnippetVersion | null = null
  let approvedVersion: GrowthContentSnippetVersion | null = null
  if (currentId) {
    const { data } = await snippetVersionsTable(admin).select("*").eq("id", currentId).maybeSingle()
    if (data) currentVersion = mapSnippetVersion(data as Record<string, unknown>)
  }
  if (approvedId) {
    const { data } = await snippetVersionsTable(admin).select("*").eq("id", approvedId).maybeSingle()
    if (data) approvedVersion = mapSnippetVersion(data as Record<string, unknown>)
  }
  return mapSnippet(row, currentVersion, approvedVersion)
}

export async function listContentVariables(admin: SupabaseClient): Promise<GrowthContentVariable[]> {
  const { data, error } = await variablesTable(admin).select("*").order("namespace").order("variable_key")
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapVariable)
}

export async function listContentApprovalEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthContentApprovalEvent[]> {
  let query = approvalEventsTable(admin).select("*").order("created_at", { ascending: false })
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: asString(row.id),
    entityType: asString(row.entity_type) as GrowthContentApprovalEvent["entityType"],
    entityId: asString(row.entity_id),
    eventType: asString(row.event_type) as GrowthContentApprovalEvent["eventType"],
    title: asString(row.title),
    description: asString(row.description),
    createdAt: asString(row.created_at),
  }))
}

export async function listContentSnippets(
  admin: SupabaseClient,
  input?: { status?: GrowthContentStatus; category?: GrowthContentSnippetCategory; limit?: number },
): Promise<GrowthContentSnippet[]> {
  let query = snippetsTable(admin).select("*").order("updated_at", { ascending: false })
  if (input?.status) query = query.eq("status", input.status)
  if (input?.category) query = query.eq("category", input.category)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return Promise.all(((data ?? []) as Record<string, unknown>[]).map((row) => loadSnippetWithVersions(admin, row)))
}

export async function getContentSnippet(
  admin: SupabaseClient,
  snippetId: string,
): Promise<GrowthContentSnippet | null> {
  const { data, error } = await snippetsTable(admin).select("*").eq("id", snippetId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return loadSnippetWithVersions(admin, data as Record<string, unknown>)
}

export async function getContentSnippetVersion(
  admin: SupabaseClient,
  versionId: string,
): Promise<GrowthContentSnippetVersion | null> {
  const { data, error } = await snippetVersionsTable(admin).select("*").eq("id", versionId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSnippetVersion(data as Record<string, unknown>)
}

export async function createContentSnippet(
  admin: SupabaseClient,
  input: {
    name: string
    category: GrowthContentSnippetCategory
    description?: string
    content?: string
    actorUserId?: string | null
  },
): Promise<GrowthContentSnippet> {
  const now = new Date().toISOString()
  const { data: snippetRow, error: snippetError } = await snippetsTable(admin)
    .insert({
      name: input.name.trim(),
      category: input.category,
      status: "draft",
      description: input.description?.trim() ?? "",
      updated_at: now,
    })
    .select("*")
    .single()
  if (snippetError) throw new Error(snippetError.message)

  const content = input.content?.trim() ?? ""
  const mergeFields = extractContentMergeFields(content)
  const { data: versionRow, error: versionError } = await snippetVersionsTable(admin)
    .insert({
      snippet_id: asString((snippetRow as Record<string, unknown>).id),
      version_number: 1,
      status: "draft",
      content,
      merge_fields: mergeFields,
      created_by: input.actorUserId ?? null,
      updated_at: now,
    })
    .select("*")
    .single()
  if (versionError) throw new Error(versionError.message)

  const versionId = asString((versionRow as Record<string, unknown>).id)
  await snippetsTable(admin)
    .update({ current_version_id: versionId, updated_at: now })
    .eq("id", asString((snippetRow as Record<string, unknown>).id))

  return getContentSnippet(admin, asString((snippetRow as Record<string, unknown>).id)) as Promise<GrowthContentSnippet>
}

export async function updateContentSnippet(
  admin: SupabaseClient,
  snippetId: string,
  input: { name?: string; description?: string; content?: string; actorUserId?: string | null },
): Promise<GrowthContentSnippet> {
  const existing = await getContentSnippet(admin, snippetId)
  if (!existing?.currentVersion) throw new Error("snippet_not_found")

  const content = input.content ?? existing.currentVersion.content
  const mergeFields = extractContentMergeFields(content)
  const now = new Date().toISOString()

  await snippetVersionsTable(admin)
    .update({ content, merge_fields: mergeFields, status: "draft", updated_at: now })
    .eq("id", existing.currentVersion.id)

  await snippetsTable(admin)
    .update({
      name: input.name?.trim() ?? existing.name,
      description: input.description?.trim() ?? existing.description,
      status: "draft",
      updated_at: now,
    })
    .eq("id", snippetId)

  return getContentSnippet(admin, snippetId) as Promise<GrowthContentSnippet>
}

export async function approveContentSnippet(
  admin: SupabaseClient,
  input: { snippetId: string; actorUserId: string },
): Promise<GrowthContentSnippet> {
  const snippet = await getContentSnippet(admin, input.snippetId)
  if (!snippet?.currentVersion) throw new Error("snippet_not_found")

  const variables = await listContentVariables(admin)
  const validation = validateSnippetForApproval({
    content: snippet.currentVersion.content,
    allowedKeys: buildAllowedVariableKeySet(variables),
  })
  if (!validation.ok) throw new Error(validation.reason)

  const now = new Date().toISOString()
  await snippetVersionsTable(admin)
    .update({
      status: "approved",
      is_immutable: true,
      approved_by: input.actorUserId,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", snippet.currentVersion.id)

  await snippetsTable(admin)
    .update({
      status: "approved",
      approved_version_id: snippet.currentVersion.id,
      updated_at: now,
    })
    .eq("id", input.snippetId)

  await recordContentApprovalEvent(admin, {
    entityType: "snippet",
    entityId: input.snippetId,
    eventType: "approved",
    actorUserId: input.actorUserId,
    title: approvalEventTitle("snippet", "approved", snippet.name),
  })
  await appendContentTimelineEvent(admin, {
    eventType: "content_snippet_approved",
    title: "Snippet approved",
    summary: snippet.name,
  })

  return getContentSnippet(admin, input.snippetId) as Promise<GrowthContentSnippet>
}

export async function getApprovedSnippetsByIds(
  admin: SupabaseClient,
  snippetIds: string[],
): Promise<Array<{ id: string; content: string; versionId: string }>> {
  const results: Array<{ id: string; content: string; versionId: string }> = []
  for (const snippetId of snippetIds) {
    const snippet = await getContentSnippet(admin, snippetId)
    if (!snippet?.approvedVersion) continue
    results.push({
      id: snippet.id,
      content: snippet.approvedVersion.content,
      versionId: snippet.approvedVersion.id,
    })
  }
  return results
}
