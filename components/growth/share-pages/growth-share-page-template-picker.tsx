"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, ExternalLink, Eye, LayoutTemplate, Loader2, Sparkles, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { GrowthMediaPicker } from "@/components/growth/media-library/growth-media-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME,
  GROWTH_SHARE_PAGE_QUICK_TEMPLATES,
  getSharePageQuickTemplate,
  parseSharePageExtendedTheme,
  type GrowthSharePageTheme,
} from "@/lib/growth/share-pages/share-page-types"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import { GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES } from "@/lib/growth/share-pages/share-page-template-types"

const CATEGORY_LABELS: Record<string, string> = {
  general: "Introduction",
  outbound: "Introduction",
  follow_up: "Meeting Follow-up",
  meeting_prep: "Meeting Follow-up",
  case_study: "Proposal",
  custom: "Custom",
}

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, " ")
}

export function GrowthSharePageTemplatePicker({
  value,
  onChange,
}: {
  value: GrowthSharePageTemplate | null
  onChange: (template: GrowthSharePageTemplate | null) => void
}) {
  const pathname = usePathname()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<GrowthSharePageTemplate[]>([])
  const [categoryFilter, setCategoryFilter] = useState<string>("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/share-pages/templates?status=published&limit=100")
        const data = (await res.json()) as {
          ok?: boolean
          items?: GrowthSharePageTemplate[]
          message?: string
        }
        if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load templates.")
        if (!cancelled) setTemplates(data.items ?? [])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Load failed.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!categoryFilter) return templates
    return templates.filter((template) => template.category === categoryFilter)
  }, [categoryFilter, templates])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading templates…
      </p>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryFilter("")}
          className={`rounded-full border px-3 py-1 text-xs ${!categoryFilter ? "bg-primary text-primary-foreground" : ""}`}
        >
          All
        </button>
        {GROWTH_SHARE_PAGE_TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setCategoryFilter(category)}
            className={`rounded-full border px-3 py-1 text-xs ${
              categoryFilter === category ? "bg-primary text-primary-foreground" : ""
            }`}
          >
            {categoryLabel(category)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No published templates yet.{" "}
          <Link href={growthFeaturePath(pathname, "share-pages/templates")} className="font-medium text-primary">
            Create a template
          </Link>{" "}
          to reuse page layouts.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((template) => {
            const selected = value?.id === template.id
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChange(selected ? null : template)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{template.name}</span>
                      <GrowthBadge tone="healthy" label={categoryLabel(template.category)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {template.description || "No description"}
                    </p>
                  </div>
                  {template.previewImageUrl ? (
                    <div
                      className="size-14 shrink-0 rounded-xl border border-border bg-cover bg-center"
                      style={{ backgroundImage: `url(${template.previewImageUrl})` }}
                      aria-hidden
                    />
                  ) : (
                    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30">
                      <LayoutTemplate className="size-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={growthFeaturePath(pathname, `share-pages/templates/${template.id}/preview`)}>
                      <Eye className="mr-1.5 size-3.5" />
                      Preview template
                    </Link>
                  </Button>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}


function GrowthSharePageBuilderColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-border bg-background p-1"
          aria-label={`Pick ${label}`}
        />
        <Input id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  )
}


type BrandingFieldsProps = {
  theme: GrowthSharePageTheme
  footerText: string
  heroImageUrl: string
  disabled?: boolean
  onThemeChange: (theme: GrowthSharePageTheme) => void
  onFooterTextChange: (value: string) => void
  onHeroImageUrlChange: (value: string) => void
}

export function GrowthSharePageBrandingFields({
  theme,
  footerText,
  heroImageUrl,
  disabled,
  onThemeChange,
  onFooterTextChange,
  onHeroImageUrlChange,
}: BrandingFieldsProps) {
  const defaults = GROWTH_SHARE_PAGE_OPERATOR_DEFAULT_THEME

  function update(patch: Partial<GrowthSharePageTheme>) {
    onThemeChange(parseSharePageExtendedTheme({ ...theme, ...patch }))
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Saved with your share page — applies to live preview and published public pages at /p/[token].
      </p>

      <GrowthMediaPicker
        label="Logo"
        value={theme.logoUrl ?? ""}
        disabled={disabled}
        acceptedTypes={["logo", "image"]}
        allowManualUrl
        onChange={(url) => update({ logoUrl: url || null })}
      />

      <GrowthMediaPicker
        label="Hero image"
        value={heroImageUrl}
        disabled={disabled}
        acceptedTypes={["image"]}
        allowManualUrl
        onChange={(url) => onHeroImageUrlChange(url)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <GrowthSharePageBuilderColorField
          id="headerBackground"
          label="Header background"
          value={theme.headerBackground ?? defaults.headerBackground}
          disabled={disabled}
          onChange={(headerBackground) => update({ headerBackground })}
        />
        <GrowthSharePageBuilderColorField
          id="headerText"
          label="Header text"
          value={theme.headerText ?? defaults.headerText}
          disabled={disabled}
          onChange={(headerText) => update({ headerText })}
        />
        <GrowthSharePageBuilderColorField
          id="pageBackground"
          label="Page background"
          value={theme.pageBackground ?? defaults.pageBackground}
          disabled={disabled}
          onChange={(pageBackground) => update({ pageBackground })}
        />
        <GrowthSharePageBuilderColorField
          id="pageText"
          label="Page text"
          value={theme.pageText ?? defaults.pageText}
          disabled={disabled}
          onChange={(pageText) => update({ pageText })}
        />
        <GrowthSharePageBuilderColorField
          id="surfaceColor"
          label="Surface / card color"
          value={theme.surfaceColor ?? defaults.surfaceColor}
          disabled={disabled}
          onChange={(surfaceColor) => update({ surfaceColor })}
        />
        <GrowthSharePageBuilderColorField
          id="accentColor"
          label="Accent color"
          value={theme.accentColor}
          disabled={disabled}
          onChange={(accentColor) => update({ accentColor, brandColor: accentColor })}
        />
        <GrowthSharePageBuilderColorField
          id="buttonBackground"
          label="Button background"
          value={theme.buttonBackground ?? defaults.buttonBackground}
          disabled={disabled}
          onChange={(buttonBackground) => update({ buttonBackground })}
        />
        <GrowthSharePageBuilderColorField
          id="buttonText"
          label="Button text"
          value={theme.buttonText ?? defaults.buttonText}
          disabled={disabled}
          onChange={(buttonText) => update({ buttonText })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="footerText">Footer text</Label>
        <Input
          id="footerText"
          value={footerText}
          disabled={disabled}
          onChange={(e) => onFooterTextChange(e.target.value)}
          placeholder="Personalized share page · Secure viewing"
        />
      </div>
    </div>
  )
}



type BookingPageItem = {
  id: string
  name: string
  slug: string
  pageTitle: string | null
  durationMinutes: number
  enabled: boolean
  bookingLink: string
}

type Props = {
  bookingPageId: string
  calendarUrl: string
  disabled?: boolean
  onBookingPageIdChange: (value: string) => void
  onCalendarUrlChange: (value: string) => void
}

export function GrowthSharePageBookingPagePicker({
  bookingPageId,
  calendarUrl,
  disabled,
  onBookingPageIdChange,
  onCalendarUrlChange,
}: Props) {
  const [pages, setPages] = useState<BookingPageItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/booking-pages", { cache: "no-store" })
      const data = (await res.json()) as { ok?: boolean; pages?: BookingPageItem[] }
      setPages(data.pages ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPages()
  }, [loadPages])

  function selectPage(page: BookingPageItem) {
    onBookingPageIdChange(page.id)
    onCalendarUrlChange(page.bookingLink)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Select existing booking page (optional)</Label>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading booking pages…
          </p>
        ) : pages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p>No booking pages yet. Create one in Growth settings, or paste a calendar URL below.</p>
            <Button size="sm" variant="outline" className="mt-3" asChild>
              <Link href="/admin/growth/settings/communications">Create booking page</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                disabled={disabled}
                onClick={() => selectPage(page)}
                className="flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{page.pageTitle ?? page.name}</p>
                    <Badge variant={page.enabled ? "default" : "secondary"}>
                      {page.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {bookingPageId === page.id ? <Badge variant="outline">Selected</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {page.durationMinutes} min · /book/{page.slug}
                  </p>
                </div>
                <ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-dashed p-4">
        <Label htmlFor="calendarUrlManual">Or paste calendar URL manually</Label>
        <Input
          id="calendarUrlManual"
          value={calendarUrl}
          disabled={disabled}
          onChange={(e) => onCalendarUrlChange(e.target.value)}
          inputMode="url"
          placeholder="https://"
        />
        {bookingPageId ? (
          <p className="text-xs text-muted-foreground">
            <CalendarDays className="mr-1 inline size-3.5" />
            Booking page reference saved — public CTA uses attributed booking link when published.
          </p>
        ) : null}
      </div>
    </div>
  )
}


export type SharePageAiDraftResult = {
  headline: string
  heroMessage: string
  whyReachingOut: string
  companyObservations: string[]
  ctaLabel: string
  provider: "ai" | "template_fallback"
  message?: string
}

type Props = {
  disabled?: boolean
  onDraftReady: (draft: SharePageAiDraftResult) => void
  onMessage: (message: string | null) => void
}

export function GrowthSharePageAiDraftPanel({ disabled, onDraftReady, onMessage }: Props) {
  const [targetCompany, setTargetCompany] = useState("")
  const [targetPerson, setTargetPerson] = useState("")
  const [industry, setIndustry] = useState("")
  const [pageObjective, setPageObjective] = useState("")
  const [painPoints, setPainPoints] = useState("")
  const [desiredCta, setDesiredCta] = useState("Schedule Demo")
  const [tone, setTone] = useState("professional")
  const [templateId, setTemplateId] = useState("general_field_service")
  const [draft, setDraft] = useState<SharePageAiDraftResult | null>(null)
  const [generating, setGenerating] = useState(false)

  async function generateDraft() {
    setGenerating(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/share-pages/builder/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCompany,
          targetPerson,
          industry,
          pageObjective,
          painPoints,
          desiredCta,
          tone,
          templateId,
        }),
      })
      const data = (await res.json()) as { ok: boolean; draft?: SharePageAiDraftResult; message?: string }
      if (!res.ok || !data.draft) {
        onMessage(data.message ?? "Generation failed")
        return
      }
      setDraft(data.draft)
      onMessage(data.draft.message ?? "Draft ready — review before saving.")
    } finally {
      setGenerating(false)
    }
  }

  function applyDraft() {
    if (!draft) return
    onDraftReady(draft)
    onMessage("Draft applied to form — review and edit before publishing.")
  }

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4" />
          Generate with AI
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Operator-driven draft only — review before save or publish. Falls back to templates if AI is unavailable.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Target company</Label>
          <Input value={targetCompany} disabled={disabled || generating} onChange={(e) => setTargetCompany(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Target person</Label>
          <Input value={targetPerson} disabled={disabled || generating} onChange={(e) => setTargetPerson(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={industry} disabled={disabled || generating} onChange={(e) => setIndustry(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Page objective</Label>
          <Input value={pageObjective} disabled={disabled || generating} onChange={(e) => setPageObjective(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Pain points</Label>
        <Textarea value={painPoints} disabled={disabled || generating} onChange={(e) => setPainPoints(e.target.value)} rows={3} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Desired CTA</Label>
          <Input value={desiredCta} disabled={disabled || generating} onChange={(e) => setDesiredCta(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Fallback template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GROWTH_SHARE_PAGE_QUICK_TEMPLATES.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={disabled || generating} onClick={() => void generateDraft()}>
          {generating ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Wand2 className="mr-1.5 size-4" />}
          Generate draft
        </Button>
        {draft ? (
          <Button type="button" variant="secondary" disabled={disabled} onClick={applyDraft}>
            Apply draft to form
          </Button>
        ) : null}
      </div>

      {draft ? (
        <div className="rounded-lg border bg-background p-3 text-sm">
          <p className="font-medium">Preview ({draft.provider === "ai" ? "AI" : "template fallback"})</p>
          <p className="mt-1 text-muted-foreground">{draft.headline}</p>
        </div>
      ) : null}
    </div>
  )
}


type QuickTemplatePickerProps = {
  value: string
  disabled?: boolean
  onChange: (templateId: string) => void
  onApply: (templateId: string) => void
}

export function GrowthSharePageQuickTemplatePicker({ value, disabled, onChange, onApply }: QuickTemplatePickerProps) {
  const selected = getSharePageQuickTemplate(value)

  return (
    <div className="space-y-3 rounded-xl border border-dashed p-4">
      <div>
        <Label>Quick-start template (no AI required)</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Seeds headline, intro, benefits, and CTA — edit before publishing.
        </p>
      </div>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Choose a template" />
        </SelectTrigger>
        <SelectContent>
          {GROWTH_SHARE_PAGE_QUICK_TEMPLATES.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              {template.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected ? <p className="text-xs text-muted-foreground">{selected.description}</p> : null}
      <Button type="button" size="sm" variant="outline" disabled={disabled || !value} onClick={() => onApply(value)}>
        Apply quick-start template
      </Button>
    </div>
  )
}


export { categoryLabel as growthSharePageTemplateCategoryLabel }
