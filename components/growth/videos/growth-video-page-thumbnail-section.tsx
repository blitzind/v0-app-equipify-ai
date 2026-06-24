"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import type {
  GrowthVideoThumbnailAiPayload,
  GrowthVideoThumbnailMetadata,
  GrowthVideoThumbnailType,
} from "@/lib/growth/videos/growth-video-types"

const THUMBNAIL_TYPES: Array<{ value: GrowthVideoThumbnailType; label: string }> = [
  { value: "prospect", label: "Prospect" },
  { value: "company", label: "Company" },
  { value: "cta", label: "CTA" },
  { value: "open_graph", label: "Open Graph" },
]

type ThumbnailState = {
  thumbnail: GrowthVideoThumbnailMetadata | null
  aiPayload: GrowthVideoThumbnailAiPayload | null
  videoAssetId: string | null
}

export function GrowthVideoPageThumbnailSection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<ThumbnailState | null>(null)
  const [acting, setActing] = useState(false)

  const [thumbnailType, setThumbnailType] = useState<GrowthVideoThumbnailType>("prospect")
  const [firstName, setFirstName] = useState("John")
  const [lastName, setLastName] = useState("Smith")
  const [company, setCompany] = useState("Precision Biomedical")
  const [industry, setIndustry] = useState("Medical Equipment")
  const [title, setTitle] = useState("Director of Operations")
  const [companyLogoUrl, setCompanyLogoUrl] = useState("")
  const [ctaLabel, setCtaLabel] = useState("Watch Video")

  const [previewThumbnailUrl, setPreviewThumbnailUrl] = useState<string | null>(null)
  const [previewOgUrl, setPreviewOgUrl] = useState<string | null>(null)
  const [previewLayout, setPreviewLayout] = useState<Record<string, string> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/thumbnail`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        thumbnail?: GrowthVideoThumbnailMetadata | null
        ai_payload?: GrowthVideoThumbnailAiPayload | null
        video_asset_id?: string | null
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load thumbnail state.")
      setState({
        thumbnail: data.thumbnail ?? null,
        aiPayload: data.ai_payload ?? null,
        videoAssetId: data.video_asset_id ?? null,
      })
      if (data.thumbnail?.type) setThumbnailType(data.thumbnail.type)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  function previewFormBody() {
    return {
      preview_form: {
        first_name: firstName,
        last_name: lastName,
        company,
        industry,
        title,
        company_logo_url: companyLogoUrl.trim() || undefined,
        cta_label: ctaLabel,
      },
    }
  }

  async function runPreview() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/videos/thumbnails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          thumbnail_type: thumbnailType,
          ...previewFormBody(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        preview?: {
          thumbnail_data_url?: string
          og_data_url?: string
          thumbnail_layout?: Record<string, string>
        }
        ai_payload?: GrowthVideoThumbnailAiPayload
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Preview failed.")
      setPreviewThumbnailUrl(data.preview?.thumbnail_data_url ?? null)
      setPreviewOgUrl(data.preview?.og_data_url ?? null)
      setPreviewLayout(data.preview?.thumbnail_layout ?? null)
      if (data.ai_payload) {
        setState((prev) => (prev ? { ...prev, aiPayload: data.ai_payload ?? null } : prev))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setActing(false)
    }
  }

  async function generateAndPersist() {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/thumbnail`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thumbnail_type: thumbnailType,
          ...previewFormBody(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        thumbnail?: GrowthVideoThumbnailMetadata
        ai_payload?: GrowthVideoThumbnailAiPayload
        preview?: { thumbnail_data_url?: string; og_data_url?: string }
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Generate failed.")
      setState({
        thumbnail: data.thumbnail ?? null,
        aiPayload: data.ai_payload ?? null,
        videoAssetId: state?.videoAssetId ?? null,
      })
      setPreviewThumbnailUrl(
        data.thumbnail?.thumbnailSignedUrl ?? data.preview?.thumbnail_data_url ?? null,
      )
      setPreviewOgUrl(data.thumbnail?.ogSignedUrl ?? data.preview?.og_data_url ?? null)
      setPreviewLayout(data.thumbnail?.layout ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed.")
    } finally {
      setActing(false)
    }
  }

  const storedThumbnailUrl =
    state?.thumbnail?.thumbnailSignedUrl ?? previewThumbnailUrl ?? null
  const storedOgUrl = state?.thumbnail?.ogSignedUrl ?? previewOgUrl ?? null

  return (
    <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Thumbnail type</h3>
          <div className="flex flex-wrap gap-2">
            {THUMBNAIL_TYPES.map((entry) => (
              <Button
                key={entry.value}
                size="sm"
                type="button"
                variant={thumbnailType === entry.value ? "default" : "outline"}
                onClick={() => setThumbnailType(entry.value)}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Merge variables (preview form)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <GrowthMediaPicker
                label="Company logo"
                value={companyLogoUrl}
                acceptedTypes={["logo", "image"]}
                allowManualUrl
                onChange={setCompanyLogoUrl}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>CTA Label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={acting}>
              {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Render preview
            </Button>
            <Button type="button" variant="secondary" onClick={() => void generateAndPersist()} disabled={acting}>
              Generate &amp; persist
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Rendered preview</h3>
          {previewLayout ? (
            <div className="text-sm text-muted-foreground">
              <p>{previewLayout.headline}</p>
              <p>{previewLayout.subheadline}</p>
            </div>
          ) : null}
          {storedThumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storedThumbnailUrl}
              alt="Thumbnail preview"
              className="max-w-full rounded-lg border border-border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Run preview or generate to see thumbnail.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Open Graph preview</h3>
          {storedOgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storedOgUrl}
              alt="Open Graph preview"
              className="max-w-full rounded-lg border border-border"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Open Graph image not generated yet.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-medium">Storage metadata</h3>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Video asset</dt>
              <dd className="font-mono">{state?.videoAssetId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Thumbnail path</dt>
              <dd className="break-all font-mono">{state?.thumbnail?.thumbnailStoragePath ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">OG path</dt>
              <dd className="break-all font-mono">{state?.thumbnail?.ogStoragePath ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Generated at</dt>
              <dd>{state?.thumbnail?.generatedAt ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-medium">Raw JSON</h3>
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
            {JSON.stringify(state?.thumbnail ?? {}, null, 2)}
          </pre>
          {state?.aiPayload ? (
            <>
              <h4 className="text-xs font-medium text-muted-foreground">AI payload (metadata only)</h4>
              <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
                {JSON.stringify(state.aiPayload, null, 2)}
              </pre>
            </>
          ) : null}
        </section>
      </div>
    </GrowthEnginePanelResilience>
  )
}
