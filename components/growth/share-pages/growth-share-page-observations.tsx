import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageObservations({ model }: { model: GrowthSharePageRenderModel }) {
  if (model.companyObservations.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Company observations
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {model.companyObservations.map((observation) => (
          <div
            key={observation}
            className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            {observation}
          </div>
        ))}
      </div>
    </section>
  )
}
