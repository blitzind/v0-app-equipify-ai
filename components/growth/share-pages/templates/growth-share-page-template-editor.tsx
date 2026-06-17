"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Archive, Copy, Eye, FilePlus2, Loader2, Save, Send, Sparkles, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthSharePageTemplateCanvas } from "@/components/growth/share-pages/templates/growth-share-page-template-canvas"
import { GrowthSharePageTemplatePublishDialog } from "@/components/growth/share-pages/templates/growth-share-page-template-publish-dialog"
import { GrowthSharePageTemplateInstantiateDialog } from "@/components/growth/share-pages/templates/growth-share-page-template-instantiate-dialog"
import { GrowthSharePageTemplateSectionPalette } from "@/components/growth/share-pages/templates/growth-share-page-template-section-palette"
import { GrowthSharePageTemplateSettingsPanel } from "@/components/growth/share-pages/templates/growth-share-page-template-settings-panel"
import { GrowthSharePageTemplateVersionTimeline } from "@/components/growth/share-pages/templates/growth-share-page-template-version-timeline"
import { GROWTH_SHARE_PAGE_TEMPLATE_STATUS_LABELS } from "@/components/growth/share-pages/templates/growth-share-page-template-card"
import {
  createDefaultTemplateEditorDraft,
  createTemplateBlock,
  moveTemplateBlock,
  normalizeTemplateBlockOrder,
  removeTemplateBlock,
  type GrowthSharePageTemplateEditorDraft,
} from "@/lib/growth/share-pages/share-page-template-editor-utils"
import { GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER } from "@/lib/growth/share-pages/share-page-template-editor-utils"
import type { GrowthSharePageTemplateBlockType } from "@/lib/growth/share-pages/share-page-template-block-types"
import type {
  GrowthSharePageTemplate,
  GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"
import type { GrowthBookingPageListItem } from "@/lib/growth/booking/booking-page-types"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function draftFromTemplate(template: GrowthSharePageTemplate): GrowthSharePageTemplateEditorDraft {
  const version = template.currentVersion
  return {
    metadata: {
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      previewImageUrl: template.previewImageUrl,
    },
    blocks: version?.blocks ?? [createTemplateBlock("hero")],
    theme: version?.theme ?? createDefaultTemplateEditorDraft().theme,
    defaultBookingPageId: version?.defaultBookingPageId ?? null,
  }
}

function serializeDraft(draft: GrowthSharePageTemplateEditorDraft) {
  return JSON.stringify({
    metadata: draft.metadata,
    blocks: normalizeTemplateBlockOrder(draft.blocks),
    theme: draft.theme,
    defaultBookingPageId: draft.defaultBookingPageId,
  })
}

type VersionsResponse = {
  ok: boolean
  versions?: GrowthSharePageTemplateVersion[]
  message?: string
}

export function GrowthSharePageTemplateEditor({
  templateId,
  initialTemplate,
}: {
  templateId?: string
  initialTemplate?: GrowthSharePageTemplate | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [template, setTemplate] = useState<GrowthSharePageTemplate | null>(initialTemplate ?? null)
  const [versions, setVersions] = useState<GrowthSharePageTemplateVersion[]>([])
  const [draft, setDraft] = useState<GrowthSharePageTemplateEditorDraft>(() =>
    initialTemplate ? draftFromTemplate(initialTemplate) : createDefaultTemplateEditorDraft(),
  )
  const [tagsInput, setTagsInput] = useState(() =>
    initialTemplate ? initialTemplate.tags.join(", ") : "",
  )
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [bookingPages, setBookingPages] = useState<GrowthBookingPageListItem[]>([])
  const [loading, setLoading] = useState(Boolean(templateId && !initialTemplate))
  const [versionsLoading, setVersionsLoading] = useState(false)
  useGrowthBreadcrumbDetail(template?.name ?? draft.metadata.name, loading)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [workflowBusy, setWorkflowBusy] = useState(false)
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [publishSummary, setPublishSummary] = useState("")
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showInstantiateDialog, setShowInstantiateDialog] = useState(false)
  const savedSnapshotRef = useRef(serializeDraft(draft))
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dirty = useMemo(
    () =>
      serializeDraft({ ...draft, metadata: { ...draft.metadata, tags: parseTagsInput(tagsInput) } }) !==
      savedSnapshotRef.current,
    [draft, tagsInput],
  )

  const readOnly = template?.status === "archived"
  const editorDisabled = saving || publishing || workflowBusy || readOnly

  const syncFromTemplate = useCallback((nextTemplate: GrowthSharePageTemplate) => {
    setTemplate(nextTemplate)
    const nextDraft = draftFromTemplate(nextTemplate)
    setDraft(nextDraft)
    setTagsInput(nextTemplate.tags.join(", "))
    savedSnapshotRef.current = serializeDraft(nextDraft)
  }, [])

  const loadVersions = useCallback(async (activeTemplateId: string) => {
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${activeTemplateId}/versions`)
      const data = (await res.json()) as VersionsResponse
      if (res.ok && data.versions) {
        setVersions(data.versions)
      }
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  const loadTemplate = useCallback(async () => {
    if (!templateId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${templateId}`)
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Template not found")
        return
      }
      syncFromTemplate(data.template)
      await loadVersions(data.template.id)
    } catch {
      setError("Failed to load template")
    } finally {
      setLoading(false)
    }
  }, [loadVersions, syncFromTemplate, templateId])

  useEffect(() => {
    if (templateId && !initialTemplate) void loadTemplate()
    else if (templateId && initialTemplate) void loadVersions(templateId)
  }, [initialTemplate, loadTemplate, loadVersions, templateId])

  useEffect(() => {
    void fetch("/api/platform/growth/booking-pages")
      .then((res) => res.json())
      .then((data: { items?: GrowthBookingPageListItem[] }) => setBookingPages(data.items ?? []))
      .catch(() => setBookingPages([]))
  }, [])

  const persistDraft = useCallback(
    async (input?: { silent?: boolean; changeSummary?: string }): Promise<string | null> => {
      const payloadDraft = {
        ...draft,
        metadata: { ...draft.metadata, tags: parseTagsInput(tagsInput) },
        blocks: normalizeTemplateBlockOrder(draft.blocks),
      }

      setSaving(true)
      setError(null)
      if (!input?.silent) setMessage(null)
      try {
        if (!templateId) {
          const res = await fetch("/api/platform/growth/share-pages/templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: payloadDraft.metadata.name,
              description: payloadDraft.metadata.description,
              category: payloadDraft.metadata.category,
              tags: payloadDraft.metadata.tags,
              preview_image_url: payloadDraft.metadata.previewImageUrl,
              blocks: payloadDraft.blocks,
              theme: payloadDraft.theme,
              default_booking_page_id: payloadDraft.defaultBookingPageId,
              change_summary: input?.changeSummary ?? "Initial editor save",
            }),
          })
          const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
          if (!res.ok || !data.template) {
            setError(data.message ?? "Create failed")
            return null
          }
          syncFromTemplate(data.template)
          if (!input?.silent) setMessage("Template created.")
          router.replace(growthFeaturePath(pathname, `share-pages/templates/${data.template.id}`))
          return data.template.id
        }

        const res = await fetch(`/api/platform/growth/share-pages/templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payloadDraft.metadata.name,
            description: payloadDraft.metadata.description,
            category: payloadDraft.metadata.category,
            tags: payloadDraft.metadata.tags,
            preview_image_url: payloadDraft.metadata.previewImageUrl,
            blocks: payloadDraft.blocks,
            theme: payloadDraft.theme,
            default_booking_page_id: payloadDraft.defaultBookingPageId,
            change_summary: input?.changeSummary ?? "Editor save",
          }),
        })
        const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
        if (!res.ok || !data.template) {
          setError(data.message ?? "Save failed")
          return null
        }
        syncFromTemplate(data.template)
        if (!input?.silent) setMessage("Draft saved.")
        return data.template.id
      } finally {
        setSaving(false)
      }
    },
    [draft, pathname, router, syncFromTemplate, tagsInput, templateId],
  )

  useEffect(() => {
    if (!templateId || !dirty || saving || readOnly) return
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(() => {
      void persistDraft({ silent: true })
    }, 1800)
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    }
  }, [dirty, persistDraft, readOnly, saving, templateId])

  function addBlock(type: GrowthSharePageTemplateBlockType) {
    setDraft((current) => {
      const blocks = normalizeTemplateBlockOrder([
        ...current.blocks,
        createTemplateBlock(type, current.blocks.length),
      ])
      const created = blocks[blocks.length - 1]
      if (created) setExpandedBlockId(created.id)
      return { ...current, blocks }
    })
  }

  async function saveAsNewVersion() {
    if (!templateId) return
    setWorkflowBusy(true)
    setError(null)
    try {
      const activeTemplateId = dirty ? await persistDraft({ silent: true, changeSummary: "Saved before new version" }) : templateId
      if (!activeTemplateId) return

      const payloadDraft = {
        ...draft,
        metadata: { ...draft.metadata, tags: parseTagsInput(tagsInput) },
        blocks: normalizeTemplateBlockOrder(draft.blocks),
      }

      const res = await fetch(`/api/platform/growth/share-pages/templates/${activeTemplateId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: payloadDraft.blocks,
          theme: payloadDraft.theme,
          default_booking_page_id: payloadDraft.defaultBookingPageId,
          change_summary: "Saved as new version",
        }),
      })
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok) {
        setError(data.message ?? "Could not save new version")
        return
      }

      const detailRes = await fetch(`/api/platform/growth/share-pages/templates/${activeTemplateId}`)
      const detail = (await detailRes.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (detailRes.ok && detail.template) {
        syncFromTemplate(detail.template)
      }
      await loadVersions(activeTemplateId)
      setMessage("Saved as new draft version.")
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function publishTemplate() {
    setPublishing(true)
    setError(null)
    try {
      let activeTemplateId = templateId ?? null
      if (!activeTemplateId || dirty) {
        activeTemplateId = await persistDraft({ silent: true })
        if (!activeTemplateId) return
      }

      if (publishSummary.trim()) {
        await fetch(`/api/platform/growth/share-pages/templates/${activeTemplateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ change_summary: publishSummary.trim() }),
        })
      }

      const res = await fetch(`/api/platform/growth/share-pages/templates/${activeTemplateId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Publish failed")
        return
      }
      syncFromTemplate(data.template)
      await loadVersions(activeTemplateId)
      setMessage("Template published to library. No live share page was published.")
      setShowPublishDialog(false)
      setPublishSummary("")
    } finally {
      setPublishing(false)
    }
  }

  async function unpublishTemplate() {
    if (!templateId) return
    setWorkflowBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${templateId}/unpublish`, { method: "POST" })
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Unpublish failed")
        return
      }
      syncFromTemplate(data.template)
      setMessage("Template unpublished. Published version history preserved.")
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function duplicateTemplate() {
    if (!templateId) return
    setWorkflowBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${draft.metadata.name} (Copy)` }),
      })
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Duplicate failed")
        return
      }
      setMessage("Template duplicated.")
      router.push(growthFeaturePath(pathname, `share-pages/templates/${data.template.id}`))
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function archiveTemplate() {
    if (!templateId) return
    setWorkflowBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${templateId}`, { method: "DELETE" })
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Archive failed")
        return
      }
      syncFromTemplate(data.template)
      setMessage("Template archived.")
    } finally {
      setWorkflowBusy(false)
    }
  }

  async function restoreVersion(version: GrowthSharePageTemplateVersion) {
    if (!templateId) return
    setBusyVersionId(version.id)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/share-pages/templates/${templateId}/versions/${version.id}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ change_summary: `Restored from version ${version.versionNumber}` }),
        },
      )
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Restore failed")
        return
      }
      syncFromTemplate(data.template)
      await loadVersions(templateId)
      setMessage(`Restored version ${version.versionNumber} into a new draft.`)
    } finally {
      setBusyVersionId(null)
    }
  }

  async function duplicateVersion(version: GrowthSharePageTemplateVersion) {
    if (!templateId) return
    setBusyVersionId(version.id)
    setError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/share-pages/templates/${templateId}/versions/${version.id}/duplicate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ change_summary: `Duplicated from version ${version.versionNumber}` }),
        },
      )
      const data = (await res.json()) as { ok: boolean; template?: GrowthSharePageTemplate; message?: string }
      if (!res.ok || !data.template) {
        setError(data.message ?? "Duplicate version failed")
        return
      }
      syncFromTemplate(data.template)
      await loadVersions(templateId)
      setMessage(`Duplicated version ${version.versionNumber} into a new draft.`)
    } finally {
      setBusyVersionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading template editor…
      </div>
    )
  }

  if (error && !template && templateId) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-6" data-qa-marker={GROWTH_SHARE_PAGE_TEMPLATE_EDITOR_QA_MARKER}>
      <GrowthEngineCard className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold">{draft.metadata.name || "Untitled template"}</h2>
            {template ? (
              <>
                <GrowthBadge
                  tone={template.status === "published" ? "healthy" : "attention"}
                  label={GROWTH_SHARE_PAGE_TEMPLATE_STATUS_LABELS[template.status]}
                />
                {template.currentVersion ? (
                  <GrowthBadge tone="neutral" label={`Current v${template.currentVersion.versionNumber}`} />
                ) : null}
                {template.publishedVersion ? (
                  <GrowthBadge tone="healthy" label={`Published v${template.publishedVersion.versionNumber}`} />
                ) : null}
              </>
            ) : (
              <GrowthBadge tone="attention" label="New draft" />
            )}
            {dirty ? <span className="text-xs font-medium text-amber-600">Unsaved changes</span> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Template editor only — publish makes the layout available for future page creation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {templateId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={growthFeaturePath(pathname, `share-pages/templates/${templateId}/preview`)}>
                <Eye className="mr-1.5 size-3.5" />
                Preview
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={editorDisabled} onClick={() => void persistDraft().then(() => undefined)}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Save className="mr-1.5 size-3.5" />}
            Save draft
          </Button>
          {templateId ? (
            <Button variant="outline" size="sm" disabled={editorDisabled} onClick={() => void saveAsNewVersion()}>
              <FilePlus2 className="mr-1.5 size-3.5" />
              Save as new version
            </Button>
          ) : null}
          <Button size="sm" disabled={editorDisabled || template?.status === "archived"} onClick={() => setShowPublishDialog(true)}>
            <Send className="mr-1.5 size-3.5" />
            Publish template
          </Button>
          {template?.status === "published" ? (
            <Button variant="secondary" size="sm" disabled={workflowBusy} onClick={() => setShowInstantiateDialog(true)}>
              <Sparkles className="mr-1.5 size-3.5" />
              Use template
            </Button>
          ) : null}
          {template?.status === "published" ? (
            <Button variant="outline" size="sm" disabled={workflowBusy} onClick={() => void unpublishTemplate()}>
              <Undo2 className="mr-1.5 size-3.5" />
              Unpublish
            </Button>
          ) : null}
          {templateId ? (
            <Button variant="outline" size="sm" disabled={workflowBusy} onClick={() => void duplicateTemplate()}>
              <Copy className="mr-1.5 size-3.5" />
              Duplicate
            </Button>
          ) : null}
          {templateId && template?.status !== "archived" ? (
            <Button variant="ghost" size="sm" disabled={workflowBusy} onClick={() => void archiveTemplate()}>
              <Archive className="mr-1.5 size-3.5" />
              Archive
            </Button>
          ) : null}
        </div>
      </GrowthEngineCard>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {readOnly ? (
        <p className="text-sm text-amber-700">This template is archived. Restore workflow actions are read-only.</p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <GrowthSharePageTemplateSectionPalette onAdd={addBlock} disabled={editorDisabled} />
        <GrowthSharePageTemplateCanvas
          blocks={draft.blocks}
          expandedBlockId={expandedBlockId}
          bookingPages={bookingPages}
          onExpandedBlockIdChange={setExpandedBlockId}
          onBlocksChange={(blocks) => setDraft((current) => ({ ...current, blocks }))}
          onMove={(blockId, direction) =>
            setDraft((current) => ({ ...current, blocks: moveTemplateBlock(current.blocks, blockId, direction) }))
          }
          onRemove={(blockId) =>
            setDraft((current) => ({ ...current, blocks: removeTemplateBlock(current.blocks, blockId) }))
          }
          disabled={editorDisabled}
        />
        <GrowthSharePageTemplateSettingsPanel
          metadata={draft.metadata}
          theme={draft.theme}
          tagsInput={tagsInput}
          onMetadataChange={(metadata) => setDraft((current) => ({ ...current, metadata }))}
          onThemeChange={(theme) => setDraft((current) => ({ ...current, theme }))}
          onTagsInputChange={setTagsInput}
          disabled={editorDisabled}
        />
      </div>

      {template && templateId ? (
        <GrowthSharePageTemplateVersionTimeline
          template={template}
          versions={versions}
          loading={versionsLoading}
          busyVersionId={busyVersionId}
          disabled={workflowBusy}
          onRestore={(version) => void restoreVersion(version)}
          onDuplicate={(version) => void duplicateVersion(version)}
        />
      ) : null}

      <GrowthSharePageTemplatePublishDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        template={template}
        versions={versions}
        publishSummary={publishSummary}
        onPublishSummaryChange={setPublishSummary}
        publishing={publishing}
        onConfirm={() => void publishTemplate()}
      />

      {template ? (
        <GrowthSharePageTemplateInstantiateDialog
          open={showInstantiateDialog}
          onOpenChange={setShowInstantiateDialog}
          template={template}
        />
      ) : null}
    </div>
  )
}
