"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthEnginePanelResilience } from "@/components/growth/growth-engine-panel-resilience"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { GrowthVideoOverlayPreview } from "@/components/growth/videos/growth-video-overlay-preview"
import { createDefaultGrowthVideoOverlayItem } from "@/lib/growth/videos/growth-video-overlay-render-service"
import type {
  GrowthVideoOverlayAiPayload,
  GrowthVideoOverlayB2Config,
  GrowthVideoOverlayB2Item,
  GrowthVideoOverlayB2Type,
  GrowthVideoOverlayBrandingPreview,
  GrowthVideoOverlayResolvedPreviewItem,
} from "@/lib/growth/videos/growth-video-types"

const OVERLAY_TYPES: Array<{ value: GrowthVideoOverlayB2Type; label: string }> = [
  { value: "intro_banner", label: "Intro banner" },
  { value: "company_badge", label: "Company badge" },
  { value: "cta_overlay", label: "CTA overlay" },
  { value: "calendar_overlay", label: "Calendar overlay" },
  { value: "lower_third", label: "Lower third" },
]

const POSITIONS = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "lower_third", label: "Lower third" },
  { value: "center", label: "Center" },
] as const

export function GrowthVideoPageOverlaySection({ pageId }: { pageId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [items, setItems] = useState<GrowthVideoOverlayB2Item[]>([])
  const [brandingPreview, setBrandingPreview] = useState<GrowthVideoOverlayBrandingPreview | null>(null)
  const [previewItems, setPreviewItems] = useState<GrowthVideoOverlayResolvedPreviewItem[]>([])
  const [missingVariables, setMissingVariables] = useState<string[]>([])
  const [aiPayload, setAiPayload] = useState<GrowthVideoOverlayAiPayload | null>(null)
  const [selectedType, setSelectedType] = useState<GrowthVideoOverlayB2Type>("intro_banner")

  const [firstName, setFirstName] = useState("John")
  const [lastName, setLastName] = useState("Smith")
  const [company, setCompany] = useState("Precision Biomedical")
  const [industry, setIndustry] = useState("Medical Equipment")
  const [title, setTitle] = useState("Director of Operations")
  const [senderName, setSenderName] = useState("Alex Rivera")
  const [senderCompany, setSenderCompany] = useState("Equipify")
  const [ctaLabel, setCtaLabel] = useState("Book a demo")

  const previewFormBody = () => ({
    preview_form: {
      first_name: firstName,
      last_name: lastName,
      company,
      industry,
      title,
      sender_name: senderName,
      sender_company: senderCompany,
      cta_label: ctaLabel,
    },
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/overlays`)
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        overlays?: GrowthVideoOverlayB2Config
        ai_payload?: GrowthVideoOverlayAiPayload
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load overlays.")
      setEnabled(data.overlays?.enabled ?? false)
      setItems(data.overlays?.items ?? [])
      setAiPayload(data.ai_payload ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    void load()
  }, [load])

  async function runPreview(nextConfig?: GrowthVideoOverlayB2Config) {
    setActing(true)
    setError(null)
    try {
      const config = nextConfig ?? { enabled, items }
      const res = await fetch("/api/growth/videos/overlays/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          overlays: config,
          ...previewFormBody(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        preview_items?: GrowthVideoOverlayResolvedPreviewItem[]
        branding_preview?: GrowthVideoOverlayBrandingPreview
        missing_variables?: string[]
        ai_payload?: GrowthVideoOverlayAiPayload
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Preview failed.")
      setPreviewItems(data.preview_items ?? [])
      setBrandingPreview(data.branding_preview ?? null)
      setMissingVariables(data.missing_variables ?? [])
      setAiPayload(data.ai_payload ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed.")
    } finally {
      setActing(false)
    }
  }

  async function saveConfig(nextConfig: GrowthVideoOverlayB2Config) {
    setActing(true)
    setError(null)
    try {
      const res = await fetch(`/api/growth/videos/pages/${encodeURIComponent(pageId)}/overlays`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextConfig.enabled,
          items: nextConfig.items,
          ...previewFormBody(),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        overlays?: GrowthVideoOverlayB2Config
        preview_items?: GrowthVideoOverlayResolvedPreviewItem[]
        ai_payload?: GrowthVideoOverlayAiPayload
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Save failed.")
      setEnabled(data.overlays?.enabled ?? false)
      setItems(data.overlays?.items ?? [])
      setPreviewItems(data.preview_items ?? [])
      setAiPayload(data.ai_payload ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setActing(false)
    }
  }

  function addOverlay() {
    const next = { enabled, items: [...items, createDefaultGrowthVideoOverlayItem(selectedType)] }
    setItems(next.items)
    void runPreview(next)
  }

  function updateItem(id: string, patch: Partial<GrowthVideoOverlayB2Item>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  return (
    <GrowthEnginePanelResilience loading={loading} error={error} onRetry={() => void load()}>
      <div className="space-y-6">
        <GrowthEngineCard title="Overlay settings" className="p-5 sm:p-6">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label="Enable overlay preview on public page"
              />
              Enable overlay preview
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label>Overlay type</Label>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as GrowthVideoOverlayB2Type)}
                  aria-label="Select overlay type to add"
                >
                  {OVERLAY_TYPES.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => addOverlay()}>
                <Plus className="mr-1 size-3.5" />
                Add overlay
              </Button>
            </div>
          </div>
        </GrowthEngineCard>

        {items.map((item) => (
          <GrowthEngineCard key={item.id} title={OVERLAY_TYPES.find((t) => t.value === item.type)?.label ?? item.type}>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.enabled}
                  onChange={(e) => updateItem(item.id, { enabled: e.target.checked })}
                  aria-label={`Enable ${item.type} overlay`}
                />
                Enabled
              </label>
              <div className="space-y-2">
                <Label>Text template</Label>
                <Textarea
                  value={item.textTemplate}
                  onChange={(e) => updateItem(item.id, { textTemplate: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <select
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={item.position}
                    onChange={(e) =>
                      updateItem(item.id, {
                        position: e.target.value as GrowthVideoOverlayB2Item["position"],
                      })
                    }
                  >
                    {POSITIONS.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Opacity</Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={item.style.opacity ?? 0.72}
                    onChange={(e) =>
                      updateItem(item.id, {
                        style: { ...item.style, opacity: Number(e.target.value) },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Background</Label>
                  <Input
                    value={item.style.backgroundColor ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        style: { ...item.style, backgroundColor: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Text color</Label>
                  <Input
                    value={item.style.textColor ?? ""}
                    onChange={(e) =>
                      updateItem(item.id, {
                        style: { ...item.style, textColor: e.target.value },
                      })
                    }
                  />
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => removeItem(item.id)}>
                <Trash2 className="mr-1 size-3.5" />
                Remove
              </Button>
            </div>
          </GrowthEngineCard>
        ))}

        <GrowthEngineCard title="Preview form" className="p-5 sm:p-6">
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
            <div className="space-y-2">
              <Label>Sender Name</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sender Company</Label>
              <Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CTA Label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void runPreview()} disabled={acting}>
              {acting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Render preview
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={acting}
              onClick={() => void saveConfig({ enabled, items })}
            >
              Save overlays
            </Button>
          </div>
        </GrowthEngineCard>

        {brandingPreview ? (
          <GrowthEngineCard title="Branding preview">
            <pre className="rounded-lg bg-muted/40 p-3 text-xs">{JSON.stringify(brandingPreview, null, 2)}</pre>
          </GrowthEngineCard>
        ) : null}

        <GrowthVideoOverlayPreview previewItems={previewItems} />

        <GrowthEngineCard title="Missing variables">
          {missingVariables.length ? (
            <p className="text-sm text-amber-700">{missingVariables.join(", ")}</p>
          ) : (
            <p className="text-sm text-muted-foreground">None detected for current preview.</p>
          )}
        </GrowthEngineCard>

        <GrowthEngineCard title="Raw JSON">
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
            {JSON.stringify({ enabled, items }, null, 2)}
          </pre>
        </GrowthEngineCard>

        {aiPayload ? (
          <GrowthEngineCard title="AI payload (metadata only)">
            <p className="text-xs text-muted-foreground">Overlay score: {aiPayload.overlay_score}</p>
            <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
              {JSON.stringify(aiPayload, null, 2)}
            </pre>
          </GrowthEngineCard>
        ) : null}
      </div>
    </GrowthEnginePanelResilience>
  )
}
