"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Archive, Copy, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthVideoPageAnalyticsSection } from "@/components/growth/videos/growth-video-page-analytics-section"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { buildGrowthVideoPublicPath } from "@/lib/growth/videos/growth-video-page-validation"
import type { GrowthVideoAsset, GrowthVideoPage, GrowthVideoPageStatus } from "@/lib/growth/videos/growth-video-types"

function statusTone(status: GrowthVideoPageStatus) {
  switch (status) {
    case "published":
      return "healthy" as const
    case "archived":
      return "blocked" as const
    default:
      return "neutral" as const
  }
}

export function GrowthVideoPageDetailPanel({ pageId }: { pageId: string }) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<GrowthVideoPage | null>(null)
  const [asset, setAsset] = useState<GrowthVideoAsset | null>(null)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [calendarUrl, setCalendarUrl] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        page?: GrowthVideoPage
        asset?: GrowthVideoAsset | null
        playbackUrl?: string | null
        message?: string
      }
      if (!res.ok || !data.ok || !data.page) {
        throw new Error(data.message ?? "Could not load video page.")
      }
      setPage(data.page)
      setAsset(data.asset ?? null)
      setPlaybackUrl(data.playbackUrl ?? null)
      setTitle(data.page.title)
      setDescription(data.page.description ?? "")
      setCtaLabel(data.page.ctaLabel ?? "")
      setCtaUrl(data.page.ctaUrl ?? "")
      setCalendarUrl(data.page.calendarUrl ?? "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveMetadata() {
    setActing(true)
    setSaveNotice(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          cta_label: ctaLabel.trim() || null,
          cta_url: ctaUrl.trim() || null,
          calendar_url: calendarUrl.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Save failed.")
      setSaveNotice("Saved.")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setActing(false)
    }
  }

  async function runLifecycle(action: "publish" | "archive") {
    setActing(true)
    try {
      await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/${action}`, { method: "POST" })
      await load()
    } finally {
      setActing(false)
    }
  }

  async function copyPublicLink() {
    if (!page) return
    const url = `${window.location.origin}${buildGrowthVideoPublicPath(page.slug)}`
    await navigator.clipboard.writeText(url)
    setSaveNotice(`Copied ${buildGrowthVideoPublicPath(page.slug)}`)
  }

  return (
    <GrowthVideoWorkspaceShell title="Video Page" description="Edit metadata, preview playback, and manage publish state.">
      <GrowthEnginePanelResilience loading={loading} error={error}>
        {page ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <GrowthBadge tone={statusTone(page.status)}>{page.status}</GrowthBadge>
                <span className="text-xs text-muted-foreground">{page.slug}</span>
              </div>

              {playbackUrl ? (
                <video className="w-full rounded-xl border border-border bg-black" controls src={playbackUrl} />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Playback URL unavailable — ensure the linked asset is uploaded and ready.
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>CTA label</Label>
                    <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CTA URL</Label>
                    <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Calendar URL</Label>
                  <Input value={calendarUrl} onChange={(e) => setCalendarUrl(e.target.value)} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void saveMetadata()} disabled={acting}>
                  {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
                  Save changes
                </Button>
                {page.status === "draft" ? (
                  <Button type="button" variant="secondary" onClick={() => void runLifecycle("publish")} disabled={acting}>
                    Publish
                  </Button>
                ) : null}
                {page.status !== "archived" ? (
                  <Button type="button" variant="outline" onClick={() => void runLifecycle("archive")} disabled={acting}>
                    <Archive className="mr-1 size-3.5" />
                    Archive
                  </Button>
                ) : null}
                {page.status === "published" ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => void copyPublicLink()}>
                      <Copy className="mr-1 size-3.5" />
                      Copy public link
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href={buildGrowthVideoPublicPath(page.slug)} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 size-3.5" />
                        Preview public page
                      </Link>
                    </Button>
                  </>
                ) : null}
                <Button type="button" variant="outline" asChild>
                  <Link href={growthFeaturePath(pathname, "videos/pages")}>Back to pages</Link>
                </Button>
              </div>
              {saveNotice ? <p className="text-xs text-muted-foreground">{saveNotice}</p> : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">Linked asset</h3>
                <p className="mt-1 text-sm text-foreground">{asset?.title ?? page.videoAssetId}</p>
                <p className="text-xs text-muted-foreground">Upload status: {asset?.uploadStatus ?? "—"}</p>
              </div>

              <GrowthVideoPageAnalyticsSection pageId={pageId} />
            </div>
          </div>
        ) : null}
      </GrowthEnginePanelResilience>
    </GrowthVideoWorkspaceShell>
  )
}
