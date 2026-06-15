import type { GrowthSharePageCTA, GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { cn } from "@/lib/utils"

export function GrowthSharePageCtaSection({
  model,
  onCtaClick,
}: {
  model: GrowthSharePageRenderModel
  onCtaClick?: (cta: GrowthSharePageCTA) => void
}) {
  if (model.ctaConfig.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Suggested next step
      </h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {model.ctaConfig.map((cta) => (
          <button
            key={cta.id}
            type="button"
            aria-label={cta.label}
            onClick={() => onCtaClick?.(cta)}
            className={cn(
              "inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium",
              cta.kind === "primary"
                ? "bg-[var(--share-brand-color)] text-white"
                : cta.kind === "secondary"
                  ? "border border-[var(--share-accent-color)] text-[var(--share-accent-color)]"
                  : "text-[var(--share-brand-color)] underline decoration-[var(--share-brand-color)]/40",
            )}
          >
            {cta.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Presentation only — actions will be enabled in a later release.
      </p>
    </section>
  )
}
