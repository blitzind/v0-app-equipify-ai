import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"

export function GrowthSharePageFooter({ model }: { model: GrowthSharePageRenderModel }) {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
      {model.theme.footerNote ? <p className="mb-2">{model.theme.footerNote}</p> : null}
      <p>Powered by Equipify</p>
    </footer>
  )
}
