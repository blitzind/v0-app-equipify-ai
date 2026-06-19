"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  Loader2,
  Palette,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useGrowthBreadcrumbDetail } from "@/components/growth/shell/growth-breadcrumb-context"
import {
  GrowthSharePagePreviewCard,
  type GrowthSharePagePreviewModel,
} from "@/components/growth/share-pages/growth-share-page-preview-card"
import {
  GrowthSharePageRecipientPicker,
  type GrowthSharePageRecipientSelection,
} from "@/components/growth/share-pages/growth-share-page-recipient-picker"
import {
  GrowthSharePageReviewCard,
  growthSharePagePersonalizationScore,
} from "@/components/growth/share-pages/growth-share-page-review-card"
import { saveSharePageTokens } from "@/components/growth/share-pages/growth-share-page-manage-panel"
import { GrowthSharePageStepCard } from "@/components/growth/share-pages/growth-share-page-step-card"
import { GrowthSharePageTemplatePicker } from "@/components/growth/share-pages/growth-share-page-template-picker"
import {
  growthFeaturePath,
  resolveGrowthFeatureBasePath,
} from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_SHARE_PAGE_SOURCE_CHANNELS,
  type GrowthSharePageSourceChannel,
} from "@/lib/growth/share-pages/share-page-types"
import { GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER } from "@/lib/growth/share-pages/share-page-operator-types"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import { cn } from "@/lib/utils"

const FORM_ID = "growth-share-page-builder-form"
const PREVIEW_ID = "growth-share-page-preview"

type AdvancedSettings = {
  companyId: string
  campaignId: string
  enrollmentId: string
  sequenceExecutionJobId: string
  bookingPageId: string
  sourceChannel: GrowthSharePageSourceChannel
}

const DEFAULT_ADVANCED: AdvancedSettings = {
  companyId: "",
  campaignId: "",
  enrollmentId: "",
  sequenceExecutionJobId: "",
  bookingPageId: "",
  sourceChannel: "manual",
}

const MERGE_VARIABLES = ["{{lead.first_name}}", "{{company.name}}", "{{industry}}"] as const

export function GrowthSharePageBuilder() {
  const router = useRouter()
  const pathname = usePathname()
  const previewRef = useRef<HTMLDivElement | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const [recipient, setRecipient] = useState<GrowthSharePageRecipientSelection | null>(null)
  const [template, setTemplate] = useState<GrowthSharePageTemplate | null>(null)
  const [headline, setHeadline] = useState("")
  const [introCopy, setIntroCopy] = useState("")
  const [ctaText, setCtaText] = useState("Book a meeting")
  const [ctaUrl, setCtaUrl] = useState("")
  const [calendarUrl, setCalendarUrl] = useState("")
  const [heroImageUrl, setHeroImageUrl] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#059669")
  const [accentColor, setAccentColor] = useState("#047857")
  const [footerText, setFooterText] = useState("")
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED)

  useGrowthBreadcrumbDetail("New share page")

  useEffect(() => {
    if (!recipient || headline.trim()) return
    const firstName = recipient.displayName.split(/\s+/)[0] ?? "there"
    setHeadline(`A personalized page for ${firstName}`)
  }, [recipient, headline])

  const personalizationScore = useMemo(
    () =>
      growthSharePagePersonalizationScore({
        recipient,
        template,
        headline,
        introCopy,
        ctaText,
        ctaUrl,
        calendarUrl,
        heroImageUrl,
      }),
    [recipient, template, headline, introCopy, ctaText, ctaUrl, calendarUrl, heroImageUrl],
  )

  const previewModel: GrowthSharePagePreviewModel = useMemo(
    () => ({
      logoUrl,
      heroImageUrl,
      headline,
      introCopy,
      ctaText,
      ctaUrl,
      calendarUrl,
      footerText,
      primaryColor,
      accentColor,
      recipientName: recipient?.displayName.split(/\s+/)[0] ?? "",
      companyName: recipient?.companyName ?? "",
    }),
    [
      logoUrl,
      heroImageUrl,
      headline,
      introCopy,
      ctaText,
      ctaUrl,
      calendarUrl,
      footerText,
      primaryColor,
      accentColor,
      recipient,
    ],
  )

  const canSubmit = Boolean(recipient?.leadId) && !submitting && !publishing

  function scrollToPreview() {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setPreviewOpen(true)
    }
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function buildAdvancedPayload(): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    if (advanced.companyId.trim()) body.company_id = advanced.companyId.trim()
    if (advanced.campaignId.trim()) body.campaign_id = advanced.campaignId.trim()
    if (advanced.enrollmentId.trim()) body.enrollment_id = advanced.enrollmentId.trim()
    if (advanced.sequenceExecutionJobId.trim()) {
      body.sequence_execution_job_id = advanced.sequenceExecutionJobId.trim()
    }
    if (advanced.bookingPageId.trim()) body.booking_page_id = advanced.bookingPageId.trim()
    return body
  }

  function buildPersonalizationOverride() {
    return {
      headline: headline.trim() || undefined,
      personalizedMessage: introCopy.trim() || undefined,
      suggestedCta: ctaText.trim() || undefined,
      bookingLink: calendarUrl.trim() || null,
    }
  }

  function buildCtaConfig() {
    if (!ctaText.trim() || !ctaUrl.trim()) return undefined
    return [
      {
        id: "primary",
        label: ctaText.trim(),
        kind: "primary" as const,
        action: "open_url" as const,
        destinationUrl: ctaUrl.trim(),
        trackingKey: "primary_cta",
      },
    ]
  }

  async function createSharePageDraft(): Promise<string> {
    if (!recipient?.leadId) throw new Error("Select a recipient before saving.")

    if (template?.id) {
      const res = await fetch(`/api/platform/growth/share-pages/templates/${template.id}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: recipient.leadId,
          build_context: true,
          draft_title: headline.trim() || null,
          booking_page_id: advanced.bookingPageId.trim() || null,
          company_id: advanced.companyId.trim() || null,
          personalization_override: buildPersonalizationOverride(),
        }),
      })
      const data = (await res.json()) as { ok?: boolean; share_page_id?: string; message?: string }
      if (!res.ok || !data.share_page_id) {
        throw new Error(data.message ?? "Could not create share page from template.")
      }
      if (heroImageUrl.trim()) {
        await fetch(`/api/platform/growth/share-pages/${data.share_page_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hero_media_url: heroImageUrl.trim(),
            hero_media_type: "image",
          }),
        })
      }
      return data.share_page_id
    }

    const res = await fetch("/api/platform/growth/share-pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: recipient.leadId,
        source_channel: advanced.sourceChannel,
        build_context: true,
        headline: headline.trim() || undefined,
        hero_message: introCopy.trim() || undefined,
        cta_config: buildCtaConfig(),
        ...buildAdvancedPayload(),
      }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      page?: { id: string }
      publicToken?: string
      previewToken?: string
      message?: string
    }
    if (!res.ok || !data.page?.id) {
      throw new Error(data.message ?? "Could not create share page.")
    }

    saveSharePageTokens(data.page.id, {
      publicToken: data.publicToken,
      previewToken: data.previewToken,
    })

    const patch: Record<string, unknown> = {}
    if (heroImageUrl.trim()) {
      patch.hero_media_url = heroImageUrl.trim()
      patch.hero_media_type = "image"
    }
    if (Object.keys(patch).length > 0) {
      await fetch(`/api/platform/growth/share-pages/${data.page.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    }

    return data.page.id
  }

  async function handleSaveDraft(event?: React.FormEvent) {
    event?.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const sharePageId = await createSharePageDraft()
      router.push(growthFeaturePath(pathname, `share-pages/${sharePageId}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    setError(null)
    try {
      const sharePageId = await createSharePageDraft()
      const res = await fetch(`/api/platform/growth/share-pages/${sharePageId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Publish failed.")
      }
      router.push(growthFeaturePath(pathname, `share-pages/${sharePageId}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed.")
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div
      className="mx-auto w-full max-w-[1200px] pb-24"
      data-qa-marker={GROWTH_SHARE_PAGES_OPERATOR_QA_MARKER}
    >
      <header className="mb-6 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Create Share Page</h1>
            <GrowthBadge label="Draft" tone="neutral" />
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build a personalized share page in guided steps — passive delivery only, human approval required.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" disabled title="Coming soon">
            <Sparkles className="mr-1.5 size-4" aria-hidden />
            Generate With AI
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={scrollToPreview}>
            <Eye className="mr-1.5 size-4" aria-hidden />
            Preview
          </Button>
          <Button type="submit" size="sm" form={FORM_ID} disabled={!canSubmit}>
            {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
            Save Draft
          </Button>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-8 lg:col-span-3">
          <form id={FORM_ID} className="space-y-8" onSubmit={(e) => void handleSaveDraft(e)}>
            <GrowthSharePageStepCard step={1} title="Select Recipient" icon={UserRound} required>
              <GrowthSharePageRecipientPicker value={recipient} onChange={setRecipient} />
            </GrowthSharePageStepCard>

            <GrowthSharePageStepCard step={2} title="Select Template" icon={CheckCircle2}>
              <GrowthSharePageTemplatePicker value={template} onChange={setTemplate} />
            </GrowthSharePageStepCard>

            <GrowthSharePageStepCard step={3} title="Personalize" icon={Palette}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="introCopy">Intro copy</Label>
                  <Textarea
                    id="introCopy"
                    value={introCopy}
                    onChange={(e) => setIntroCopy(e.target.value)}
                    rows={4}
                    placeholder="Personalized message for your recipient…"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ctaText">CTA text</Label>
                    <Input id="ctaText" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ctaUrl">CTA URL</Label>
                    <Input id="ctaUrl" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} inputMode="url" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendarUrl">Calendar URL</Label>
                  <Input
                    id="calendarUrl"
                    value={calendarUrl}
                    onChange={(e) => setCalendarUrl(e.target.value)}
                    inputMode="url"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroImageUrl">Hero image URL</Label>
                  <Input
                    id="heroImageUrl"
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    inputMode="url"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Brand color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="size-10 rounded-md border border-border"
                        aria-label="Pick brand color"
                      />
                      <Input id="primaryColor" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accentColor">Accent color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        className="size-10 rounded-md border border-border"
                        aria-label="Pick accent color"
                      />
                      <Input id="accentColor" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} inputMode="url" />
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Available merge variables</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {MERGE_VARIABLES.map((token) => (
                      <code key={token} className="rounded bg-background px-2 py-1 text-xs">
                        {token}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </GrowthSharePageStepCard>

            <GrowthSharePageStepCard step={4} title="Review & Approve" icon={CheckCircle2}>
              <GrowthSharePageReviewCard
                recipient={recipient}
                template={template}
                headline={headline}
                introCopy={introCopy}
                ctaText={ctaText}
                calendarUrl={calendarUrl}
                personalizationScore={personalizationScore}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" disabled={!canSubmit}>
                  Save Draft
                </Button>
                <Button type="button" variant="outline" onClick={scrollToPreview}>
                  Preview
                </Button>
                <Button type="button" disabled={!canSubmit || publishing} onClick={() => void handlePublish()}>
                  {publishing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                  Publish
                </Button>
              </div>
            </GrowthSharePageStepCard>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="flex w-full items-center justify-between"
                  aria-expanded={advancedOpen}
                  aria-controls="growth-share-page-advanced-settings"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="size-4" />
                    Advanced settings
                  </span>
                  <ChevronDown className={cn("size-4 transition-transform", advancedOpen ? "rotate-180" : "")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent id="growth-share-page-advanced-settings" className="mt-4 space-y-3 rounded-xl border p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Company ID</Label>
                    <Input
                      className="mt-1"
                      value={advanced.companyId}
                      onChange={(e) => setAdvanced((prev) => ({ ...prev, companyId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Campaign ID</Label>
                    <Input
                      className="mt-1"
                      value={advanced.campaignId}
                      onChange={(e) => setAdvanced((prev) => ({ ...prev, campaignId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Enrollment ID</Label>
                    <Input
                      className="mt-1"
                      value={advanced.enrollmentId}
                      onChange={(e) => setAdvanced((prev) => ({ ...prev, enrollmentId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Sequence execution job ID</Label>
                    <Input
                      className="mt-1"
                      value={advanced.sequenceExecutionJobId}
                      onChange={(e) =>
                        setAdvanced((prev) => ({ ...prev, sequenceExecutionJobId: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Booking page ID</Label>
                    <Input
                      className="mt-1"
                      value={advanced.bookingPageId}
                      onChange={(e) => setAdvanced((prev) => ({ ...prev, bookingPageId: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Source channel</Label>
                    <select
                      className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={advanced.sourceChannel}
                      onChange={(e) =>
                        setAdvanced((prev) => ({
                          ...prev,
                          sourceChannel: e.target.value as GrowthSharePageSourceChannel,
                        }))
                      }
                    >
                      {GROWTH_SHARE_PAGE_SOURCE_CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {channel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <aside ref={previewRef} className="lg:col-span-2">
          <div className="hidden lg:block lg:sticky lg:top-4">
            <GrowthSharePagePreviewCard id={PREVIEW_ID} model={previewModel} />
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
                  Live Share Page Preview
                </span>
                <ChevronDown
                  className={cn("size-4 transition-transform", previewOpen ? "rotate-180" : "")}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent id={`${PREVIEW_ID}-mobile`} className="mt-3">
              <GrowthSharePagePreviewCard model={previewModel} />
            </CollapsibleContent>
          </Collapsible>
        </aside>
      </div>

      <footer
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        aria-label="Share page actions"
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" asChild>
            <Link href={`${resolveGrowthFeatureBasePath(pathname)}/share-pages/manage`}>Cancel</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={scrollToPreview}>
              Preview
            </Button>
            <Button type="submit" form={FORM_ID} disabled={!canSubmit}>
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
              Save Draft
            </Button>
            <Button type="button" disabled={!canSubmit || publishing} onClick={() => void handlePublish()}>
              {publishing ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
              Publish
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
