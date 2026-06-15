import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { FileText } from "lucide-react"

export function GrowthSharePageResources({ model }: { model: GrowthSharePageRenderModel }) {
  if (model.resources.length === 0) return null

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Resources
      </h2>
      <div className="mt-4 space-y-3">
        {model.resources.map((resource) => (
          <div
            key={resource.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <FileText className="mt-0.5 size-4 shrink-0 text-[var(--share-brand-color)]" aria-hidden />
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{resource.title}</p>
              {resource.description ? (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{resource.description}</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
