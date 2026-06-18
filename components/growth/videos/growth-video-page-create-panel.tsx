"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
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
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { useGrowthVideoAssetsForPages } from "@/components/growth/videos/use-growth-video-pages"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"

export function GrowthVideoPageCreatePanel() {
  const router = useRouter()
  const pathname = usePathname()
  const { assets, loading, loadAssets } = useGrowthVideoAssetsForPages()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [videoAssetId, setVideoAssetId] = useState("")
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [ctaLabel, setCtaLabel] = useState("Book a demo")
  const [ctaUrl, setCtaUrl] = useState("")
  const [calendarUrl, setCalendarUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#2563eb")
  const [buttonLabelOverride, setButtonLabelOverride] = useState("")

  useEffect(() => {
    void loadAssets()
  }, [loadAssets])

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
    <GrowthVideoWorkspaceShell title="New Video Page" description="Create a draft shareable page from an uploaded asset.">
      <form className="mx-auto max-w-2xl space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div className="space-y-2">
          <Label>Video asset</Label>
          <Select value={videoAssetId} onValueChange={setVideoAssetId} disabled={loading}>
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading assets…" : "Select ready video"} />
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

        <div className="space-y-2">
          <Label htmlFor="title">Page title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug (optional)</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-from-title" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ctaLabel">CTA label</Label>
            <Input id="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaUrl">CTA URL</Label>
            <Input id="ctaUrl" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="calendarUrl">Calendar URL</Label>
          <Input id="calendarUrl" value={calendarUrl} onChange={(e) => setCalendarUrl(e.target.value)} placeholder="https://" />
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <p className="text-sm font-medium">Branding</p>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary color</Label>
              <Input id="primaryColor" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buttonLabelOverride">Button label override</Label>
              <Input
                id="buttonLabelOverride"
                value={buttonLabelOverride}
                onChange={(e) => setButtonLabelOverride(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={submitting || !videoAssetId || !title.trim()}>
            {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
            Save draft
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={growthFeaturePath(pathname, "videos/pages")}>Cancel</Link>
          </Button>
        </div>
      </form>
    </GrowthVideoWorkspaceShell>
  )
}
