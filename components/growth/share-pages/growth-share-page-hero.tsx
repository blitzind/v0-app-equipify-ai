import type { GrowthSharePageRenderModel } from "@/lib/growth/share-pages/share-page-types"
import { ImageIcon, Mic, Video } from "lucide-react"

export function GrowthSharePageHero({ model }: { model: GrowthSharePageRenderModel }) {
  return (
    <header className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {model.theme.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={model.theme.logoUrl} alt="" className="h-10 w-auto object-contain" />
        ) : (
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--share-brand-color)]">
            Equipify
          </div>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Hi {model.prospectName}, a personalized note for {model.companyName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">
          {model.headline}
        </h1>
        {model.subheadline ? (
          <p className="text-base text-slate-600 dark:text-slate-400">{model.subheadline}</p>
        ) : null}
      </div>

      {model.theme.heroImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={model.theme.heroImageUrl}
          alt=""
          className="h-48 w-full rounded-2xl object-cover sm:h-56"
        />
      ) : null}

      <GrowthSharePageHeroMediaPlaceholder model={model} />
    </header>
  )
}

function GrowthSharePageHeroMediaPlaceholder({ model }: { model: GrowthSharePageRenderModel }) {
  if (model.heroMediaType === "none" && !model.voiceAssetId && !model.videoAssetId) return null

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        Media placeholder
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {model.heroMediaType === "image" ? (
          <MediaSlot
            icon={ImageIcon}
            label="Hero image"
            detail={model.heroMediaUrl ?? model.heroMediaThumbnailUrl ?? "Coming soon"}
          />
        ) : null}
        {model.heroMediaType === "video" || model.videoAssetId ? (
          <MediaSlot icon={Video} label="Personalized video" detail={model.videoAssetId ?? model.heroMediaUrl ?? "Coming soon"} />
        ) : null}
        {model.voiceAssetId ? (
          <MediaSlot icon={Mic} label="Voice message" detail={model.voiceAssetId} />
        ) : null}
      </div>
    </div>
  )
}

function MediaSlot({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof ImageIcon
  label: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
        <Icon className="size-4 text-[var(--share-brand-color)]" aria-hidden />
        {label}
      </div>
      <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  )
}
