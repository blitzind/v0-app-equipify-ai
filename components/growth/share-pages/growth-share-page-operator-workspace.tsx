"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthSharePageAnalyticsPanel } from "@/components/growth/share-pages/growth-share-page-analytics-panel"
import { GrowthSharePageOperatorSidebar } from "@/components/growth/share-pages/growth-share-page-operator-sidebar"
import { saveSharePageTokens } from "@/components/growth/share-pages/growth-share-page-manage-panel"
import { GrowthSharePagePreviewPanel } from "@/components/growth/share-pages/growth-share-page-preview-panel"
import { GrowthSharePageReviewPanel } from "@/components/growth/share-pages/growth-share-page-review-panel"
import { GrowthSharePageSummaryCards } from "@/components/growth/share-pages/growth-share-page-summary-cards"
import { GrowthSharePageTimelinePanel } from "@/components/growth/share-pages/growth-share-page-timeline-panel"
import { GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER } from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"
import type {
  GrowthSharePageOperatorWorkspaceListItem,
  GrowthSharePageOperatorWorkspaceView,
} from "@/lib/growth/share-pages/growth-share-page-operator-workspace-types"

function loadPreviewUrlFromSession(pageId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem("growth-share-page-tokens-v1")
    if (!raw) return null
    const store = JSON.parse(raw) as Record<string, { previewToken?: string; publicToken?: string }>
    const entry = store[pageId]
    if (entry?.previewToken) return `/p-preview/${entry.previewToken}`
    return null
  } catch {
    return null
  }
}

function loadPublicUrlFromSession(pageId: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem("growth-share-page-tokens-v1")
    if (!raw) return null
    const store = JSON.parse(raw) as Record<string, { publicToken?: string }>
    const entry = store[pageId]
    if (entry?.publicToken) return `/p/${entry.publicToken}`
    return null
  } catch {
    return null
  }
}

export function GrowthSharePageOperatorWorkspace({
  leadId,
  initialPageId,
}: {
  leadId: string
  initialPageId?: string | null
}) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [items, setItems] = useState<GrowthSharePageOperatorWorkspaceListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(initialPageId ?? null)
  const [workspace, setWorkspace] = useState<GrowthSharePageOperatorWorkspaceView | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/share-pages/workspace?lead_id=${encodeURIComponent(leadId)}`,
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        workspaces?: GrowthSharePageOperatorWorkspaceListItem[]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load share page workspace.")
      setItems(data.workspaces ?? [])
      setActiveId((current) => current ?? initialPageId ?? data.workspaces?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [initialPageId, leadId])

  const loadWorkspace = useCallback(
    async (pageId: string) => {
      setError(null)
      try {
        const res = await fetch(
          `/api/growth/share-pages/workspace/${encodeURIComponent(pageId)}?lead_id=${encodeURIComponent(leadId)}`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          workspace?: GrowthSharePageOperatorWorkspaceView
        }
        if (!res.ok || !data.ok || !data.workspace) {
          throw new Error(data.message ?? "Could not load share page workspace.")
        }
        setWorkspace(data.workspace)
        setPreviewUrl(loadPreviewUrlFromSession(pageId))
        setPublicUrl(loadPublicUrlFromSession(pageId))
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed.")
      }
    },
    [leadId],
  )

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (activeId) void loadWorkspace(activeId)
  }, [activeId, loadWorkspace])

  async function runAction(path: string, body: Record<string, unknown> = {}) {
    if (!activeId) return
    setActing(true)
    setError(null)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/growth/share-pages/workspace/${encodeURIComponent(activeId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, ...body }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        workspace?: GrowthSharePageOperatorWorkspaceView
        duplicate_page_id?: string
        previewToken?: string
        previewUrl?: string
      }
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? "Action failed.")
      }
      setWorkspace(data.workspace)
      if (path === "duplicate" && data.duplicate_page_id) {
        setActiveId(data.duplicate_page_id)
        setActionMessage("Duplicate draft created.")
      } else if (path === "publish") {
        setActionMessage("Share page published.")
      } else if (path === "approve") {
        setActionMessage("Draft approved — ready to publish.")
      } else if (path === "archive") {
        setActionMessage("Share page archived.")
      } else if (path === "rebuild") {
        setActionMessage("Personalization context rebuilt.")
      }
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(false)
    }
  }

  const pageOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: `${item.contactName ?? "Prospect"} · ${item.summary.draftStatus}`,
      })),
    [items],
  )

  return (
    <GrowthEnginePanelResilience
      loading={loading}
      error={error}
      isEmpty={!loading && items.length === 0}
      emptyKind="no-data"
      onRetry={() => void loadList()}
    >
      <div className="space-y-4" data-qa-marker={GROWTH_SHARE_PAGE_OPERATOR_WORKSPACE_QA_MARKER}>
        {pageOptions.length > 1 ? (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Share pages for lead">
            {pageOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={activeId === option.id}
                onClick={() => setActiveId(option.id)}
                className={`rounded-md border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeId === option.id ? "bg-primary text-primary-foreground" : ""
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {acting ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Updating workspace…
          </div>
        ) : null}

        {actionMessage ? <p className="text-xs text-muted-foreground">{actionMessage}</p> : null}

        {workspace ? (
          <>
            <GrowthSharePageSummaryCards summary={workspace.summary} />

            <div className="grid gap-4 xl:grid-cols-3">
              <GrowthSharePageOperatorSidebar
                leadContext={workspace.leadContext}
                draftStatus={workspace.summary.draftStatus}
                operatorState={workspace.operatorState}
                actions={workspace.actions}
                acting={acting}
                onApproveDraft={() => void runAction("approve")}
                onPublish={() => void runAction("publish")}
                onDuplicate={() => void runAction("duplicate")}
                onArchive={() => void runAction("archive")}
                onRebuildPersonalization={() => void runAction("rebuild")}
                onOpenPublicPage={() => {
                  if (publicUrl) window.open(publicUrl, "_blank", "noopener,noreferrer")
                }}
              />

              <GrowthSharePageReviewPanel review={workspace.review} />

              <div className="space-y-4">
                <GrowthSharePagePreviewPanel preview={workspace.preview} previewUrl={previewUrl} />
                <GrowthSharePageAnalyticsPanel analytics={workspace.analytics} />
                <GrowthSharePageTimelinePanel timeline={workspace.timeline} />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </GrowthEnginePanelResilience>
  )
}

export { saveSharePageTokens }
