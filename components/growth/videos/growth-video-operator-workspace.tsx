"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoOperatorAssetReview } from "@/components/growth/videos/growth-video-operator-asset-review"
import { GrowthVideoOperatorChannelPreview } from "@/components/growth/videos/growth-video-operator-channel-preview"
import { GrowthVideoOperatorSidebar } from "@/components/growth/videos/growth-video-operator-sidebar"
import { GrowthVideoOperatorSummaryCards } from "@/components/growth/videos/growth-video-operator-summary-cards"
import type {
  GrowthVideoOperatorWorkspaceListItem,
  GrowthVideoOperatorWorkspaceView,
} from "@/lib/growth/videos/growth-video-operator-workspace-types"

export function GrowthVideoOperatorWorkspace({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<GrowthVideoOperatorWorkspaceListItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<GrowthVideoOperatorWorkspaceView | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/growth/videos/operator-workspace?lead_id=${encodeURIComponent(leadId)}`,
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        workspaces?: GrowthVideoOperatorWorkspaceListItem[]
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load operator workspace.")
      setItems(data.workspaces ?? [])
      setActiveId((current) => current ?? data.workspaces?.[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const loadWorkspace = useCallback(
    async (draftId: string) => {
      setError(null)
      try {
        const res = await fetch(
          `/api/growth/videos/operator-workspace/${encodeURIComponent(draftId)}?lead_id=${encodeURIComponent(leadId)}`,
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          message?: string
          workspace?: GrowthVideoOperatorWorkspaceView
        }
        if (!res.ok || !data.ok || !data.workspace) {
          throw new Error(data.message ?? "Could not load workspace draft.")
        }
        setWorkspace(data.workspace)
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

  async function runAction(path: string, body: Record<string, unknown>) {
    if (!activeId) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/operator-workspace/${encodeURIComponent(activeId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, ...body }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        workspace?: GrowthVideoOperatorWorkspaceView
      }
      if (!res.ok || !data.ok || !data.workspace) {
        throw new Error(data.message ?? "Action failed.")
      }
      setWorkspace(data.workspace)
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setActing(false)
    }
  }

  const draftOptions = useMemo(
    () =>
      items.map((item) => ({
        id: item.id,
        label: `${item.contactName ?? "Prospect"} · ${item.draftStatus}`,
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
      <div className="space-y-4">
        {draftOptions.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {draftOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActiveId(option.id)}
                className={`rounded-md border px-3 py-1 text-xs ${
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
            <Loader2 className="size-4 animate-spin" />
            Updating workspace…
          </div>
        ) : null}

        {workspace ? (
          <>
            <GrowthVideoOperatorSummaryCards summary={workspace.summary} />

            <div className="grid gap-4 xl:grid-cols-3">
              <GrowthVideoOperatorSidebar
                inputSnapshot={workspace.inputSnapshot}
                draftStatus={workspace.draft.status}
                operatorState={workspace.operatorState}
                actions={workspace.actions}
                acting={acting}
                onApproveDraft={() => void runAction("approve", { scope: "draft" })}
                onPublishPage={() => void runAction("publish", {})}
                onQueueVoice={() => void runAction("queue-media", { media_type: "voice" })}
                onQueueAvatar={() => void runAction("queue-media", { media_type: "avatar" })}
                onApproveAttachment={() => void runAction("approve", { scope: "attachment" })}
                onDiscardDraft={() =>
                  void fetch(
                    `/api/growth/videos/autopilot/drafts/${encodeURIComponent(workspace.id)}/discard`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ lead_id: leadId }),
                    },
                  ).then(() => loadList())
                }
              />
              <GrowthVideoOperatorAssetReview draft={workspace.draft} />
              <GrowthVideoOperatorChannelPreview channelPreview={workspace.channelPreview} />
            </div>
          </>
        ) : null}
      </div>
    </GrowthEnginePanelResilience>
  )
}
