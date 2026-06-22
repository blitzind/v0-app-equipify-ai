"use client"

import { useMemo, useState } from "react"
import {
  Eye,
  Minus,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type {
  GrowthSendrBookingAsset,
  GrowthSendrLandingPage,
  GrowthSendrLandingPageSection,
  GrowthSendrPersonalizationPreviewResult,
  GrowthSendrVideoAsset,
} from "@/lib/growth/sendr/growth-sendr-types"
import {
  GROWTH_SENDR_BUILDER_PREVIEW_DEVICE_WIDTHS,
  GROWTH_SENDR_BUILDER_PREVIEW_SCALES,
  GROWTH_SENDR_BUILDER_UX_QA_MARKER,
  type GrowthSendrBuilderPreviewDevice,
  type GrowthSendrBuilderPreviewScale,
} from "@/lib/growth/sendr/growth-sendr-builder-config"
import { buildGrowthSendrPagePreviewPayload } from "@/lib/growth/sendr/growth-sendr-page-preview-payload"
import { PresentationPageShell } from "@/components/growth/sendr/presentation/presentation-page-shell"
import { PresentationThemeProvider } from "@/components/growth/sendr/presentation/presentation-section"
import { SendrPublicPresentationLayout } from "@/components/growth/sendr/presentation/sendr-public-presentation-layout"
import { cn } from "@/lib/utils"

type Props = {
  page: GrowthSendrLandingPage
  sections: GrowthSendrLandingPageSection[]
  videoAsset?: GrowthSendrVideoAsset | null
  bookingAsset?: GrowthSendrBookingAsset | null
  personalizationPreview?: GrowthSendrPersonalizationPreviewResult | null
  sticky?: boolean
  className?: string
}

const DEVICE_OPTIONS: Array<{ id: GrowthSendrBuilderPreviewDevice; label: string; icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Phone", icon: Smartphone },
]

export function GrowthSendrBuilderLivePreview({
  page,
  sections,
  videoAsset,
  bookingAsset,
  personalizationPreview,
  sticky = false,
  className,
}: Props) {
  const [device, setDevice] = useState<GrowthSendrBuilderPreviewDevice>("desktop")
  const [scale, setScale] = useState<GrowthSendrBuilderPreviewScale>(0.75)
  const [prospectMode, setProspectMode] = useState(true)

  const payload = useMemo(
    () =>
      buildGrowthSendrPagePreviewPayload({
        page,
        sections,
        videoAsset,
        bookingAsset,
        personalizationPreview,
        prospectMode,
      }),
    [page, sections, videoAsset, bookingAsset, personalizationPreview, prospectMode],
  )

  const deviceWidth = GROWTH_SENDR_BUILDER_PREVIEW_DEVICE_WIDTHS[device]

  function stepScale(direction: "up" | "down") {
    const index = GROWTH_SENDR_BUILDER_PREVIEW_SCALES.indexOf(scale)
    if (direction === "up" && index < GROWTH_SENDR_BUILDER_PREVIEW_SCALES.length - 1) {
      setScale(GROWTH_SENDR_BUILDER_PREVIEW_SCALES[index + 1]!)
    }
    if (direction === "down" && index > 0) {
      setScale(GROWTH_SENDR_BUILDER_PREVIEW_SCALES[index - 1]!)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100/70 shadow-sm dark:border-slate-800 dark:bg-slate-950",
        sticky && "lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]",
        className,
      )}
      data-qa-marker={GROWTH_SENDR_BUILDER_UX_QA_MARKER}
    >
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Live preview</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">See exactly what prospects experience</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950">
            <UserRound className="size-3.5 text-blue-600" />
            <Label htmlFor="prospect-mode" className="text-xs font-medium text-slate-700 dark:text-slate-300">
              View as prospect
            </Label>
            <Switch id="prospect-mode" checked={prospectMode} onCheckedChange={setProspectMode} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200/80 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
            {DEVICE_OPTIONS.map((option) => {
              const Icon = option.icon
              return (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={device === option.id ? "secondary" : "ghost"}
                  className="h-8 px-2.5 text-xs"
                  onClick={() => setDevice(option.id)}
                >
                  <Icon className="mr-1 size-3.5" />
                  {option.label}
                </Button>
              )
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-slate-50 px-1 dark:border-slate-700 dark:bg-slate-950">
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => stepScale("down")}>
              <Minus className="size-3.5" />
            </Button>
            <span className="min-w-[3rem] text-center text-xs font-medium text-slate-600 dark:text-slate-400">
              {Math.round(scale * 100)}%
            </span>
            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => stepScale("up")}>
              <Plus className="size-3.5" />
            </Button>
          </div>

          {prospectMode ? (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
              <Eye className="size-3.5" />
              Prospect perspective
            </span>
          ) : null}
        </div>
      </div>

      <div className={cn("min-h-[420px] flex-1 overflow-auto p-4", sticky && "lg:min-h-0")}>
        <div className="flex justify-center">
          <div
            className={cn(
              "origin-top transition-[width,transform] duration-200",
              device !== "desktop" && "rounded-[1.25rem] border-[6px] border-slate-800 bg-slate-800 shadow-xl dark:border-slate-700",
            )}
            style={{
              width: deviceWidth ? `${deviceWidth}px` : "100%",
              maxWidth: "100%",
              transform: `scale(${scale})`,
            }}
          >
            <div className={cn(device !== "desktop" && "overflow-hidden rounded-[0.85rem]")} style={{ backgroundColor: "var(--sendr-page-bg)" }}>
              <PresentationThemeProvider theme={payload.theme}>
                {prospectMode ? (
                  <PresentationPageShell className="min-h-0 bg-transparent px-0 py-0 sm:px-0 sm:py-0">
                    <SendrPublicPresentationLayout page={payload} onTrack={() => {}} previewMode />
                  </PresentationPageShell>
                ) : (
                  <div
                    className="rounded-xl border border-dashed p-2"
                    style={{
                      borderColor: "color-mix(in srgb, var(--sendr-page-text) 25%, transparent)",
                      backgroundColor: "var(--sendr-surface)",
                    }}
                  >
                    <p
                      className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: "color-mix(in srgb, var(--sendr-page-text) 45%, transparent)" }}
                    >
                      Builder frame
                    </p>
                    <SendrPublicPresentationLayout page={payload} onTrack={() => {}} previewMode />
                  </div>
                )}
              </PresentationThemeProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
