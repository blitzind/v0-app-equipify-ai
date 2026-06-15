import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageMessage({ model }: { model: GrowthSharePageRenderModel }) {
  if (!model.heroMessage && !model.whyReachingOut) return null

  return (
    <section className="space-y-6">
      {model.heroMessage ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Personalized message
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-base leading-7 text-slate-700 dark:text-slate-300">
            {model.heroMessage}
          </p>
        </div>
      ) : null}

      {model.whyReachingOut ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Why we&apos;re reaching out
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-300">{model.whyReachingOut}</p>
        </div>
      ) : null}
    </section>
  )
}
