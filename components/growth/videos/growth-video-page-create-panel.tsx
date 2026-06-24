"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import {
  ChevronDown,
  Eye,
  FileText,
  Loader2,
  Megaphone,
  Palette,
  Sparkles,
  Video,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import {
  GrowthVideoPagePreviewCard,
  type GrowthVideoPagePreviewModel,
} from "@/components/growth/videos/growth-video-page-preview-card"
import { GrowthVideoPageStepCard } from "@/components/growth/videos/growth-video-page-step-card"
import { GrowthStickyActionBar } from "@/components/growth/shell/growth-workspace-shell"
import { GrowthWorkspaceSafeArea } from "@/components/growth/shell/growth-workspace-shell"
import { useGrowthVideoAssetsForPages } from "@/components/growth/videos/use-growth-video-pages"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  buildGrowthVideoPublicPath,
  normalizeGrowthVideoPageSlug,
} from "@/lib/growth/videos/growth-video-page-validation"
import { GROWTH_VIDEO_FOUNDATION_QA_MARKER } from "@/lib/growth/videos/growth-video-types"
import { cn } from "@/lib/utils"

const FORM_ID = "growth-video-page-create-form"
const PREVIEW_ID = "growth-video-page-preview"

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—"
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins <= 0) return `${secs}s`
  return `${mins}m ${secs.toString().padStart(2, "0")}s`
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—"
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function GrowthVideoPageCreatePanel() {
  const router = useRouter()
  const pathname = usePathname()
  const previewRef = useRef<HTMLDivElement | null>(null)
  const { assets, loading, loadAssets } = useGrowthVideoAssetsForPages()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const [videoAssetId, setVideoAssetId] = useState("")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManual, setSlugManual] = useState(false)
  const [description, setDescription] = useState("")
  const [ctaLabel, setCtaLabel] = useState("Book a demo")
  const [ctaUrl, setCtaUrl] = useState("")
  const [calendarUrl, setCalendarUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [accentColor, setAccentColor] = useState("#60a5fa")
  const [buttonLabelOverride, setButtonLabelOverride] = useState("")
  const [footerText, setFooterText] = useState("")

  useGrowthBreadcrumbDetail("New")

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

  useEffect(() => {
    if (slugManual) return
    if (!title.trim()) {
      setSlug("")
      return
    }
    setSlug(normalizeGrowthVideoPageSlug(title))
  }, [title, slugManual])

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === videoAssetId) ?? null,
    [assets, videoAssetId],
  )

  const effectiveSlug = slug.trim() || (title.trim() ? normalizeGrowthVideoPageSlug(title) : "")

  const publicUrlPreview = useMemo(() => {
    if (effectiveSlug.length < 3) return null
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://app.equipify.ai"
    return `${origin}${buildGrowthVideoPublicPath(effectiveSlug)}`
  }, [effectiveSlug])

  const previewModel: GrowthVideoPagePreviewModel = useMemo(
    () => ({
      title,
      description,
      slug: effectiveSlug,
      ctaLabel,
      ctaUrl,
      calendarUrl,
      logoUrl,
      primaryColor,
      accentColor,
      buttonLabelOverride,
      footerText,
      videoTitle: selectedAsset?.title ?? null,
    }),
    [
      title,
      description,
      effectiveSlug,
      ctaLabel,
      ctaUrl,
      calendarUrl,
      logoUrl,
      primaryColor,
      accentColor,
      buttonLabelOverride,
      footerText,
      selectedAsset?.title,
    ],
  )

  const canSubmit = Boolean(videoAssetId && title.trim()) && !submitting

  function scrollToPreview() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setPreviewOpen(true)
    }
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_asset_id: videoAssetId,
          title,
          slug: slug.trim() || undefined,
          description: description.trim() || null,
          cta_label: ctaLabel.trim() || null,
          cta_url: ctaUrl.trim() || null,
          calendar_url: calendarUrl.trim() || null,
          branding: {
            logoUrl: logoUrl.trim() || null,
            primaryColor: primaryColor.trim() || null,
            buttonLabelOverride: buttonLabelOverride.trim() || null,
          },
          personalization: { variables: {}, mergeFields: [] },
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; page?: { id: string }; message?: string }
      if (!res.ok || !data.ok || !data.page?.id) {
        throw new Error(data.message ?? "Could not create video page.")
      }
      router.push(growthFeaturePath(pathname, `videos/pages/${data.page.id}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <GrowthWorkspaceSafeArea variant="sticky-footer" className="mx-auto w-full max-w-[1200px]" data-qa-marker={GROWTH_VIDEO_FOUNDATION_QA_MARKER}>
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">New Video Page</h1>
            <GrowthBadge label="Draft" tone="neutral" />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Create a personalized landing page from an uploaded video asset.
          </p>
          <p className="text-xs text-muted-foreground">
            Human-supervised workspace — save as draft before publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link
              href={growthFeaturePath(pathname, "sendr/new")}
              title="AI page generation lives in Personalized Videos — operator review required before publish"
            >
              <Sparkles className="mr-1.5 size-4" aria-hidden />
              Generate With AI
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={scrollToPreview}
          >
            <Eye className="mr-1.5 size-4" aria-hidden />
            Preview
          </Button>
          <Button
            type="submit"
            size="sm"
            form={FORM_ID}
            disabled={!canSubmit}
          >
            {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
            Save Draft
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-8 lg:col-span-3">
          <form id={FORM_ID} className="space-y-8" onSubmit={(e) => void handleSubmit(e)}>
            <GrowthVideoPageStepCard step={1} title="Select Video Asset" icon={Video} required>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading video assets…</p>
              ) : assets.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">No videos uploaded yet.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Upload a video first.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                    <Link href={growthFeaturePath(pathname, "videos/library")}>Go to Library</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="videoAssetId">Video asset</Label>
                    <Select value={videoAssetId} onValueChange={setVideoAssetId}>
                      <SelectTrigger id="videoAssetId">
                        <SelectValue placeholder="Select ready video" />
                      </SelectTrigger>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            {asset.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAsset ? (
                    <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 sm:grid-cols-[120px_1fr]">
                      <div className="flex aspect-video items-center justify-center rounded-md border border-border bg-background">
                        <Video className="size-8 text-muted-foreground/60" aria-hidden />
                      </div>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">Duration</dt>
                          <dd className="font-medium">{formatDuration(selectedAsset.durationSeconds)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Upload status</dt>
                          <dd className="font-medium capitalize">{selectedAsset.uploadStatus.replace(/_/g, " ")}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Asset status</dt>
                          <dd className="font-medium capitalize">{selectedAsset.status}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">File</dt>
                          <dd className="font-medium">
                            {selectedAsset.mimeType ?? "—"} · {formatFileSize(selectedAsset.fileSizeBytes)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}
                </div>
              )}
            </GrowthVideoPageStepCard>

            <GrowthVideoPageStepCard step={2} title="Page Information" icon={FileText}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Page title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Acme Corp — personalized intro"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => {
                        setSlugManual(true)
                        setSlug(e.target.value)
                      }}
                      placeholder="page-title"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from title. Edit to customize the public URL segment.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Short intro shown below the video on the public page."
                  />
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Public URL Preview
                  </p>
                  <p className="mt-1 break-all font-mono text-sm text-foreground">
                    {publicUrlPreview ?? "Enter a title with at least 3 slug characters to preview the URL."}
                  </p>
                </div>
              </div>
            </GrowthVideoPageStepCard>

            <GrowthVideoPageStepCard step={3} title="Calls To Action" icon={Megaphone}>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ctaLabel">CTA label</Label>
                    <Input
                      id="ctaLabel"
                      value={ctaLabel}
                      onChange={(e) => setCtaLabel(e.target.value)}
                      placeholder="Book Demo"
                    />
                    <p className="text-xs text-muted-foreground">Examples: Book Demo, Schedule Consultation, Request Pricing</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctaUrl">CTA URL</Label>
                    <Input
                      id="ctaUrl"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="https://"
                      inputMode="url"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="calendarUrl">Calendar URL</Label>
                  <Input
                    id="calendarUrl"
                    value={calendarUrl}
                    onChange={(e) => setCalendarUrl(e.target.value)}
                    placeholder="https://cal.com/your-team/demo"
                    inputMode="url"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional second button for scheduling — shown when a calendar link is provided.
                  </p>
                </div>
              </div>
            </GrowthVideoPageStepCard>

            <GrowthVideoPageStepCard step={4} title="Branding" icon={Palette}>
              <div className="space-y-4">
                <GrowthMediaPicker
                  label="Logo"
                  value={logoUrl}
                  acceptedTypes={["logo", "image"]}
                  allowManualUrl
                  onChange={setLogoUrl}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="primaryColorPicker"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
                        aria-label="Pick primary color"
                      />
                      <Input
                        id="primaryColor"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        id="accentColorPicker"
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
                        aria-label="Pick accent color"
                      />
                      <Input
                        id="accentColor"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Preview only — not saved until page editor supports accent color.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="buttonLabelOverride">Button label override</Label>
                  <Input
                    id="buttonLabelOverride"
                    value={buttonLabelOverride}
                    onChange={(e) => setButtonLabelOverride(e.target.value)}
                    placeholder="Optional label shown instead of CTA label"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footerText">Footer text</Label>
                  <Input
                    id="footerText"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="© Your company · Privacy · Terms"
                  />
                  <p className="text-xs text-muted-foreground">Preview only — not saved on draft create.</p>
                </div>
              </div>
            </GrowthVideoPageStepCard>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <aside ref={previewRef} className="lg:col-span-2">
          <div className="hidden lg:block lg:sticky lg:top-4">
            <GrowthVideoPagePreviewCard id={PREVIEW_ID} model={previewModel} />
          </div>

          <Collapsible open={previewOpen} onOpenChange={setPreviewOpen} className="lg:hidden">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="flex w-full items-center justify-between"
                aria-expanded={previewOpen}
                aria-controls={`${PREVIEW_ID}-mobile`}
              >
                <span className="flex items-center gap-2">
                  <Eye className="size-4" aria-hidden />
                  Live Page Preview
                </span>
                <ChevronDown
                  className={cn("size-4 transition-transform", previewOpen ? "rotate-180" : "")}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent id={`${PREVIEW_ID}-mobile`} className="mt-3">
              <GrowthVideoPagePreviewCard model={previewModel} />
            </CollapsibleContent>
          </Collapsible>
        </aside>
      </div>

      <GrowthStickyActionBar ariaLabel="Page actions">
        <Button type="button" variant="ghost" asChild>
          <Link href={growthFeaturePath(pathname, "videos/pages")}>Cancel</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={scrollToPreview}>
            Preview
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
            {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
            Save Draft
          </Button>
        </div>
      </GrowthStickyActionBar>
    </GrowthWorkspaceSafeArea>
  )
}
