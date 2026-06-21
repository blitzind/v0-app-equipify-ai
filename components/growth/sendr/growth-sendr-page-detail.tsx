"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, Plus, Sparkles, Video, CalendarDays, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { buildSendrPagePublicLink } from "@/lib/growth/sendr/growth-sendr-slug-runtime"
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
import {
  GrowthSendrBuilderHeader,
  GrowthSendrBuilderMessage,
} from "@/components/growth/sendr/builder/growth-sendr-builder-header"
import { GrowthSendrBuilderLivePreview } from "@/components/growth/sendr/builder/growth-sendr-builder-live-preview"
import { GrowthSendrBuilderSectionCard } from "@/components/growth/sendr/builder/growth-sendr-builder-section-card"
import { GrowthSendrBuilderEmptyState } from "@/components/growth/sendr/builder/growth-sendr-builder-empty-state"
import { GrowthSendrBuilderReadinessPanel } from "@/components/growth/sendr/builder/growth-sendr-builder-readiness-panel"
import { GrowthSendrBuilderPublishPanel } from "@/components/growth/sendr/builder/growth-sendr-builder-publish-panel"
import { getGrowthSendrBuilderSectionMeta } from "@/lib/growth/sendr/growth-sendr-builder-section-meta"

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

  const hasCtaSection = sections.some((s) => s.sectionType === "cta" || s.sectionType === "calendar")
  const hasBooking = Boolean(bookingAsset?.meetingLink)

  return (
    <div className="space-y-6 pb-8">
      <GrowthSendrBuilderHeader
        page={page}
        loading={loading}
        copied={copied}
        onRefresh={() => void load()}
        onCopyLink={() => void copyLink()}
      />

      {message ? <GrowthSendrBuilderMessage>{message}</GrowthSendrBuilderMessage> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_min(100%,480px)] xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/80 p-1 dark:bg-slate-900/60">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="sections" className="text-xs sm:text-sm">
                Sections
              </TabsTrigger>
              <TabsTrigger value="personalization" className="text-xs sm:text-sm">
                Personalization
              </TabsTrigger>
              <TabsTrigger value="media" className="text-xs sm:text-sm">
                Media
              </TabsTrigger>
              <TabsTrigger value="booking" className="text-xs sm:text-sm">
                Booking
              </TabsTrigger>
              <TabsTrigger value="publish" className="text-xs sm:text-sm">
                Publish
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="lg:hidden">
                <GrowthSendrBuilderLivePreview
                  page={page}
                  sections={sections}
                  videoAsset={videoAsset}
                  bookingAsset={bookingAsset}
                  personalizationPreview={preview}
                />
              </div>
              <GrowthSendrBuilderReadinessPanel
                page={page}
                sections={sections}
                videoAsset={videoAsset}
                bookingAsset={bookingAsset}
                publicLink={publicLink}
              />
            </TabsContent>

            <TabsContent value="sections" className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Add a section</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Build your page like a presentation — hero, video, testimonials, then booking.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={newSectionType} onValueChange={setNewSectionType}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES.filter((t) => t !== "custom_html").map((type) => {
                        const meta = getGrowthSendrBuilderSectionMeta(type)
                        return (
                          <SelectItem key={type} value={type}>
                            {meta.label} — {meta.description}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={newSectionBody}
                    onChange={(e) => setNewSectionBody(e.target.value)}
                    rows={3}
                    placeholder="Hi {{first_name}} from {{company_name}}"
                  />
                  <Button disabled={busy} onClick={() => void addSection()}>
                    <Plus className="mr-1.5 size-4" />
                    Add section
                  </Button>
                </CardContent>
              </Card>

              {sections.length === 0 ? (
                <GrowthSendrBuilderEmptyState
                  icon={Sparkles}
                  title="Start with your hero"
                  description="Add a hero section to introduce your prospect, then layer video, resources, testimonials, and a booking CTA."
                  action={
                    <Button disabled={busy} onClick={() => void addSection()}>
                      <Plus className="mr-1.5 size-4" />
                      Add hero section
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {sections
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((section, index) => (
                      <GrowthSendrBuilderSectionCard
                        key={section.id}
                        section={section}
                        index={index}
                        disabled={busy}
                        onRemove={() => void removeSection(section.id)}
                      >
                        {section.sectionType === "video" || section.sectionType === "avatar_video" ? (
                          <GrowthSendrSectionVideoEditor
                            pageId={pageId}
                            section={section}
                            disabled={busy}
                            onUpdated={() => void load()}
                            onMessage={setMessage}
                          />
                        ) : null}
                      </GrowthSendrBuilderSectionCard>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="personalization" className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Preview personalization</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    See how variables resolve before you send — then toggle View as prospect in the live preview.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
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
                  <Button disabled={busy} onClick={() => void runPreview()}>
                    <Wand2 className="mr-1.5 size-4" />
                    Run personalization preview
                  </Button>
                </CardContent>
              </Card>

              {!preview ? (
                <GrowthSendrBuilderEmptyState
                  icon={Wand2}
                  title="Preview as your prospect"
                  description="Run a personalization preview to see resolved names, company labels, and CTA copy in the live preview panel."
                  compact
                />
              ) : (
                <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base">Resolved variables</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium">Resolved</p>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(preview.resolved, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="font-medium">Fallbacks</p>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(preview.fallbacks, null, 2)}
                      </pre>
                    </div>
                    {preview.missing.length > 0 ? (
                      <p className="text-destructive">Missing: {preview.missing.join(", ")}</p>
                    ) : (
                      <p className="text-emerald-600 dark:text-emerald-400">All variables resolved — prospect view ready</p>
                    )}
                    <div>
                      <p className="font-medium">Rendered samples</p>
                      <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(preview.renderedSamples, null, 2)}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Page video</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Attach a Growth Video walkthrough — this becomes the hero playback on your prospect page.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {videoAsset ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-4 text-sm dark:bg-emerald-950/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-50">Video attached</p>
                          <p className="mt-1 text-muted-foreground">
                            {growthVideoAssetId
                              ? `Growth Video · ${growthVideoAssetId.slice(0, 12)}…`
                              : `Asset · ${videoAsset.id.slice(0, 12)}…`}
                          </p>
                          {videoAsset.durationSeconds ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {Math.round(videoAsset.durationSeconds / 60)} min walkthrough
                            </p>
                          ) : null}
                        </div>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void detachPageVideo()}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <GrowthSendrBuilderEmptyState
                      icon={Video}
                      title="Add your personalized video"
                      description="Record, upload, or pick from Growth Video library. Prospects see a premium player with your walkthrough front and center."
                      compact
                    />
                  )}
                  <details className="rounded-xl border border-slate-200/80 p-4 dark:border-slate-800">
                    <summary className="cursor-pointer text-sm font-medium">Legacy metadata URL (optional)</summary>
                    <div className="mt-4 space-y-3">
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
                    attachLabel={videoAsset ? "Replace video" : "Attach video"}
                    onSelect={(item) => void attachExistingVideo(item)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="booking" className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">Booking & demo scheduling</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Connect a Calendly or meeting link — prospects see a premium Schedule Demo CTA.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bookingAsset ? (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-4 text-sm dark:bg-emerald-950/20">
                      <p className="font-semibold">Booking connected</p>
                      <p className="mt-1 text-muted-foreground">{bookingAsset.meetingLink ?? bookingAsset.id}</p>
                    </div>
                  ) : !hasCtaSection ? (
                    <GrowthSendrBuilderEmptyState
                      icon={CalendarDays}
                      title="Add a booking path"
                      description="Attach a meeting link or add a calendar section so prospects can schedule while they watch."
                      compact
                    />
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
                  <Button disabled={busy} onClick={() => void registerAndAttachBooking()}>
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
              <GrowthSendrBuilderPublishPanel
                page={page}
                publications={publications}
                publicLink={publicLink}
                busy={busy}
                copied={copied}
                onPublish={() => void publishPage()}
                onArchive={() => void archivePage()}
                onCopyLink={() => void copyLink()}
              />
              {page.status !== "published" && !hasBooking && !hasCtaSection ? (
                <GrowthSendrBuilderEmptyState
                  icon={CalendarDays}
                  title="Add a CTA before you publish"
                  description="Prospects need a clear next step — attach booking or add a calendar/CTA section first."
                  compact
                />
              ) : null}
            </TabsContent>
          </Tabs>
        </div>

        <div className="hidden min-w-0 lg:block">
          <GrowthSendrBuilderLivePreview
            page={page}
            sections={sections}
            videoAsset={videoAsset}
            bookingAsset={bookingAsset}
            personalizationPreview={preview}
            sticky
          />
        </div>
      </div>
    </div>
  )
}
