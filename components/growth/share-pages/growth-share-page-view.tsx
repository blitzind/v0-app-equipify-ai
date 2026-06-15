import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { sharePageThemeStyle } from "@/components/growth/share-pages/share-page-theme-utils"
import { GrowthSharePageHero } from "@/components/growth/share-pages/growth-share-page-hero"
import { GrowthSharePageMessage } from "@/components/growth/share-pages/growth-share-page-message"
import { GrowthSharePageObservations } from "@/components/growth/share-pages/growth-share-page-observations"
import { GrowthSharePageCtaSection } from "@/components/growth/share-pages/growth-share-page-cta-section"
import { GrowthSharePageResources } from "@/components/growth/share-pages/growth-share-page-resources"
import { GrowthSharePageFooter } from "@/components/growth/share-pages/growth-share-page-footer"
import { PublicBookingThemeShell } from "@/components/growth/public-booking-theme-shell"
import { GROWTH_SHARE_PAGES_SSR_QA_MARKER } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageView({ model }: { model: GrowthSharePageRenderModel }) {
  return (
    <PublicBookingThemeShell mode={model.theme.publicThemeMode}>
      <div
        className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
        data-qa-marker={GROWTH_SHARE_PAGES_SSR_QA_MARKER}
        style={sharePageThemeStyle(model.theme)}
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
            <GrowthSharePageCtaSection model={model} />
            <GrowthSharePageResources model={model} />
          </div>
          <GrowthSharePageFooter model={model} />
        </div>
      </div>
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
