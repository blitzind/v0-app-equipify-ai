import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { sharePageThemeStyle } from "@/components/growth/share-pages/share-page-theme-utils"
import { hasSharePageExtendedTheme } from "@/lib/growth/share-pages/share-page-types"
import { GrowthSharePageHero } from "@/components/growth/share-pages/growth-share-page-hero"
import { GrowthSharePageMessage } from "@/components/growth/share-pages/growth-share-page-message"
import { GrowthSharePageObservations } from "@/components/growth/share-pages/growth-share-page-observations"
import { GrowthSharePageCtaSection } from "@/components/growth/share-pages/growth-share-page-cta-section"
import { GrowthSharePageBookingSection } from "@/components/growth/share-pages/growth-share-page-booking-section"
import { GrowthSharePageResources } from "@/components/growth/share-pages/growth-share-page-resources"
import { GrowthSharePageFooter } from "@/components/growth/share-pages/growth-share-page-footer"
import { SharePageTracker, useSharePageTracker } from "@/components/growth/share-pages/share-page-tracker"
import { PublicBookingThemeShell } from "@/components/growth/public-booking-theme-shell"
import { GROWTH_SHARE_PAGES_SSR_QA_MARKER } from "@/lib/growth/share-pages/share-page-types"

function sharePageShellStyle(model: GrowthSharePageRenderModel) {
  const extended = hasSharePageExtendedTheme(model.theme)
  const base = sharePageThemeStyle(model.theme)
  if (!extended) {
    return base
  }
  return {
    ...base,
    backgroundColor: "var(--share-page-bg)",
    color: "var(--share-page-text)",
  }
}

function GrowthSharePageStaticLayout({ model }: { model: GrowthSharePageRenderModel }) {
  const extended = hasSharePageExtendedTheme(model.theme)
  return (
    <div
      className={extended ? "min-h-screen" : "min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"}
      data-qa-marker={GROWTH_SHARE_PAGES_SSR_QA_MARKER}
      style={sharePageShellStyle(model)}
    >
      {model.previewMode ? (
        <div className="sticky top-0 z-20 border-b border-amber-300/60 bg-amber-100/95 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/90 dark:text-amber-200">
          Preview mode
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <GrowthSharePageHero model={model} />
        <div className="mt-8 space-y-8">
          <GrowthSharePageMessage model={model} />
          <GrowthSharePageObservations model={model} />
          <GrowthSharePageBookingSection model={model} />
          <GrowthSharePageCtaSection model={model} />
          <GrowthSharePageResources model={model} />
        </div>
        <GrowthSharePageFooter model={model} />
      </div>
    </div>
  )
}

function GrowthSharePageTrackedLayout({ model }: { model: GrowthSharePageRenderModel }) {
  const { trackEvent } = useSharePageTracker()
  const extended = hasSharePageExtendedTheme(model.theme)

  const trackBookingStarted = () => {
    void trackEvent("SHARE_PAGE_BOOKING_STARTED", { metadata: { source: "share_page_booking_section" } })
  }

  const handleCtaClick: Parameters<typeof GrowthSharePageCtaSection>[0]["onCtaClick"] = (cta, input) => {
    void trackEvent("SHARE_PAGE_CTA_CLICKED", {
      eventLabel: cta.label,
      metadata: { tracking_key: cta.trackingKey, cta_id: cta.id, action: cta.action },
    })
    if (input?.bookingStarted) {
      void trackEvent("SHARE_PAGE_BOOKING_STARTED", {
        eventLabel: cta.label,
        metadata: { tracking_key: cta.trackingKey, cta_id: cta.id, source: "share_page_cta" },
      })
    }
  }

  return (
    <div
      className={extended ? "min-h-screen" : "min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"}
      data-qa-marker={GROWTH_SHARE_PAGES_SSR_QA_MARKER}
      style={sharePageShellStyle(model)}
    >
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <GrowthSharePageHero model={model} />
        <div className="mt-8 space-y-8">
          <GrowthSharePageMessage model={model} />
          <GrowthSharePageObservations model={model} />
          <GrowthSharePageBookingSection model={model} onBookingStart={trackBookingStarted} />
          <GrowthSharePageCtaSection model={model} onCtaClick={handleCtaClick} />
          <GrowthSharePageResources
            model={model}
            onResourceOpen={(resource) => {
              void trackEvent("SHARE_PAGE_RESOURCE_OPENED", {
                eventLabel: resource.title,
                metadata: { resource_id: resource.id, resource_kind: resource.kind },
              })
            }}
          />
        </div>
        <GrowthSharePageFooter model={model} />
      </div>
    </div>
  )
}

export function GrowthSharePageView({ model }: { model: GrowthSharePageRenderModel }) {
  const trackable = Boolean(model.publicToken && !model.previewMode)

  return (
    <PublicBookingThemeShell mode={model.theme.publicThemeMode}>
      {trackable && model.publicToken ? (
        <SharePageTracker publicToken={model.publicToken}>
          <GrowthSharePageTrackedLayout model={model} />
        </SharePageTracker>
      ) : (
        <GrowthSharePageStaticLayout model={model} />
      )}
    </PublicBookingThemeShell>
  )
}

export function GrowthSharePageUnavailable({
  title,
  message,
}: {
  title: string
  message: string
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950"
      data-qa-marker={GROWTH_SHARE_PAGES_SSR_QA_MARKER}
    >
      <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{message}</p>
      </div>
    </div>
  )
}
