"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Check, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES } from "@/lib/growth/sendr/growth-sendr-config"
import { buildSendrPagePublicLink, buildSendrPagePublicPath } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
import type {
  GrowthSendrBookingAsset,
  GrowthSendrLandingPage,
  GrowthSendrLandingPagePublication,
  GrowthSendrLandingPageSection,
  GrowthSendrPersonalizationPreviewResult,
  GrowthSendrVideoAsset,
  GrowthSendrAssetPickerItem,
} from "@/lib/growth/sendr/growth-sendr-types"
import { GrowthSendrAssetPickerPanel } from "@/components/growth/sendr/growth-sendr-asset-picker-panel"
import { GrowthSendrSectionVideoEditor } from "@/components/growth/sendr/growth-sendr-section-video-editor"
import {
  buildSendrPageDetailPath,
  buildSendrVideoReturnContextForPage,
  parseSendrReturnAttachParams,
} from "@/lib/growth/sendr/growth-sendr-video-return-flow"

type DetailResponse = {
  ok: boolean
  page?: GrowthSendrLandingPage
  sections?: GrowthSendrLandingPageSection[]
  publications?: GrowthSendrLandingPagePublication[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
  publicLink?: string
  message?: string
}

export function GrowthSendrPageDetail({ pageId }: { pageId: string }) {
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<DetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [newSectionType, setNewSectionType] = useState<string>("hero")
  const [newSectionBody, setNewSectionBody] = useState("Hi {{first_name}} from {{company_name}}")

  const [previewLeadId, setPreviewLeadId] = useState("")
  const [previewCompanyId, setPreviewCompanyId] = useState("")
  const [previewCustom, setPreviewCustom] = useState('{"example":"value"}')
  const [preview, setPreview] = useState<GrowthSendrPersonalizationPreviewResult | null>(null)

  const [videoSourceUrl, setVideoSourceUrl] = useState("")
  const [videoPosterUrl, setVideoPosterUrl] = useState("")
  const [videoMediaAssetId, setVideoMediaAssetId] = useState("")

  const [meetingLink, setMeetingLink] = useState("")
  const [meetingType, setMeetingType] = useState("discovery")
  const [durationMinutes, setDurationMinutes] = useState("30")
  const [timezone, setTimezone] = useState("America/New_York")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/platform/growth/sendr/landing-pages?landingPageId=${pageId}&include=detail`,
        { cache: "no-store" },
      )
      const data = (await res.json()) as DetailResponse
      if (!res.ok) {
        setMessage(data.message ?? "Failed to load page")
        setDetail(null)
        return
      }
      setDetail(data)
      if (data.page?.leadId) setPreviewLeadId(data.page.leadId)
      if (typeof data.page?.mobileMetadata.companyId === "string") {
        setPreviewCompanyId(data.page.mobileMetadata.companyId)
      }
      if (data.videoAsset?.sourceUrl) setVideoSourceUrl(data.videoAsset.sourceUrl)
      if (data.videoAsset?.posterUrl) setVideoPosterUrl(data.videoAsset.posterUrl)
      if (data.bookingAsset?.meetingLink) setMeetingLink(data.bookingAsset.meetingLink)
      if (data.bookingAsset?.meetingType) setMeetingType(data.bookingAsset.meetingType)
      if (data.bookingAsset?.durationMinutes) setDurationMinutes(String(data.bookingAsset.durationMinutes))
      if (data.bookingAsset?.timezone) setTimezone(data.bookingAsset.timezone)
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  const attachGrowthVideoToTarget = useCallback(
    async (growthVideoAssetId: string, sectionId?: string) => {
      setBusy(true)
      setMessage(null)
      try {
        const res = await fetch("/api/platform/growth/sendr/video-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            sectionId
              ? {
                  action: "attach_growth_video_section",
                  landingPageId: pageId,
                  sectionId,
                  growthVideoAssetId,
                }
              : {
                  action: "attach_growth_video",
                  landingPageId: pageId,
                  growthVideoAssetId,
                },
          ),
        })
        const data = (await res.json()) as { ok: boolean; message?: string }
        if (!res.ok) {
          setMessage(data.message ?? "Video attach failed")
          return false
        }
        setMessage(sectionId ? "Section video attached" : "Growth Video attached")
        void load()
        return true
      } finally {
        setBusy(false)
      }
    },
    [load, pageId],
  )

  const returnAttachHandled = useRef(false)

  useEffect(() => {
    if (returnAttachHandled.current) return
    const attachParams = parseSendrReturnAttachParams(searchParams)
    if (!attachParams || attachParams.landingPageId !== pageId) return

    returnAttachHandled.current = true
    void (async () => {
      const attached = await attachGrowthVideoToTarget(attachParams.assetId, attachParams.sectionId)
      if (attached) {
        window.history.replaceState({}, "", buildSendrPageDetailPath(pageId))
      } else {
        setMessage("Return attach failed — select the video manually or upload again.")
      }
    })()
  }, [attachGrowthVideoToTarget, pageId, searchParams])

  async function copyLink() {
    const currentPage = detail?.page
    const slug = currentPage?.publishedSlug ?? currentPage?.slug
    const link =
      detail?.publicLink ??
      (slug
        ? buildSendrPagePublicLink(slug, window.location.origin)
        : `${window.location.origin}/growth/sendr/${pageId}`)
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function addSection() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_section",
          landingPageId: pageId,
          sectionType: newSectionType,
          sortOrder: detail?.sections?.length ?? 0,
          content: { body: newSectionBody, headline: "Section headline" },
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Add section failed")
        return
      }
      setMessage("Section added")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function removeSection(sectionId: string) {
    setBusy(true)
    try {
      await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_section", landingPageId: pageId, sectionId }),
      })
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function runPreview() {
    setBusy(true)
    try {
      let customVariables: Record<string, string> = {}
      try {
        customVariables = JSON.parse(previewCustom) as Record<string, string>
      } catch {
        setMessage("Invalid custom variables JSON")
        return
      }
      const res = await fetch("/api/platform/growth/sendr/personalization-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: previewLeadId || undefined,
          companyId: previewCompanyId || undefined,
          customVariables,
        }),
      })
      const data = (await res.json()) as { ok: boolean; preview?: GrowthSendrPersonalizationPreviewResult; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Preview failed")
        return
      }
      setPreview(data.preview ?? null)
    } finally {
      setBusy(false)
    }
  }

  async function detachPageVideo() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "detach_page_video",
          landingPageId: pageId,
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        setMessage(data.message ?? "Video remove failed")
        return
      }
      setMessage("Page video removed")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function attachExistingVideo(item: GrowthSendrAssetPickerItem) {
    if (item.assetKind !== "video") return
    setBusy(true)
    setMessage(null)
    try {
      const isGrowthLibrary = item.metadata.source === "growth_library"
      const attachRes = await fetch("/api/platform/growth/sendr/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isGrowthLibrary
            ? {
                action: "attach_growth_video",
                landingPageId: pageId,
                growthVideoAssetId: item.id,
              }
            : {
                action: "attach",
                landingPageId: pageId,
                videoAssetId: item.id,
              },
        ),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        if (isGrowthLibrary && attachData.message === "growth_video_asset_not_found") {
          setMessage("Growth Video asset not found. Upload it from Video Library first.")
          return
        }
        setMessage(attachData.message ?? "Video attach failed")
        return
      }
      setMessage(isGrowthLibrary ? "Growth Video attached" : "Existing video attached")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function attachExistingBooking(item: GrowthSendrAssetPickerItem) {
    if (item.assetKind !== "booking") return
    setBusy(true)
    setMessage(null)
    try {
      const attachRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          landingPageId: pageId,
          bookingAssetId: item.id,
        }),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        setMessage(attachData.message ?? "Booking attach failed")
        return
      }
      setMessage("Existing booking attached")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function registerAndAttachVideo() {
    setBusy(true)
    setMessage(null)
    try {
      const regRes = await fetch("/api/platform/growth/sendr/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          sourceUrl: videoSourceUrl || null,
          posterUrl: videoPosterUrl || null,
          mediaAssetId: videoMediaAssetId || undefined,
          transcriptStatus: "none",
          captionsStatus: "none",
        }),
      })
      const regData = (await regRes.json()) as { ok: boolean; videoAsset?: { id: string }; message?: string }
      if (!regRes.ok) {
        setMessage(regData.message ?? "Video register failed")
        return
      }
      const attachRes = await fetch("/api/platform/growth/sendr/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          landingPageId: pageId,
          videoAssetId: regData.videoAsset?.id,
        }),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        setMessage(attachData.message ?? "Video attach failed")
        return
      }
      setMessage("Video metadata attached")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function registerAndAttachBooking() {
    setBusy(true)
    setMessage(null)
    try {
      const regRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          meetingLink: meetingLink || null,
          meetingType,
          durationMinutes: Number(durationMinutes) || 30,
          timezone,
          calendarProvider: "manual",
        }),
      })
      const regData = (await regRes.json()) as { ok: boolean; bookingAsset?: { id: string }; message?: string }
      if (!regRes.ok) {
        setMessage(regData.message ?? "Booking register failed")
        return
      }
      const attachRes = await fetch("/api/platform/growth/sendr/booking-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "attach",
          landingPageId: pageId,
          bookingAssetId: regData.bookingAsset?.id,
        }),
      })
      const attachData = (await attachRes.json()) as { ok: boolean; message?: string }
      if (!attachRes.ok) {
        setMessage(attachData.message ?? "Booking attach failed")
        return
      }
      setMessage("Booking link attached")
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function publishPage() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", landingPageId: pageId }),
      })
      const data = (await res.json()) as {
        ok: boolean
        publicLink?: string
        message?: string
      }
      if (!res.ok) {
        setMessage(data.message ?? "Publish failed")
        return
      }
      setMessage(`Published · ${data.publicLink ?? ""}`)
      void load()
    } finally {
      setBusy(false)
    }
  }

  async function archivePage() {
    setBusy(true)
    try {
      await fetch("/api/platform/growth/sendr/landing-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", landingPageId: pageId }),
      })
      void load()
    } finally {
      setBusy(false)
    }
  }

  if (loading && !detail?.page) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading page…
      </div>
    )
  }

  if (!detail?.page) {
    return <p className="text-sm text-destructive">{message ?? "Page not found"}</p>
  }

  const { page, sections = [], publications = [], videoAsset, bookingAsset, publicLink } = detail
  const growthVideoAssetId =
    typeof page?.mobileMetadata.growthVideoAssetId === "string"
      ? page.mobileMetadata.growthVideoAssetId
      : videoAsset?.legacyVideoAssetId ?? null
  const pageReturnContext = buildSendrVideoReturnContextForPage({ landingPageId: pageId })
  const selectedVideoPickerId = growthVideoAssetId ?? videoAsset?.id ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{page.title}</h2>
            <Badge variant="outline">{page.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {page.id} · Lead {page.leadId ?? "none"} · Owner {page.ownerUserId.slice(0, 8)}…
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => void copyLink()}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            Copy link
          </Button>
          {(page.publishedSlug ?? page.slug) ? (
            <Button size="sm" variant="outline" asChild>
              <a
                href={buildSendrPagePublicLink(page.publishedSlug ?? page.slug ?? "", window.location.origin)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open page
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" asChild>
            <Link href="/growth/sendr">Back</Link>
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="personalization">Personalization</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="booking">Booking</TabsTrigger>
          <TabsTrigger value="publish">Publish</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Template: {String(page.mobileMetadata.templateType ?? "default")}</p>
              <p>Sections: {sections.length}</p>
              <p>Video: {videoAsset?.id ?? "none"}</p>
              <p>Booking: {bookingAsset?.id ?? "none"}</p>
              <p>
                Public link:{" "}
                {publicLink ??
                  (page.publishedSlug ?? page.slug
                    ? buildSendrPagePublicPath(page.publishedSlug ?? page.slug ?? "")
                    : "Publish to generate slug")}
              </p>
              {page.publishedAt ? (
                <p>Published: {new Date(page.publishedAt).toLocaleString()} · v{page.publishedVersion ?? 1}</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add section</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={newSectionType} onValueChange={setNewSectionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES.filter((t) => t !== "custom_html").map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea value={newSectionBody} onChange={(e) => setNewSectionBody(e.target.value)} rows={3} />
              <Button size="sm" disabled={busy} onClick={() => void addSection()}>
                Add section
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {sections.map((section) => (
              <div key={section.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline">{section.sectionType}</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      order {section.sortOrder} · {String(section.content.body ?? section.content.videoTitle ?? "").slice(0, 120)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void removeSection(section.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {section.sectionType === "video" || section.sectionType === "avatar_video" ? (
                  <GrowthSendrSectionVideoEditor
                    pageId={pageId}
                    section={section}
                    disabled={busy}
                    onUpdated={() => void load()}
                    onMessage={setMessage}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="personalization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview personalization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Lead ID</Label>
                <Input value={previewLeadId} onChange={(e) => setPreviewLeadId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Company ID</Label>
                <Input value={previewCompanyId} onChange={(e) => setPreviewCompanyId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Custom variables (JSON)</Label>
                <Textarea value={previewCustom} onChange={(e) => setPreviewCustom(e.target.value)} rows={3} />
              </div>
              <Button size="sm" disabled={busy} onClick={() => void runPreview()}>
                Preview
              </Button>
            </CardContent>
          </Card>
          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolved variables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Resolved</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(preview.resolved, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="font-medium">Fallbacks</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(preview.fallbacks, null, 2)}
                  </pre>
                </div>
                {preview.missing.length > 0 ? (
                  <p className="text-destructive">Missing: {preview.missing.join(", ")}</p>
                ) : (
                  <p className="text-muted-foreground">No missing variables</p>
                )}
                <div>
                  <p className="font-medium">Rendered samples</p>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(preview.renderedSamples, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {videoAsset ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">Attached video</p>
                      <p className="text-muted-foreground">
                        {growthVideoAssetId
                          ? `Growth Video library asset ${growthVideoAssetId}`
                          : `Metadata asset ${videoAsset.id}`}
                      </p>
                      {videoAsset.durationSeconds ? (
                        <p className="text-xs text-muted-foreground">Duration: {videoAsset.durationSeconds}s</p>
                      ) : null}
                    </div>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void detachPageVideo()}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Record, upload, or select an existing Growth Video asset to attach to this page.
                </p>
              )}
              <details className="rounded-md border p-3">
                <summary className="cursor-pointer text-sm font-medium">Legacy metadata URL (optional)</summary>
                <div className="mt-3 space-y-3">
                  <div className="space-y-2">
                    <Label>Source URL</Label>
                    <Input value={videoSourceUrl} onChange={(e) => setVideoSourceUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poster URL</Label>
                    <Input value={videoPosterUrl} onChange={(e) => setVideoPosterUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Existing media asset ID (optional)</Label>
                    <Input value={videoMediaAssetId} onChange={(e) => setVideoMediaAssetId(e.target.value)} />
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => void registerAndAttachVideo()}>
                    Register & attach metadata URL
                  </Button>
                </div>
              </details>
              <GrowthSendrAssetPickerPanel
                kind="video"
                selectedId={selectedVideoPickerId}
                disabled={busy}
                showVideoShortcuts
                returnContext={pageReturnContext}
                attachLabel={videoAsset ? "Replace" : "Attach"}
                onSelect={(item) => void attachExistingVideo(item)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="booking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingAsset ? (
                <p className="text-sm text-muted-foreground">Attached: {bookingAsset.id}</p>
              ) : null}
              <div className="space-y-2">
                <Label>Meeting link</Label>
                <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Meeting type</Label>
                <Input value={meetingType} onChange={(e) => setMeetingType(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>
              <Button size="sm" disabled={busy} onClick={() => void registerAndAttachBooking()}>
                Register & attach booking
              </Button>
              <GrowthSendrAssetPickerPanel
                kind="booking"
                selectedId={bookingAsset?.id}
                disabled={busy}
                onSelect={(item) => void attachExistingBooking(item)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="publish" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Draft → Published creates an immutable publication snapshot. Archived pages stay in history.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || page.status === "published"} onClick={() => void publishPage()}>
                  Publish
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || page.status === "archived"}
                  onClick={() => void archivePage()}
                >
                  Archive
                </Button>
                <Button size="sm" variant="outline" onClick={() => void copyLink()}>
                  Copy public link
                </Button>
              </div>
              {publications.length > 0 ? (
                <div className="text-sm">
                  <p className="font-medium">Publication history</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {publications.map((pub, index) => (
                      <li key={pub.id}>
                        v{publications.length - index} · {new Date(pub.publishedAt).toLocaleString()} ·{" "}
                        {pub.publishedBy?.slice(0, 8) ?? "system"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Not published yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
