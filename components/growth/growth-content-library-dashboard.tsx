"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  contentStatusLabel,
  GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER,
  GROWTH_CONTENT_PRIVACY_NOTE,
  GROWTH_CONTENT_SNIPPET_CATEGORIES,
  GROWTH_CONTENT_TEMPLATE_TYPES,
  GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER,
  snippetCategoryLabel,
  templateTypeLabel,
  type GrowthContentDashboard,
  type GrowthContentRenderPreviewResult,
  type GrowthContentTemplate,
} from "@/lib/growth/content/content-types"

type TabKey = "templates" | "snippets" | "variables" | "approvals" | "preview"

const STATUS_TONE: Record<string, "healthy" | "attention" | "critical" | "neutral" | "blocked" | "medium"> = {
  draft: "neutral",
  pending_review: "attention",
  approved: "healthy",
  archived: "blocked",
  rejected: "critical",
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function GrowthContentLibraryDashboardView() {
  const [tab, setTab] = useState<TabKey>("templates")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<GrowthContentDashboard | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [preview, setPreview] = useState<GrowthContentRenderPreviewResult | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newSnippetName, setNewSnippetName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/platform/growth/content/dashboard", { cache: "no-store" })
      const payload = (await response.json()) as { ok?: boolean; dashboard?: GrowthContentDashboard; message?: string }
      if (!response.ok || !payload.ok || !payload.dashboard) {
        throw new Error(payload.message ?? "Could not load content library.")
      }
      setDashboard(payload.dashboard)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load content library.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createTemplate() {
    if (!newTemplateName.trim()) return
    setActionId("create-template")
    try {
      const response = await fetch("/api/platform/growth/content/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          templateType: "sequence_email",
          body: "Hi {{lead.contact_name}},\n\nQuick note for {{lead.company_name}}.\n\n{{unsubscribe.link}}",
        }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not create template.")
      setNewTemplateName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActionId(null)
    }
  }

  async function createSnippet() {
    if (!newSnippetName.trim()) return
    setActionId("create-snippet")
    try {
      const response = await fetch("/api/platform/growth/content/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSnippetName.trim(), category: "intro", content: "Teams like {{lead.company_name}} often..." }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not create snippet.")
      setNewSnippetName("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setActionId(null)
    }
  }

  async function templateAction(template: GrowthContentTemplate, action: "submit" | "approve" | "reject" | "preview") {
    setActionId(template.id)
    setError(null)
    try {
      if (action === "preview") {
        const response = await fetch(`/api/platform/growth/content/templates/${template.id}/render-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
        const payload = (await response.json()) as { preview?: GrowthContentRenderPreviewResult; message?: string }
        if (!response.ok || !payload.preview) throw new Error(payload.message ?? "Preview failed.")
        setPreview(payload.preview)
        setSelectedTemplateId(template.id)
        setTab("preview")
        return
      }

      const needsConfirm = action === "approve" || action === "reject"
      const response = await fetch(`/api/platform/growth/content/templates/${template.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsConfirm ? { humanApprovalConfirmed: true } : {}),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? `Could not ${action} template.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActionId(null)
    }
  }

  async function approveSnippet(snippetId: string) {
    setActionId(snippetId)
    try {
      const response = await fetch(`/api/platform/growth/content/snippets/${snippetId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ humanApprovalConfirmed: true }),
      })
      const payload = (await response.json()) as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? "Could not approve snippet.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed.")
    } finally {
      setActionId(null)
    }
  }

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "templates", label: "Templates" },
    { key: "snippets", label: "Snippets" },
    { key: "variables", label: "Variables" },
    { key: "approvals", label: "Approvals" },
    { key: "preview", label: "Preview" },
  ]

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-qa={GROWTH_CONTENT_LIBRARY_LAYOUT_ALIGNED_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {GROWTH_TEMPLATE_SNIPPET_SYSTEM_QA_MARKER} · {GROWTH_CONTENT_PRIVACY_NOTE}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/growth/copilot/personalization">AI Personalization</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      ) : null}

      {loading && !dashboard ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading content library…
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Approved Templates" value={String(dashboard.approvedTemplates)} />
            <StatTile label="Pending Review" value={String(dashboard.pendingReview)} />
            <StatTile label="Drafts" value={String(dashboard.drafts)} />
            <StatTile label="Snippets" value={String(dashboard.snippets)} />
            <StatTile label="Unsafe Variables Blocked" value={String(dashboard.unsafeVariablesBlocked)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <Button
                key={item.key}
                variant={tab === item.key ? "default" : "outline"}
                size="sm"
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {tab === "templates" ? (
            <>
              <GrowthEngineCard title="Create template">
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Template name"
                    className="max-w-xs"
                  />
                  <Button onClick={() => void createTemplate()} disabled={actionId === "create-template"}>
                    {actionId === "create-template" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Create draft
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Types: {GROWTH_CONTENT_TEMPLATE_TYPES.join(", ")}. Approval required before live send.
                </p>
              </GrowthEngineCard>

              <GrowthEngineCard title="Templates">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Version</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.templates.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
                            No templates yet.
                          </td>
                        </tr>
                      ) : (
                        dashboard.templates.map((template) => (
                          <tr key={template.id} className="border-b border-border/50 align-top">
                            <td className="py-2 pr-3">
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-muted-foreground">{template.description || "—"}</div>
                            </td>
                            <td className="py-2 pr-3">{templateTypeLabel(template.templateType)}</td>
                            <td className="py-2 pr-3">
                              <GrowthBadge label={contentStatusLabel(template.status)} tone={STATUS_TONE[template.status] ?? "neutral"} />
                            </td>
                            <td className="py-2 pr-3">v{template.currentVersion?.versionNumber ?? 1}</td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                <Button variant="outline" size="sm" disabled={actionId === template.id} onClick={() => void templateAction(template, "preview")}>
                                  Preview
                                </Button>
                                {template.status === "draft" || template.status === "rejected" ? (
                                  <Button variant="outline" size="sm" disabled={actionId === template.id} onClick={() => void templateAction(template, "submit")}>
                                    Submit
                                  </Button>
                                ) : null}
                                {template.status === "pending_review" ? (
                                  <>
                                    <Button variant="outline" size="sm" disabled={actionId === template.id} onClick={() => void templateAction(template, "approve")}>
                                      Approve
                                    </Button>
                                    <Button variant="ghost" size="sm" disabled={actionId === template.id} onClick={() => void templateAction(template, "reject")}>
                                      Reject
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GrowthEngineCard>
            </>
          ) : null}

          {tab === "snippets" ? (
            <>
              <GrowthEngineCard title="Create snippet">
                <div className="flex flex-wrap gap-2">
                  <Input value={newSnippetName} onChange={(e) => setNewSnippetName(e.target.value)} placeholder="Snippet name" className="max-w-xs" />
                  <Button onClick={() => void createSnippet()} disabled={actionId === "create-snippet"}>
                    {actionId === "create-snippet" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Create snippet
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Categories: {GROWTH_CONTENT_SNIPPET_CATEGORIES.join(", ")}</p>
              </GrowthEngineCard>

              <GrowthEngineCard title="Snippet library">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.snippetList.map((snippet) => (
                        <tr key={snippet.id} className="border-b border-border/50">
                          <td className="py-2 pr-3">{snippet.name}</td>
                          <td className="py-2 pr-3">{snippetCategoryLabel(snippet.category)}</td>
                          <td className="py-2 pr-3">
                            <GrowthBadge label={contentStatusLabel(snippet.status)} tone={STATUS_TONE[snippet.status] ?? "neutral"} />
                          </td>
                          <td className="py-2">
                            {snippet.status !== "approved" ? (
                              <Button variant="outline" size="sm" disabled={actionId === snippet.id} onClick={() => void approveSnippet(snippet.id)}>
                                Approve
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Approved v{snippet.approvedVersion?.versionNumber ?? 1}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GrowthEngineCard>
            </>
          ) : null}

          {tab === "variables" ? (
            <GrowthEngineCard title="Allowlisted merge variables">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3">Variable</th>
                      <th className="py-2 pr-3">Label</th>
                      <th className="py-2 pr-3">Namespace</th>
                      <th className="py-2 pr-3">Example</th>
                      <th className="py-2">Fallback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.variables.map((variable) => (
                      <tr key={variable.id} className="border-b border-border/50">
                        <td className="py-2 pr-3 font-mono text-xs">{`{{${variable.variableKey}}}`}</td>
                        <td className="py-2 pr-3">{variable.label}</td>
                        <td className="py-2 pr-3">{variable.namespace}</td>
                        <td className="py-2 pr-3">{variable.exampleValue}</td>
                        <td className="py-2">{variable.fallbackToken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Blocked: provider secrets, raw tokens, internal IDs, billing IDs, private notes, raw provider payloads.
              </p>
            </GrowthEngineCard>
          ) : null}

          {tab === "approvals" ? (
            <GrowthEngineCard title="Approval history">
              <ul className="space-y-2">
                {dashboard.approvalEvents.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No approval events yet.</li>
                ) : (
                  dashboard.approvalEvents.map((event) => (
                    <li key={event.id} className="rounded-lg border px-3 py-2 text-sm">
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-muted-foreground">{formatWhen(event.createdAt)}</div>
                      {event.description ? <div className="text-muted-foreground">{event.description}</div> : null}
                    </li>
                  ))
                )}
              </ul>
            </GrowthEngineCard>
          ) : null}

          {tab === "preview" ? (
            <GrowthEngineCard title="Render preview">
              {preview ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Subject</div>
                    <div className="text-sm">{preview.subject}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">Body</div>
                    <Textarea readOnly value={preview.body} rows={8} />
                  </div>
                  {preview.complianceFooterVisible ? (
                    <GrowthBadge label="Compliance footer visible" tone="healthy" />
                  ) : null}
                  {preview.warnings.length > 0 ? (
                    <ul className="text-xs text-amber-700">
                      {preview.warnings.map((warning, idx) => (
                        <li key={`warn-${idx}`}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.blockedVariables.length > 0 ? (
                    <p className="text-sm text-rose-600">Blocked variables: {preview.blockedVariables.join(", ")}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a template and click Preview{selectedTemplateId ? "" : " from the Templates tab"}.
                </p>
              )}
            </GrowthEngineCard>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
